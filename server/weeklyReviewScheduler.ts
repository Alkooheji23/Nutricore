import cron, { ScheduledTask } from 'node-cron';
import { storage } from './storage';
import { generateWeeklyReview } from './coaching/weeklyReviewService';

let cronJob: ScheduledTask | null = null;

export function startWeeklyReviewScheduler() {
  if (cronJob) {
    console.log('[WeeklyReviewScheduler] Already running, skipping duplicate start');
    return;
  }

  // Every Sunday at 19:00 UTC — after users finish their last workout of the week
  cronJob = cron.schedule('0 19 * * 0', async () => {
    console.log('[WeeklyReviewScheduler] Sunday 19:00 UTC — running weekly reviews');
    await runWeeklyReviewForAllUsers();
  }, { timezone: 'UTC' });

  console.log('[WeeklyReviewScheduler] Scheduled for every Sunday at 19:00 UTC');
}

export function stopWeeklyReviewScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[WeeklyReviewScheduler] Stopped');
  }
}

async function runWeeklyReviewForAllUsers() {
  try {
    const activeUsers = await storage.getActiveUsers();
    console.log(`[WeeklyReviewScheduler] Processing ${activeUsers.length} active users`);

    let succeeded = 0;
    let failed = 0;

    for (const user of activeUsers) {
      try {
        await generateWeeklyReview(user.id);
        succeeded++;
        console.log(`[WeeklyReviewScheduler] Review complete for user ${user.id}`);
        // Stagger requests to avoid hammering the AI API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        console.error(`[WeeklyReviewScheduler] Failed for user ${user.id}:`, error);
      }
    }

    console.log(`[WeeklyReviewScheduler] Done: succeeded=${succeeded}, failed=${failed}`);
  } catch (error) {
    console.error('[WeeklyReviewScheduler] Fatal error:', error);
  }
}
