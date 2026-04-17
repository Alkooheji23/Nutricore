import cron, { ScheduledTask } from 'node-cron';
import { runLearningJob, seedInitialKnowledge } from './trainerLearningService';

let cronJob: ScheduledTask | null = null;

export async function startLearningScheduler() {
  if (cronJob) {
    console.log('[LearningScheduler] Already running, skipping duplicate start');
    return;
  }

  console.log('[LearningScheduler] Starting trainer learning scheduler');

  await seedInitialKnowledge();

  cronJob = cron.schedule('0 3 * * *', async () => {
    console.log('[LearningScheduler] Daily learning job starting (3:00 AM UTC)');
    await runLearningJob('scheduled');
  }, {
    timezone: 'UTC'
  });

  console.log('[LearningScheduler] Scheduled for daily at 03:00 UTC');
}

export function stopLearningScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[LearningScheduler] Stopped');
  }
}

export async function triggerLearningManually() {
  console.log('[LearningScheduler] Manual learning job triggered');
  await runLearningJob('manual');
}
