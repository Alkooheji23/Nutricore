import webpush from 'web-push';
import { storage } from './storage';
import type { NotificationType } from '@shared/schema';

const MAX_NOTIFICATIONS_PER_DAY = 2;

const VAPID_PUBLIC_KEY = process.env.PUSH_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.PUSH_VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.PUSH_VAPID_EMAIL || 'mailto:support@nutricore.app';

let initialized = false;

export function initializePushService() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured. Push notifications disabled.');
    return false;
  }

  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    initialized = true;
    console.log('[Push] Service initialized successfully');
    return true;
  } catch (error) {
    console.error('[Push] Failed to initialize:', error);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

export function isPushEnabled(): boolean {
  return initialized;
}

interface PushPayload {
  title: string;
  body: string;
  notificationType: NotificationType;
  deepLink?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!initialized) {
    console.warn('[Push] Service not initialized, skipping notification');
    return { success: false, sent: 0, failed: 0 };
  }

  const notificationCount = await storage.getNotificationCountToday(userId);
  if (notificationCount >= MAX_NOTIFICATIONS_PER_DAY) {
    console.log(`[Push] Rate limit reached for user ${userId} (${notificationCount}/${MAX_NOTIFICATIONS_PER_DAY})`);
    return { success: false, sent: 0, failed: 0 };
  }

  const subscriptions = await storage.getPushSubscriptions(userId);
  if (subscriptions.length === 0) {
    console.log(`[Push] No subscriptions found for user ${userId}`);
    return { success: false, sent: 0, failed: 0 };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    actionType: payload.notificationType,
    deepLink: payload.deepLink || '/',
    data: payload.data,
  });

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        notificationPayload
      );
      sent++;
      await storage.updatePushSubscriptionLastUsed(subscription.id);
    } catch (error: any) {
      failed++;
      console.error(`[Push] Failed to send to subscription ${subscription.id}:`, error.message);
      
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`[Push] Subscription expired, removing: ${subscription.endpoint}`);
        await storage.deletePushSubscription(subscription.endpoint);
      }
    }
  }

  if (sent > 0) {
    await storage.createNotificationLog({
      userId,
      notificationType: payload.notificationType,
      title: payload.title,
      body: payload.body,
      deepLink: payload.deepLink,
      delivered: true,
    });
  }

  console.log(`[Push] Sent ${sent}/${subscriptions.length} notifications to user ${userId}`);
  return { success: sent > 0, sent, failed };
}

export async function sendWorkoutDetectedNotification(
  userId: string,
  activityName: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const { generateWorkoutDetectedMessage } = await import('./notificationMessageGenerator');
    const generated = await generateWorkoutDetectedMessage(userId, activityName);
    
    if (!generated.shouldSend || !generated.body) {
      console.log(`[Push] AI decided not to send workout notification for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    return await sendPushNotification(userId, {
      title: generated.title,
      body: generated.body,
      notificationType: 'workout_detected',
      deepLink: '/chat',
    });
  } catch (error) {
    console.error('[Push] Error generating workout notification:', error);
    return await sendPushNotification(userId, {
      title: 'Workout Detected',
      body: `${activityName} detected. Want to log the details?`,
      notificationType: 'workout_detected',
      deepLink: '/chat',
    });
  }
}

export async function sendPlanReminderNotification(
  userId: string,
  workoutName: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const { generatePlanReminderMessage } = await import('./notificationMessageGenerator');
    const generated = await generatePlanReminderMessage(userId, workoutName);
    
    if (!generated.shouldSend || !generated.body) {
      console.log(`[Push] AI decided not to send plan reminder for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    return await sendPushNotification(userId, {
      title: generated.title,
      body: generated.body,
      notificationType: 'missed_workout',
      deepLink: '/plans',
    });
  } catch (error) {
    console.error('[Push] Error generating plan reminder:', error);
    return await sendPushNotification(userId, {
      title: "Today's Plan",
      body: `${workoutName} is on your schedule. Still time.`,
      notificationType: 'missed_workout',
      deepLink: '/plans',
    });
  }
}

export async function sendConsistencyNotification(
  userId: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const { generateConsistencyMessage } = await import('./notificationMessageGenerator');
    const generated = await generateConsistencyMessage(userId);
    
    if (!generated.shouldSend || !generated.body) {
      console.log(`[Push] AI decided not to send consistency notification for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    return await sendPushNotification(userId, {
      title: generated.title,
      body: generated.body,
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });
  } catch (error) {
    console.error('[Push] Error generating consistency notification:', error);
    return { success: false, sent: 0, failed: 0 };
  }
}

export async function sendRecoveryNotification(
  userId: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    const { generateRecoveryMessage } = await import('./notificationMessageGenerator');
    const generated = await generateRecoveryMessage(userId);
    
    if (!generated.shouldSend || !generated.body) {
      console.log(`[Push] AI decided not to send recovery notification for user ${userId}`);
      return { success: false, sent: 0, failed: 0 };
    }

    return await sendPushNotification(userId, {
      title: generated.title,
      body: generated.body,
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });
  } catch (error) {
    console.error('[Push] Error generating recovery notification:', error);
    return { success: false, sent: 0, failed: 0 };
  }
}

export async function sendMissedWorkoutNotification(
  userId: string,
  workoutName: string
): Promise<boolean> {
  const result = await sendPlanReminderNotification(userId, workoutName);
  return result.success;
}

export async function sendTrainerFollowupNotification(
  userId: string,
  message?: string
): Promise<boolean> {
  if (message) {
    const result = await sendPushNotification(userId, {
      title: 'Your Trainer',
      body: message,
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });
    return result.success;
  }
  const result = await sendConsistencyNotification(userId);
  return result.success;
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}
