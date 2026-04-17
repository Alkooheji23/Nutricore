import OpenAI from 'openai';
import { storage } from './storage';
import type { CoachingDecisionType } from '@shared/schema';

// OpenRouter client for Grok via Replit AI Integrations
let openrouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouterClient) {
    openrouterClient = new OpenAI({ 
      apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL!,
    });
  }
  return openrouterClient;
}

const MAX_MESSAGE_LENGTH = 120;
const MAX_COACHING_NOTIFICATIONS_PER_DAY = 1;
const MAX_TOTAL_NOTIFICATIONS_PER_DAY = 2;
const MIN_HOURS_BETWEEN_SAME_CATEGORY = 72;
const ALLOWED_HOURS_START = 8;
const ALLOWED_HOURS_END = 21;

export type NotificationCategory = 
  | 'workout_detected'
  | 'plan_reminder'
  | 'consistency_habit'
  | 'recovery_coaching';

const COACHING_CATEGORIES: NotificationCategory[] = [
  'plan_reminder',
  'consistency_habit', 
  'recovery_coaching'
];

const EVENT_DRIVEN_CATEGORIES: NotificationCategory[] = [
  'workout_detected'
];

interface UserContext {
  recentWorkouts: number;
  lastWorkoutDate: string | null;
  hasPlannedWorkoutToday: boolean;
  plannedWorkoutName: string | null;
  recoveryState: 'good' | 'moderate' | 'needs_rest' | 'unknown';
  streakDays: number;
  activityName?: string;
  lastNotificationOfType?: Date | null;
  recentlyActiveInApp?: boolean;
  justCompletedWorkout?: boolean;
  coachingDecision?: CoachingDecisionType | null;
}

interface GeneratedMessage {
  title: string;
  body: string;
  shouldSend: boolean;
  category: NotificationCategory;
  suppressionReason?: string;
}

const PROHIBITED_PATTERNS = [
  /you missed/i,
  /don't be lazy/i,
  /always\s/i,
  /\bnever\b/i,
  /guaranteed/i,
  /doctor/i,
  /medical/i,
  /diagnos/i,
  /cure/i,
  /treat/i,
  /shame/i,
  /disappoint/i,
  /\bfail/i,
  /excuse/i,
  /\bmust\b/i,
  /have to/i,
  /no excuses/i,
  /100%/i,
  /don't give up/i,
  /lazy/i,
  /pathetic/i,
  /weak/i,
  /loser/i,
  /fat/i,
  /ugly/i,
  /stupid/i,
  /idiot/i,
  /worthless/i,
  /terrible/i,
  /horrible/i,
  /awful/i,
  /disgusting/i,
  /!{2,}/,
  /\?{2,}/,
  /urgent/i,
  /limited time/i,
  /act now/i,
  /don't miss/i,
  /last chance/i,
  /exclusive/i,
  /special offer/i,
  /subscribe/i,
  /upgrade/i,
  /premium/i,
  /buy/i,
  /purchase/i,
  /discount/i,
  /free trial/i,
];

const CATEGORY_TITLES: Record<NotificationCategory, string> = {
  workout_detected: 'Workout Detected',
  plan_reminder: 'Today\'s Plan',
  consistency_habit: 'Quick Thought',
  recovery_coaching: 'Recovery Note',
};

const SYSTEM_PROMPT = `You are a premium fitness coach assistant generating push notification messages. 

RULES (strictly follow):
- Maximum 120 characters for the body
- Tone: calm, confident, human, lightly witty (never cheesy)
- Never use guilt, shame, or fear-based language
- Never give medical advice
- Never use absolutes like "always" or "never"
- Never use exaggerated claims
- Be helpful, not noisy
- Sound like a thoughtful human coach, not an app

If you cannot generate a high-quality message that fits these rules, respond with exactly: NO_SEND

Respond with ONLY the notification body text (no quotes, no explanation).`;

function validateMessage(message: string): { valid: boolean; reason?: string } {
  if (message === 'NO_SEND') {
    return { valid: false, reason: 'AI determined no quality message fits context' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, reason: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` };
  }

  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(message)) {
      return { valid: false, reason: `Contains prohibited content: ${pattern}` };
    }
  }

  return { valid: true };
}

function isOutsideAllowedHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour < ALLOWED_HOURS_START || hour >= ALLOWED_HOURS_END;
}

interface SuppressionCheck {
  shouldSuppress: boolean;
  reason?: string;
}

function isCoachingNotificationAllowed(
  coachingDecision: CoachingDecisionType | null | undefined,
  category: NotificationCategory
): { allowed: boolean; reason?: string } {
  if (!coachingDecision) {
    return { allowed: false, reason: 'no_active_coaching_decision' };
  }

  switch (coachingDecision) {
    case 'deload_suggested':
      if (category === 'plan_reminder' || category === 'consistency_habit') {
        return { allowed: false, reason: 'deload_blocks_workout_reminders' };
      }
      if (category === 'recovery_coaching') {
        return { allowed: true };
      }
      return { allowed: false, reason: 'deload_blocks_non_recovery' };

    case 'reduce_volume':
      if (category === 'recovery_coaching') {
        return { allowed: true };
      }
      if (category === 'consistency_habit') {
        return { allowed: false, reason: 'reduce_volume_blocks_consistency' };
      }
      return { allowed: true };

    case 'increase_volume':
    case 'maintain':
      return { allowed: true };

    default:
      return { allowed: false, reason: 'unknown_coaching_decision' };
  }
}

async function checkSuppression(
  userId: string,
  category: NotificationCategory,
  context: UserContext
): Promise<SuppressionCheck> {
  const isEventDriven = EVENT_DRIVEN_CATEGORIES.includes(category);
  const isCoachingCategory = COACHING_CATEGORIES.includes(category);

  if (isOutsideAllowedHours() && !isEventDriven) {
    return { shouldSuppress: true, reason: 'outside_allowed_hours_8am_9pm' };
  }

  if (context.justCompletedWorkout && !isEventDriven) {
    return { shouldSuppress: true, reason: 'user_just_completed_workout' };
  }

  if (context.recentlyActiveInApp && !isEventDriven) {
    return { shouldSuppress: true, reason: 'user_active_in_app' };
  }

  if (context.lastNotificationOfType) {
    const hoursSinceLastSame = (Date.now() - context.lastNotificationOfType.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSame < MIN_HOURS_BETWEEN_SAME_CATEGORY) {
      return { shouldSuppress: true, reason: 'same_category_within_72h' };
    }
  }

  if (isCoachingCategory) {
    const coachingCheck = isCoachingNotificationAllowed(context.coachingDecision, category);
    if (!coachingCheck.allowed) {
      return { shouldSuppress: true, reason: coachingCheck.reason };
    }
  }

  if (category === 'recovery_coaching' && context.recoveryState === 'unknown') {
    return { shouldSuppress: true, reason: 'insufficient_recovery_data' };
  }

  if (category === 'consistency_habit') {
    if (context.recentWorkouts === 0 && !context.lastWorkoutDate) {
      return { shouldSuppress: true, reason: 'low_signal_no_workout_history' };
    }
    if (context.recoveryState === 'needs_rest') {
      return { shouldSuppress: true, reason: 'user_needs_rest' };
    }
  }

  if (category === 'plan_reminder') {
    if (!context.hasPlannedWorkoutToday) {
      return { shouldSuppress: true, reason: 'low_signal_no_planned_workout' };
    }
  }

  return { shouldSuppress: false };
}

async function gatherUserContext(userId: string): Promise<UserContext> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  let recentWorkouts = 0;
  let lastWorkoutDate: string | null = null;
  let hasPlannedWorkoutToday = false;
  let plannedWorkoutName: string | null = null;
  let streakDays = 0;
  let recoveryState: 'good' | 'moderate' | 'needs_rest' | 'unknown' = 'unknown';
  let justCompletedWorkout = false;
  let coachingDecision: CoachingDecisionType | null = null;
  let recentlyActiveInApp = false;

  try {
    recentWorkouts = await storage.getWorkoutCountsByDateRange(userId, weekAgo, today);

    const recentMessages = await storage.getChatMessages(userId, 1);
    if (recentMessages.length > 0 && recentMessages[0].createdAt) {
      const minutesSinceLastMessage = (Date.now() - new Date(recentMessages[0].createdAt).getTime()) / (1000 * 60);
      if (minutesSinceLastMessage < 15) {
        recentlyActiveInApp = true;
      }
    }

    const workoutLogs = await storage.getWorkoutLogs(userId, weekAgo, today);
    if (workoutLogs.length > 0) {
      lastWorkoutDate = workoutLogs[0].date?.toISOString().split('T')[0] || null;
      
      const lastWorkout = workoutLogs[0];
      if (lastWorkout.date) {
        const hoursSinceLastWorkout = (Date.now() - new Date(lastWorkout.date).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastWorkout < 2) {
          justCompletedWorkout = true;
        }
      }
    }

    const scheduled = await storage.getScheduledWorkouts(userId, startOfToday, endOfToday);
    if (scheduled && scheduled.length > 0) {
      hasPlannedWorkoutToday = true;
      plannedWorkoutName = scheduled[0].title || null;
    }

    const todayStr = today.toISOString().split('T')[0];
    const activity = await storage.getDailyActivity(userId, todayStr);
    if (activity) {
      const activeMinutes = activity.activeMinutes || 0;
      if (activeMinutes < 30 && recentWorkouts >= 4) {
        recoveryState = 'needs_rest';
      } else if (activeMinutes >= 30) {
        recoveryState = 'good';
      } else {
        recoveryState = 'moderate';
      }
    }

    const latestDecision = await storage.getLatestCoachingDecision(userId);
    if (latestDecision) {
      const decisionAge = Date.now() - new Date(latestDecision.generatedAt || 0).getTime();
      const maxDecisionAge = 7 * 24 * 60 * 60 * 1000;
      if (decisionAge < maxDecisionAge) {
        coachingDecision = latestDecision.decisionType as CoachingDecisionType;
      }
    }

    streakDays = recentWorkouts;
  } catch (error) {
    console.warn('[NotificationGen] Error gathering context:', error);
  }

  return {
    recentWorkouts,
    lastWorkoutDate,
    hasPlannedWorkoutToday,
    plannedWorkoutName,
    recoveryState,
    streakDays,
    justCompletedWorkout,
    coachingDecision,
    recentlyActiveInApp,
  };
}

function buildPromptForCategory(category: NotificationCategory, context: UserContext): string {
  const decisionContext = context.coachingDecision 
    ? `Current coaching decision: ${context.coachingDecision}.`
    : '';

  switch (category) {
    case 'workout_detected':
      return `Generate a notification body for when a "${context.activityName || 'workout'}" was detected from the user's smartwatch. Ask if they want to log details. Keep it brief and coach-like.`;

    case 'plan_reminder':
      const planTone = context.coachingDecision === 'reduce_volume' 
        ? 'Be supportive, suggest light activity is fine.'
        : 'Neutral and steady.';
      return `Generate a notification body reminding the user they have "${context.plannedWorkoutName || 'a workout'}" planned today. ${decisionContext} ${planTone} The user has done ${context.recentWorkouts} workouts this week.`;

    case 'consistency_habit':
      const consistencyTone = context.coachingDecision === 'increase_volume'
        ? 'Confident and encouraging.'
        : 'Neutral and steady.';
      return `Generate a motivational notification about consistency. ${decisionContext} ${consistencyTone} The user has done ${context.recentWorkouts} workouts this week. Their streak is ${context.streakDays} days. Reinforce showing up without being cheesy.`;

    case 'recovery_coaching':
      const recoveryContext = context.recoveryState === 'needs_rest' 
        ? 'The user has been very active and may need rest.'
        : context.recoveryState === 'good'
        ? 'The user has good recovery and is ready for training.'
        : 'Recovery state is moderate.';
      const recoveryTone = context.coachingDecision === 'deload_suggested'
        ? 'Frame as recovery opportunity, not restriction.'
        : context.coachingDecision === 'reduce_volume'
        ? 'Supportive, suggest light movement.'
        : 'Balanced.';
      return `Generate a recovery-aware coaching notification. ${recoveryContext} ${decisionContext} ${recoveryTone} The user has done ${context.recentWorkouts} workouts this week.`;

    default:
      return 'Generate a brief, helpful fitness coaching notification.';
  }
}

export async function generateNotificationMessage(
  userId: string,
  category: NotificationCategory,
  overrideContext?: Partial<UserContext>
): Promise<GeneratedMessage> {
  const isCoachingCategory = COACHING_CATEGORIES.includes(category);
  
  const [totalNotifications, coachingNotifications] = await Promise.all([
    storage.getNotificationCountToday(userId),
    isCoachingCategory ? storage.getCoachingNotificationCountToday(userId) : Promise.resolve(0)
  ]);
  
  if (totalNotifications >= MAX_TOTAL_NOTIFICATIONS_PER_DAY) {
    console.log(`[NotificationGen] Total notification limit (${MAX_TOTAL_NOTIFICATIONS_PER_DAY}/day) reached for user ${userId}`);
    return {
      title: CATEGORY_TITLES[category],
      body: '',
      shouldSend: false,
      category,
      suppressionReason: 'total_rate_limit_reached',
    };
  }

  if (isCoachingCategory && coachingNotifications >= MAX_COACHING_NOTIFICATIONS_PER_DAY) {
    console.log(`[NotificationGen] Coaching notification limit (${MAX_COACHING_NOTIFICATIONS_PER_DAY}/day) reached for user ${userId}`);
    return {
      title: CATEGORY_TITLES[category],
      body: '',
      shouldSend: false,
      category,
      suppressionReason: 'coaching_rate_limit_reached',
    };
  }

  const context = await gatherUserContext(userId);
  
  const notificationTypeMap: Record<NotificationCategory, string> = {
    workout_detected: 'workout_detected',
    plan_reminder: 'missed_workout',
    consistency_habit: 'trainer_followup',
    recovery_coaching: 'trainer_followup',
  };
  const lastNotification = await storage.getLastNotificationOfType(userId, notificationTypeMap[category] as any);
  context.lastNotificationOfType = lastNotification?.sentAt || null;
  
  const mergedContext = { ...context, ...overrideContext };

  const suppression = await checkSuppression(userId, category, mergedContext);
  if (suppression.shouldSuppress) {
    console.log(`[NotificationGen] Suppressed ${category} for user ${userId}: ${suppression.reason}`);
    return {
      title: CATEGORY_TITLES[category],
      body: '',
      shouldSend: false,
      category,
      suppressionReason: suppression.reason,
    };
  }

  const prompt = buildPromptForCategory(category, mergedContext);

  try {
    const response = await getOpenRouterClient().chat.completions.create({
      model: 'x-ai/grok-3-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    const generatedBody = response.choices[0]?.message?.content?.trim() || '';

    const validation = validateMessage(generatedBody);
    if (!validation.valid) {
      console.log(`[NotificationGen] Message rejected: ${validation.reason}`);
      return {
        title: CATEGORY_TITLES[category],
        body: '',
        shouldSend: false,
        category,
        suppressionReason: validation.reason,
      };
    }

    console.log(`[NotificationGen] Generated message for ${category}: "${generatedBody}"`);
    return {
      title: CATEGORY_TITLES[category],
      body: generatedBody,
      shouldSend: true,
      category,
    };
  } catch (error) {
    console.error('[NotificationGen] Grok API error:', error);
    return {
      title: CATEGORY_TITLES[category],
      body: '',
      shouldSend: false,
      category,
      suppressionReason: 'grok_api_error',
    };
  }
}

export async function generateWorkoutDetectedMessage(
  userId: string,
  activityName: string
): Promise<GeneratedMessage> {
  return generateNotificationMessage(userId, 'workout_detected', { activityName });
}

export async function generatePlanReminderMessage(
  userId: string,
  workoutName: string
): Promise<GeneratedMessage> {
  return generateNotificationMessage(userId, 'plan_reminder', { 
    plannedWorkoutName: workoutName 
  });
}

export async function generateConsistencyMessage(userId: string): Promise<GeneratedMessage> {
  return generateNotificationMessage(userId, 'consistency_habit');
}

export async function generateRecoveryMessage(userId: string): Promise<GeneratedMessage> {
  return generateNotificationMessage(userId, 'recovery_coaching');
}

export async function generateDailyCoachingMessage(userId: string): Promise<GeneratedMessage> {
  const context = await gatherUserContext(userId);
  
  let category: NotificationCategory = 'consistency_habit';
  
  if (context.hasPlannedWorkoutToday && context.plannedWorkoutName) {
    category = 'plan_reminder';
  } else if (context.recoveryState === 'needs_rest') {
    category = 'recovery_coaching';
  }
  
  return generateNotificationMessage(userId, category);
}
