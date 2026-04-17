import { storage } from './storage';
import { sendPushNotification, isPushEnabled } from './pushService';
import { generateDailyCoachingMessage } from './notificationMessageGenerator';

const DAILY_CHECK_INTERVAL = 60 * 60 * 1000;
const TARGET_HOUR_UTC = 6;

let lastRunDate: string | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;

export function startDailyNotificationScheduler() {
  if (schedulerInterval) {
    console.log('[DailyScheduler] Already running, skipping duplicate start');
    return;
  }
  
  if (!isPushEnabled()) {
    console.log('[DailyScheduler] Push notifications not enabled, scheduler disabled');
    return;
  }
  
  console.log('[DailyScheduler] Starting daily notification scheduler');
  
  checkAndRunDailyNotifications();
  
  schedulerInterval = setInterval(() => {
    checkAndRunDailyNotifications();
  }, DAILY_CHECK_INTERVAL);
}

export function stopDailyNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[DailyScheduler] Stopped');
  }
}

async function checkAndRunDailyNotifications() {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const currentHourUTC = now.getUTCHours();
  
  if (lastRunDate === todayDate) {
    return;
  }
  
  if (currentHourUTC < TARGET_HOUR_UTC) {
    return;
  }
  
  console.log(`[DailyScheduler] Running daily notifications for ${todayDate}`);
  
  try {
    await sendDailyNotificationsToAllUsers();
    lastRunDate = todayDate;
  } catch (error) {
    console.error('[DailyScheduler] Daily run failed, will retry next hour:', error);
  }
}

async function sendDailyNotificationsToAllUsers() {
  try {
    const userIds = await storage.getAllUserIdsWithPushSubscriptions();
    console.log(`[DailyScheduler] Found ${userIds.length} users with push subscriptions`);
    
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const userId of userIds) {
      try {
        const user = await storage.getUser(userId);
        if (!user) {
          skipped++;
          continue;
        }
        
        const generated = await generateDailyCoachingMessage(userId);
        
        if (!generated.shouldSend || !generated.body) {
          console.log(`[DailyScheduler] AI decided not to send to user ${userId}`);
          skipped++;
          continue;
        }
        
        const categoryToNotificationType: Record<string, 'missed_workout' | 'trainer_followup' | 'workout_detected'> = {
          'plan_reminder': 'missed_workout',
          'consistency_habit': 'trainer_followup',
          'recovery_coaching': 'trainer_followup',
          'workout_detected': 'workout_detected',
        };
        
        const result = await sendPushNotification(userId, {
          title: generated.title,
          body: generated.body,
          notificationType: categoryToNotificationType[generated.category] || 'trainer_followup',
          deepLink: '/chat',
        });
        
        if (result.success) {
          sent++;
        } else {
          skipped++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`[DailyScheduler] Error sending to user ${userId}:`, error);
        failed++;
      }
    }
    
    console.log(`[DailyScheduler] Complete: sent=${sent}, skipped=${skipped}, failed=${failed}`);
    
  } catch (error) {
    console.error('[DailyScheduler] Error in daily notification run:', error);
  }
}

export async function triggerDailyNotificationsManually() {
  console.log('[DailyScheduler] Manual trigger requested');
  lastRunDate = null;
  await sendDailyNotificationsToAllUsers();
}
