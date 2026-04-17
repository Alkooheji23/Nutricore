import { storage } from '../storage';
import { sendPushNotification } from '../pushService';
import type { InsertChatMessage } from '@shared/schema';

interface WorkoutCompletionContext {
  workoutName?: string;
  duration?: number;
  exerciseCount?: number;
  activityType?: string;
}

export async function checkAndNotifyWorkoutCompletion(
  userId: string,
  context: WorkoutCompletionContext
): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return;

    const trainerName = user.trainerPreference === 'female' ? 'Coach Sarah' : 'Coach Mike';
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const recentWorkouts = await storage.getWorkoutLogs(userId, weekAgo, now);
    const weeklyCount = recentWorkouts.length;
    
    const message = generateWorkoutCompletionMessage(
      context,
      weeklyCount,
      user.fitnessGoal || 'health',
      trainerName
    );

    const conversations = await storage.getConversations(userId);
    let conversationId = conversations[0]?.id;
    
    if (!conversationId) {
      const newConversation = await storage.createConversation({ userId, title: 'Trainer Chat' });
      conversationId = newConversation.id;
    }

    const chatMessage: InsertChatMessage = {
      userId,
      conversationId,
      role: 'assistant',
      content: message,
    };

    await storage.createChatMessage(chatMessage);

    await sendPushNotification(userId, {
      title: `${trainerName} 💪`,
      body: getNotificationPreview(context, weeklyCount),
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });

    console.log(`[WorkoutNotification] Sent completion message to user ${userId}`);
  } catch (error) {
    console.error('[WorkoutNotification] Error:', error);
  }
}

function generateWorkoutCompletionMessage(
  context: WorkoutCompletionContext,
  weeklyCount: number,
  goal: string,
  trainerName: string
): string {
  const workoutName = context.workoutName || 'your workout';
  const duration = context.duration ? `${context.duration} minutes` : 'a solid session';
  
  const baseAcknowledgment = getRandomAcknowledgment();
  
  let progressNote = '';
  if (weeklyCount === 1) {
    progressNote = "That's your first workout this week - great start!";
  } else if (weeklyCount === 3) {
    progressNote = "That's 3 workouts this week - you're hitting your stride!";
  } else if (weeklyCount >= 5) {
    progressNote = `${weeklyCount} workouts this week - incredible consistency!`;
  } else if (weeklyCount > 1) {
    progressNote = `Workout #${weeklyCount} this week - keep the momentum going!`;
  }

  let goalTip = '';
  if (goal === 'weight_loss' || goal === 'fat_loss') {
    goalTip = "Every workout is burning calories and building the metabolic engine that'll help you reach your goal.";
  } else if (goal === 'muscle_gain' || goal === 'build_muscle') {
    goalTip = "Those muscles are getting the stimulus they need to grow. Make sure you fuel up with protein within the next hour.";
  } else if (goal === 'strength') {
    goalTip = "Progressive overload is how we get stronger. Track those numbers so we can push them higher next time.";
  } else if (goal === 'endurance' || goal === 'performance') {
    goalTip = "Building that engine! Consistency is key for endurance gains.";
  } else {
    goalTip = "Consistency is the secret ingredient. You're building habits that last.";
  }

  return `${baseAcknowledgment} You just crushed ${workoutName}${context.duration ? ` in ${duration}` : ''}!

${progressNote}

${goalTip}

How are you feeling after that session?`;
}

function getRandomAcknowledgment(): string {
  const acknowledgments = [
    "Nice work! 🔥",
    "Solid effort! 💪",
    "Great job! 🎯",
    "Well done! ⚡",
    "Crushed it! 🏆",
  ];
  return acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
}

function getNotificationPreview(
  context: WorkoutCompletionContext,
  weeklyCount: number
): string {
  const name = context.workoutName || 'Workout';
  if (weeklyCount >= 3) {
    return `${name} complete! That's ${weeklyCount} this week 🔥`;
  }
  return `${name} complete! Great work 💪`;
}
