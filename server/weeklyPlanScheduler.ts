import cron, { ScheduledTask } from 'node-cron';
import { storage } from './storage';
import OpenAI from 'openai';
import type { WeeklyCheckIn } from '@shared/schema';

// OpenRouter client for Grok via Replit AI Integrations
const openrouter = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL!,
});

let cronJob: ScheduledTask | null = null;

export function startWeeklyPlanScheduler() {
  if (cronJob) {
    console.log('[WeeklyPlanScheduler] Already running, skipping duplicate start');
    return;
  }
  
  console.log('[WeeklyPlanScheduler] Starting weekly plan scheduler (Sunday 12:00 AM UTC)');
  
  cronJob = cron.schedule('0 0 * * 0', async () => {
    console.log('[WeeklyPlanScheduler] Sunday midnight - generating weekly plans');
    await generateWeeklyPlansForAllUsers();
  }, {
    timezone: 'UTC'
  });
  
  console.log('[WeeklyPlanScheduler] Scheduled for every Sunday at 00:00 UTC');
  
  setTimeout(async () => {
    console.log('[WeeklyPlanScheduler] Startup check - filling missing current week plans');
    await fillMissingCurrentWeekPlans();
  }, 10000);
}

export function stopWeeklyPlanScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[WeeklyPlanScheduler] Stopped');
  }
}

export async function triggerWeeklyPlansManually() {
  console.log('[WeeklyPlanScheduler] Manual trigger requested');
  await generateWeeklyPlansForAllUsers();
}

export async function generateCurrentWeekPlanForUser(userId: string): Promise<GenerationResult> {
  console.log(`[WeeklyPlanScheduler] Generating current week plan for user ${userId}`);
  return await generateWeekPlanForUser(userId, false);
}

async function generateWeekPlanForUser(userId: string, nextWeek: boolean): Promise<GenerationResult> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { generated: false, reason: 'User not found' };
  }
  
  const coachingPrefs = await storage.getUserCoachingPreferences(userId);
  const workoutLogs = await storage.getWorkoutLogs(userId);
  
  const monday = nextWeek ? getNextMonday() : getCurrentWeekMonday();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  const existingWorkouts = await storage.getScheduledWorkouts(userId, monday, sunday);
  
  const pendingWorkouts = existingWorkouts.filter(w => w.status === 'scheduled');
  if (pendingWorkouts.length > 0) {
    return { generated: false, reason: 'Week already has upcoming scheduled workouts' };
  }
  
  const exercisePerformance = buildExercisePerformanceContext(workoutLogs);
  const allWeekDates = getWeekDates(monday);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const existingDateSet = new Set(
    existingWorkouts.map(w => {
      const d = new Date(w.scheduledDate);
      return d.toISOString().split('T')[0];
    })
  );
  
  const availableDates = allWeekDates.filter(dateStr => {
    const d = new Date(dateStr);
    return d >= today && !existingDateSet.has(dateStr);
  });
  
  if (availableDates.length === 0) {
    return { generated: false, reason: 'No available days remaining this week' };
  }
  
  const workoutDays = coachingPrefs?.preferredWorkoutDays || 4;
  const alreadyDone = existingWorkouts.length;
  const remainingTarget = Math.max(1, workoutDays - alreadyDone);
  const daysToSchedule = Math.min(remainingTarget, availableDates.length);
  
  const goal = coachingPrefs?.primaryGoal || user.fitnessGoal || 'general fitness';
  const experience = coachingPrefs?.experienceLevel || 'intermediate';
  
  const completedContext = existingWorkouts.length > 0 
    ? `\nALREADY COMPLETED THIS WEEK:\n${existingWorkouts.map(w => `- ${w.title} (${w.workoutType}) on ${new Date(w.scheduledDate).toISOString().split('T')[0]}`).join('\n')}\nDo NOT repeat the same muscle groups from completed workouts. Plan complementary sessions.`
    : '';
  
  const prompt = `You are generating remaining workouts for an athlete's week.

ATHLETE INFO:
Name: ${user.firstName || 'Athlete'}
Goal: ${goal}
Experience: ${experience}
Weight: ${user.currentWeight || 'unknown'}kg
Preferred total workout days per week: ${workoutDays}
${completedContext}

${exercisePerformance}

AVAILABLE DATES (only use these dates):
${availableDates.map((d, i) => {
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(d).getDay()];
  return `${dayName}: ${d}`;
}).join('\n')}

Generate a JSON array of ${daysToSchedule} workouts. Each workout must include:
- scheduledDate: ISO date string (ONLY use dates from the available dates above)
- title: Workout name (e.g., "Push Day", "Upper Body", "Leg Day", "Running")
- workoutType: "strength", "running", "cardio", "hiit", "recovery"
- duration: Minutes (number)
- intensity: "low", "moderate", or "high"
- exercises: Array of { name, sets, reps, weight (optional, in kg) } for strength workouts

IMPORTANT:
- ONLY schedule on the available dates listed above
- Space workouts with rest days between hard sessions when possible
- For strength workouts, include 4-6 exercises each with proper sets/reps
- Tailor to their goal: ${goal}
- Start conservatively if no exercise history exists

Return ONLY a valid JSON array of workout objects. No markdown, no explanation.`;

  try {
    const response = await openrouter.chat.completions.create({
      model: 'x-ai/grok-3-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fitness coach generating workout plans. Return only valid JSON arrays.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { generated: false, reason: 'Empty AI response' };
    }
    
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();
    
    const workouts = JSON.parse(cleanedContent);
    
    if (!Array.isArray(workouts)) {
      return { generated: false, reason: 'AI response was not an array' };
    }
    
    let createdCount = 0;
    for (const workout of workouts) {
      if (!workout.scheduledDate || !workout.title) continue;
      
      const scheduledDate = new Date(workout.scheduledDate);
      if (isNaN(scheduledDate.getTime())) continue;
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = dayNames[scheduledDate.getDay()];
      
      const existingWorkout = await storage.findScheduledWorkoutByDateAndTitle(userId, scheduledDate, workout.title);
      if (existingWorkout) continue;
      
      await storage.createScheduledWorkout({
        userId,
        title: workout.title,
        workoutType: workout.workoutType || 'strength',
        activityType: workout.workoutType || 'strength',
        scheduledDate,
        dayOfWeek,
        duration: workout.duration || 60,
        intensity: workout.intensity || 'moderate',
        exercises: workout.exercises || [],
        dataSource: 'ai_generated',
        status: 'scheduled',
        aiGenerated: true,
      });
      createdCount++;
    }
    
    console.log(`[WeeklyPlanScheduler] Created ${createdCount} workouts for user ${userId}`);
    return { generated: true, workoutCount: createdCount };
    
  } catch (error: any) {
    console.error(`[WeeklyPlanScheduler] Error generating plan:`, error.message);
    return { generated: false, reason: error.message };
  }
}

function getCurrentWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function generateWeeklyPlansForAllUsers() {
  try {
    const activeUsers = await storage.getActiveUsers();
    console.log(`[WeeklyPlanScheduler] Found ${activeUsers.length} active users`);
    
    let generated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const user of activeUsers) {
      try {
        const result = await generateNextWeekPlanForUser(user.id);
        if (result.generated) {
          generated++;
          console.log(`[WeeklyPlanScheduler] Generated plan for user ${user.id}: ${result.workoutCount} workouts`);
        } else {
          skipped++;
          console.log(`[WeeklyPlanScheduler] Skipped user ${user.id}: ${result.reason}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[WeeklyPlanScheduler] Error for user ${user.id}:`, error);
        failed++;
      }
    }
    
    console.log(`[WeeklyPlanScheduler] Complete: generated=${generated}, skipped=${skipped}, failed=${failed}`);
    
  } catch (error) {
    console.error('[WeeklyPlanScheduler] Error in weekly plan generation:', error);
  }
}

interface GenerationResult {
  generated: boolean;
  workoutCount?: number;
  reason?: string;
}

async function fillMissingCurrentWeekPlans() {
  try {
    const activeUsers = await storage.getActiveUsers();
    console.log(`[WeeklyPlanScheduler] Startup check: ${activeUsers.length} active users`);
    
    let generated = 0;
    let skipped = 0;
    
    for (const user of activeUsers) {
      try {
        const monday = getCurrentWeekMonday();
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        const existingWorkouts = await storage.getScheduledWorkouts(user.id, monday, sunday);
        if (existingWorkouts.length > 0) {
          skipped++;
          continue;
        }
        
        console.log(`[WeeklyPlanScheduler] User ${user.id} has no workouts this week - generating`);
        const result = await generateWeekPlanForUser(user.id, false);
        if (result.generated) {
          generated++;
          console.log(`[WeeklyPlanScheduler] Auto-generated ${result.workoutCount} workouts for user ${user.id}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[WeeklyPlanScheduler] Startup error for user ${user.id}:`, error);
      }
    }
    
    console.log(`[WeeklyPlanScheduler] Startup check complete: generated=${generated}, already_had_plans=${skipped}`);
  } catch (error) {
    console.error('[WeeklyPlanScheduler] Startup check error:', error);
  }
}

async function generateNextWeekPlanForUser(userId: string): Promise<GenerationResult> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { generated: false, reason: 'User not found' };
  }
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const lastWeekWorkouts = await storage.getScheduledWorkouts(userId, oneWeekAgo, now);
  
  if (lastWeekWorkouts.length === 0) {
    console.log(`[WeeklyPlanScheduler] No previous week workouts for ${userId}, generating fresh plan for next week`);
    return await generateWeekPlanForUser(userId, true);
  }
  
  const nextMonday = getNextMonday();
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);
  
  const existingNextWeekWorkouts = await storage.getScheduledWorkouts(userId, nextMonday, nextSunday);
  if (existingNextWeekWorkouts.length > 0) {
    return { generated: false, reason: 'Next week already has scheduled workouts' };
  }
  
  const workoutLogs = await storage.getWorkoutLogs(userId);
  const coachingPrefs = await storage.getUserCoachingPreferences(userId);
  
  const completedWorkouts = lastWeekWorkouts.filter(w => w.status === 'completed');
  const completionRate = lastWeekWorkouts.length > 0 
    ? completedWorkouts.length / lastWeekWorkouts.length 
    : 0;
  
  const checkIns = await storage.getWeeklyCheckIns(userId, 4);
  let avgRPE = 6;
  let avgSoreness = 5;
  if (checkIns.length > 0) {
    avgRPE = checkIns.reduce((sum: number, c: WeeklyCheckIn) => sum + (c.averageRPE || 6), 0) / checkIns.length;
    avgSoreness = checkIns.reduce((sum: number, c: WeeklyCheckIn) => sum + (c.soreness || 5), 0) / checkIns.length;
  }
  
  const exercisePerformance = buildExercisePerformanceContext(workoutLogs);
  
  const workoutContext = lastWeekWorkouts.map(w => {
    let detail = `${w.title} (${w.workoutType})`;
    if (w.status === 'completed') {
      detail += ` - COMPLETED`;
      if (w.performanceFeedback) {
        detail += ` (felt: ${w.performanceFeedback})`;
      }
    } else {
      detail += ` - NOT COMPLETED`;
    }
    if (w.exercises && Array.isArray(w.exercises)) {
      const exercises = w.exercises as Array<{ name?: string; sets?: number; reps?: string | number; weight?: number }>;
      const exerciseDetails = exercises.slice(0, 5).map(ex => {
        let exStr = ex.name || 'Exercise';
        if (ex.sets && ex.reps) {
          exStr += ` ${ex.sets}x${ex.reps}`;
        }
        if (ex.weight) {
          exStr += ` @ ${ex.weight}kg`;
        }
        return exStr;
      }).join(', ');
      if (exerciseDetails) {
        detail += ` [${exerciseDetails}]`;
      }
    }
    return detail;
  }).join('\n');
  
  let progressionGuidance = '';
  if (completionRate >= 0.8 && avgRPE <= 7.5 && avgSoreness <= 6) {
    progressionGuidance = 'PROGRESSION: Athlete completed most workouts and recovery looks good. Apply progressive overload - increase weights by 2-5% or add reps.';
  } else if (avgRPE >= 8.5 || avgSoreness >= 7) {
    progressionGuidance = 'DELOAD NEEDED: High fatigue signals detected. Reduce volume by 30-40% this week and maintain intensity at moderate level.';
  } else if (completionRate < 0.5) {
    progressionGuidance = 'ADJUST VOLUME: Low completion rate. Reduce number of workouts or simplify the plan to improve adherence.';
  } else {
    progressionGuidance = 'MAINTAIN: Keep similar intensity and volume. Make small adjustments based on individual exercise performance.';
  }
  
  const nextMondayDate = getNextMonday();
  const weekDates = getWeekDates(nextMondayDate);
  
  const prompt = `You are generating next week's workout plan for an athlete. Based on their performance data, create a progressive workout schedule.

ATHLETE INFO:
Name: ${user.firstName || 'Athlete'}
Goal: ${coachingPrefs?.primaryGoal || user.fitnessGoal || 'general fitness'}
Experience: ${coachingPrefs?.experienceLevel || 'intermediate'}
Preferred workout days: ${coachingPrefs?.preferredWorkoutDays || lastWeekWorkouts.length}

LAST WEEK'S WORKOUTS:
${workoutContext}

Completion rate: ${(completionRate * 100).toFixed(0)}%
Average RPE: ${avgRPE.toFixed(1)}/10
Average soreness: ${avgSoreness.toFixed(1)}/10

${exercisePerformance}

${progressionGuidance}

WEEK DATES:
Monday: ${weekDates[0]}
Tuesday: ${weekDates[1]}
Wednesday: ${weekDates[2]}
Thursday: ${weekDates[3]}
Friday: ${weekDates[4]}
Saturday: ${weekDates[5]}
Sunday: ${weekDates[6]}

Generate a JSON array of workouts for next week. Each workout must include:
- scheduledDate: ISO date string (use the dates above)
- title: Workout name
- workoutType: "strength", "running", "cardio", "hiit", "recovery", etc.
- duration: Minutes (number)
- intensity: "low", "moderate", or "high"
- exercises: Array of { name, sets, reps, weight (optional) } for strength workouts

IMPORTANT:
- Apply progressive overload to exercises where the athlete showed good performance
- Reduce load on exercises where they struggled
- Match the number of workout days to what they did last week (unless adjusting for adherence)
- For strength workouts, reference their logged weights and progress appropriately

Return ONLY a valid JSON array of workout objects. No markdown, no explanation.`;

  try {
    const response = await openrouter.chat.completions.create({
      model: 'x-ai/grok-3-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fitness coach generating workout plans. Return only valid JSON arrays.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { generated: false, reason: 'Empty AI response' };
    }
    
    let workouts: any[];
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      workouts = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[WeeklyPlanScheduler] JSON parse error:', parseError);
      return { generated: false, reason: 'Failed to parse AI response' };
    }
    
    if (!Array.isArray(workouts) || workouts.length === 0) {
      return { generated: false, reason: 'Invalid workout array from AI' };
    }
    
    let savedCount = 0;
    for (const workout of workouts) {
      try {
        const scheduledDate = new Date(workout.scheduledDate);
        if (isNaN(scheduledDate.getTime())) {
          console.warn(`[WeeklyPlanScheduler] Invalid date: ${workout.scheduledDate}`);
          continue;
        }
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = dayNames[scheduledDate.getDay()];
        const workoutType = workout.workoutType || 'strength';
        const weekNumber = getISOWeekNumber(scheduledDate);
        const title = workout.title || 'Workout';
        
        // Check for duplicate before creating
        const existingWorkout = await storage.findScheduledWorkoutByDateAndTitle(userId, scheduledDate, title);
        if (existingWorkout) {
          console.log(`[WeeklyPlanScheduler] Skipping duplicate: "${title}" already exists on ${scheduledDate.toDateString()}`);
          continue;
        }
        
        await storage.createScheduledWorkout({
          userId,
          scheduledDate,
          dayOfWeek,
          weekNumber,
          title,
          workoutType,
          activityType: workoutType,
          duration: workout.duration || 60,
          intensity: workout.intensity || 'moderate',
          exercises: workout.exercises || null,
          description: workout.description || null,
          dataSource: 'ai_generated',
          status: 'scheduled',
          aiGenerated: true,
        });
        savedCount++;
      } catch (saveError) {
        console.error(`[WeeklyPlanScheduler] Error saving workout:`, saveError);
      }
    }
    
    return { generated: true, workoutCount: savedCount };
    
  } catch (aiError) {
    console.error('[WeeklyPlanScheduler] AI generation error:', aiError);
    return { generated: false, reason: 'AI generation failed' };
  }
}

function buildExercisePerformanceContext(logs: any[]): string {
  if (!logs || logs.length === 0) {
    return 'EXERCISE HISTORY: No logged workouts yet. This may be their first week.';
  }
  
  const exerciseMap = new Map<string, { weight: number; sets: number; reps: string | number }>();
  
  logs.slice(0, 20).forEach(log => {
    if (log.exercises && Array.isArray(log.exercises)) {
      const exercises = log.exercises as Array<{ name?: string; weight?: number; sets?: number; reps?: string | number }>;
      exercises.forEach(ex => {
        if (ex.name && ex.weight && !exerciseMap.has(ex.name)) {
          exerciseMap.set(ex.name, {
            weight: ex.weight,
            sets: ex.sets || 3,
            reps: ex.reps || '8-10'
          });
        }
      });
    }
  });
  
  if (exerciseMap.size === 0) {
    return 'EXERCISE HISTORY: No weight data logged yet.';
  }
  
  const lines = ['EXERCISE HISTORY (use for progressive overload):'];
  exerciseMap.forEach((data, name) => {
    lines.push(`- ${name}: ${data.sets}x${data.reps} @ ${data.weight}kg`);
  });
  
  return lines.join('\n');
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDates(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}
