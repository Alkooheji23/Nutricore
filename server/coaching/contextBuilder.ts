/**
 * COACHING CONTEXT BUILDER
 * Gathers all coaching data and builds context for AI prompts
 */

import { generateTonePrompt, type TonePreference } from './tonePersonalization';
import { adjustVolume, getVolumeRecommendations, type VolumeAdjustmentInput } from './fitnessEngine';
import { resolveSystemState, type SystemInput, formatVerdictOutput } from './unifiedDecisionLayer';
import { formatFlagsForTrainer, type PhysiologicalFlags } from './wearableDataContract';
import type { User, UserCoachingPreferences, WeeklyCheckIn, MuscleVolumeTracking, ExercisePerformanceLog, ScheduledWorkout, WorkoutLog } from '@shared/schema';

export interface CoachingContextData {
  user: User;
  coachingPrefs?: UserCoachingPreferences | null;
  recentCheckIns?: WeeklyCheckIn[];
  muscleVolume?: MuscleVolumeTracking | null;
  recentPerformance?: ExercisePerformanceLog[];
  recentCompletedWorkouts?: ScheduledWorkout[];
  workoutLogs?: WorkoutLog[];
  wearableFlags?: PhysiologicalFlags | null;
  isPremium: boolean;
}

/**
 * Build comprehensive coaching context for AI prompts
 */
export function buildCoachingContext(data: CoachingContextData): string {
  const { user, coachingPrefs, recentCheckIns, muscleVolume, recentPerformance, recentCompletedWorkouts, workoutLogs, wearableFlags, isPremium } = data;
  
  const sections: string[] = [];
  
  // Tone preference
  if (coachingPrefs?.tonePreference) {
    sections.push(generateTonePrompt(coachingPrefs.tonePreference as TonePreference));
  }
  
  // User coaching preferences
  if (coachingPrefs) {
    sections.push(buildPreferencesSection(coachingPrefs));
  }
  
  // COMPLETED WORKOUT LOGS - Critical for week-over-week progress tracking
  if (workoutLogs && workoutLogs.length > 0) {
    sections.push(buildWorkoutLogsSection(workoutLogs));
  }
  
  // DELOAD INDICATORS - Help trainer decide when to recommend a deload
  const deloadSection = buildDeloadIndicatorsSection(workoutLogs || [], recentCheckIns || [], recentCompletedWorkouts || []);
  if (deloadSection) {
    sections.push(deloadSection);
  }
  
  // WEARABLE PHYSIOLOGICAL FLAGS (from Wearable Data Contract)
  // These are directional signals, NOT prescriptions. They modulate decisions.
  if (isPremium && wearableFlags && wearableFlags.overallConfidence !== 'low') {
    sections.push(formatFlagsForTrainer(wearableFlags));
  }
  
  // Weekly check-in data (recovery metrics) - Uses Unified Decision Layer
  if (isPremium && recentCheckIns && recentCheckIns.length > 0) {
    sections.push(buildRecoverySection(
      recentCheckIns, 
      coachingPrefs?.primaryGoal || 'maintenance',
      coachingPrefs?.experienceLevel || 'intermediate'
    ));
  }
  
  // Volume tracking (only for premium)
  if (isPremium && muscleVolume) {
    sections.push(buildVolumeSection(muscleVolume, coachingPrefs?.experienceLevel || 'beginner'));
  }
  
  // Performance trends (only for premium)
  if (isPremium && recentPerformance && recentPerformance.length > 0) {
    sections.push(buildPerformanceSection(recentPerformance));
  }
  
  // Recent workout feedback (for adaptive planning)
  if (recentCompletedWorkouts && recentCompletedWorkouts.length > 0) {
    sections.push(buildWorkoutFeedbackSection(recentCompletedWorkouts));
  }
  
  return sections.length > 0 ? sections.join('\n\n') : '';
}

/**
 * Build preferences section
 */
function buildPreferencesSection(prefs: UserCoachingPreferences): string {
  const lines: string[] = ['ATHLETE COACHING PREFERENCES:'];
  
  if (prefs.injuries && Array.isArray(prefs.injuries) && prefs.injuries.length > 0) {
    lines.push(`- INJURIES (AVOID AGGRAVATING): ${(prefs.injuries as string[]).join(', ')}`);
  }
  
  if (prefs.limitations) {
    lines.push(`- Physical Limitations: ${prefs.limitations}`);
  }
  
  if (prefs.availableEquipment && Array.isArray(prefs.availableEquipment)) {
    lines.push(`- Available Equipment: ${(prefs.availableEquipment as string[]).join(', ')}`);
  }
  
  if (prefs.trainingLocation) {
    lines.push(`- Training Location: ${prefs.trainingLocation}`);
  }
  
  if (prefs.experienceLevel) {
    lines.push(`- Experience Level: ${prefs.experienceLevel}`);
  }
  
  if (prefs.preferredWorkoutDuration) {
    lines.push(`- Preferred Workout Duration: ${prefs.preferredWorkoutDuration} minutes`);
  }
  
  if (prefs.preferredWorkoutDays) {
    lines.push(`- Preferred Training Days/Week: ${prefs.preferredWorkoutDays}`);
  }
  
  if (prefs.primaryGoal) {
    lines.push(`- Primary Goal: ${prefs.primaryGoal.replace(/_/g, ' ')}`);
  }
  
  return lines.join('\n');
}


/**
 * Build recovery section from weekly check-ins
 * Uses the Unified Decision Layer for a single authoritative verdict
 */
function buildRecoverySection(checkIns: WeeklyCheckIn[], goal?: string, experienceLevel?: string): string {
  const avgSoreness = average(checkIns.map(c => c.soreness || 5));
  const avgSleep = average(checkIns.map(c => c.sleepQuality || 5));
  const avgEnergy = average(checkIns.map(c => c.energyLevel || 5));
  const avgRPE = average(checkIns.map(c => c.averageRPE || 6));
  const avgStress = average(checkIns.map(c => c.stressLevel || 5));
  
  const systemInput: SystemInput = {
    physiological: {
      soreness: avgSoreness,
      sleepQuality: avgSleep,
      stressLevel: avgStress,
      energyLevel: avgEnergy,
    },
    performance: {
      averageRPE: avgRPE,
      performanceTrend: null,
      weeksSinceDeload: 0,
      recentWorkloadTrend: 'stable',
    },
    context: {
      goal: goal || 'maintenance',
      experienceLevel: experienceLevel || 'intermediate',
    },
  };
  
  const verdict = resolveSystemState(systemInput);
  const statusIcon = verdict.status === 'increase' ? '📈' : 
                     verdict.status === 'reduce' ? '📉' : 
                     verdict.status === 'deload' ? '🛋️' : 
                     verdict.status === 'recover' ? '🔴' : '➡️';
  
  return `ATHLETE RECOVERY STATUS (from recent check-ins):
- Average Soreness: ${avgSoreness.toFixed(1)}/10 ${getSorenessIndicator(avgSoreness)}
- Average Sleep Quality: ${avgSleep.toFixed(1)}/10 ${getSleepIndicator(avgSleep)}
- Average Energy: ${avgEnergy.toFixed(1)}/10
- Average Training RPE: ${avgRPE.toFixed(1)}/10

COACHING GUIDANCE (internal - do not expose to user):
Current recommendation: ${verdict.verdict}
Current status: ${statusIcon} ${verdict.status}
Apply this guidance to your coaching decisions without referencing it directly.`;
}

/**
 * Build volume tracking section
 */
function buildVolumeSection(volume: MuscleVolumeTracking, experienceLevel: string): string {
  const recs = getVolumeRecommendations(experienceLevel);
  
  const volumeData = [
    { name: 'Chest', sets: volume.chestSets || 0, rec: recs.chest },
    { name: 'Back', sets: volume.backSets || 0, rec: recs.back },
    { name: 'Shoulders', sets: volume.shouldersSets || 0, rec: recs.shoulders },
    { name: 'Biceps', sets: volume.bicepsSets || 0, rec: recs.biceps },
    { name: 'Triceps', sets: volume.tricepsSets || 0, rec: recs.triceps },
    { name: 'Quads', sets: volume.quadsSets || 0, rec: recs.quads },
    { name: 'Hamstrings', sets: volume.hamstringsSets || 0, rec: recs.hamstrings },
    { name: 'Glutes', sets: volume.glutesSets || 0, rec: recs.glutes },
  ];
  
  const volumeLines = volumeData.map(v => {
    const status = v.sets < v.rec.min ? '⬇️ Low' : v.sets > v.rec.max ? '⬆️ High' : '✅ Good';
    return `- ${v.name}: ${v.sets} sets (target: ${v.rec.min}-${v.rec.max}) ${status}`;
  });
  
  return `THIS WEEK'S TRAINING VOLUME (sets per muscle group):
${volumeLines.join('\n')}
- Cardio: ${volume.cardioMinutes || 0} minutes

Adjust recommendations based on volume status. Low volume muscles need more work, high volume may need recovery.`;
}

/**
 * Build performance section from exercise logs
 */
function buildPerformanceSection(logs: ExercisePerformanceLog[]): string {
  // Group by exercise and get most recent for each
  const exerciseMap = new Map<string, ExercisePerformanceLog>();
  logs.forEach(log => {
    if (!exerciseMap.has(log.exerciseName) || 
        (log.performedAt && exerciseMap.get(log.exerciseName)!.performedAt && 
         new Date(log.performedAt) > new Date(exerciseMap.get(log.exerciseName)!.performedAt!))) {
      exerciseMap.set(log.exerciseName, log);
    }
  });
  
  const recentExercises = Array.from(exerciseMap.values()).slice(0, 5);
  
  if (recentExercises.length === 0) {
    return '';
  }
  
  const exerciseLines = recentExercises.map(ex => {
    const weights = ex.weight as number[] | null;
    const reps = ex.reps as number[] | null;
    const weight = weights ? Math.max(...weights) : 0;
    const repRange = reps ? `${Math.min(...reps)}-${Math.max(...reps)}` : '?';
    return `- ${ex.exerciseName}: ${ex.sets}x${repRange} @ ${weight}${ex.weightUnit || 'kg'} (RPE: ${ex.rpe || '?'})`;
  });
  
  return `RECENT EXERCISE PERFORMANCE:
${exerciseLines.join('\n')}

Use this data for progressive overload recommendations. Suggest appropriate weight/rep increases based on RPE.`;
}

/**
 * Build workout logs section - shows athlete's completed workout history
 * This is CRITICAL for the trainer to see what the athlete has actually done
 */
function buildWorkoutLogsSection(logs: WorkoutLog[]): string {
  const lines: string[] = ['ATHLETE\'S COMPLETED WORKOUT HISTORY (most recent first):'];
  
  const recentLogs = logs.slice(0, 10);
  
  recentLogs.forEach(log => {
    const dateStr = log.date ? new Date(log.date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }) : 'Unknown date';
    
    const title = log.workoutName || log.activityType || 'Workout';
    const duration = log.duration ? `${log.duration}min` : '';
    const calories = log.caloriesBurned ? `${log.caloriesBurned} cal` : '';
    const source = log.source || 'manual';
    
    let logLine = `- ${dateStr}: ${title}`;
    
    if (duration || calories) {
      logLine += ` (${[duration, calories].filter(Boolean).join(', ')})`;
    }
    
    if (log.exercises && Array.isArray(log.exercises) && log.exercises.length > 0) {
      const exercises = log.exercises as Array<{ name?: string; sets?: number; reps?: number | number[]; weight?: number }>;
      const exerciseNames = exercises
        .slice(0, 5)
        .map(ex => {
          if (ex.name && ex.sets && ex.weight) {
            const repsStr = Array.isArray(ex.reps) ? ex.reps.join('/') : ex.reps;
            return `${ex.name} ${ex.sets}x${repsStr} @ ${ex.weight}kg`;
          }
          return ex.name || 'exercise';
        })
        .join(', ');
      if (exerciseNames) {
        logLine += ` [${exerciseNames}]`;
      }
    }
    
    if (log.notes) {
      logLine += ` - Notes: "${log.notes.slice(0, 50)}${log.notes.length > 50 ? '...' : ''}"`;
    }
    
    logLine += ` (source: ${source})`;
    lines.push(logLine);
  });
  
  if (logs.length > 10) {
    lines.push(`... and ${logs.length - 10} more workouts in history`);
  }
  
  lines.push('');
  lines.push('Use this workout history to understand what the athlete has been doing. Reference specific workouts when discussing progress or suggesting improvements.');
  
  return lines.join('\n');
}

// Helper functions
function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getSorenessIndicator(soreness: number): string {
  if (soreness <= 3) return '(minimal)';
  if (soreness <= 5) return '(moderate)';
  if (soreness <= 7) return '(elevated - consider lighter training)';
  return '(high - recommend recovery)';
}

function getSleepIndicator(sleep: number): string {
  if (sleep >= 8) return '(excellent)';
  if (sleep >= 6) return '(good)';
  if (sleep >= 4) return '(fair - recovery may be impacted)';
  return '(poor - prioritize sleep)';
}

function mapActivityLevel(level: string | null | undefined): string {
  if (!level) return 'moderately_active';
  const normalized = level.toLowerCase().replace(/\s+/g, '_');
  const mapping: Record<string, string> = {
    'sedentary': 'sedentary',
    'lightly_active': 'lightly_active',
    'moderately_active': 'moderately_active',
    'very_active': 'very_active',
    'extremely_active': 'extremely_active',
  };
  return mapping[normalized] || 'moderately_active';
}

function mapGoal(goal: string | null | undefined): string {
  if (!goal) return 'maintenance';
  const normalized = goal.toLowerCase();
  if (normalized.includes('lose') || normalized.includes('weight loss') || normalized.includes('fat')) {
    return 'fat_loss';
  }
  if (normalized.includes('muscle') || normalized.includes('build') || normalized.includes('bulk')) {
    return 'muscle_gain';
  }
  if (normalized.includes('strength') || normalized.includes('strong')) {
    return 'strength';
  }
  if (normalized.includes('endurance') || normalized.includes('cardio')) {
    return 'endurance';
  }
  if (normalized.includes('maintain') || normalized.includes('maintain')) {
    return 'maintenance';
  }
  return 'maintenance';
}

/**
 * Build workout feedback section for adaptive planning
 * This helps the AI understand how the athlete is responding to training
 */
function buildWorkoutFeedbackSection(workouts: ScheduledWorkout[]): string {
  const workoutsWithFeedback = workouts.filter(w => w.performanceFeedback);
  
  if (workoutsWithFeedback.length === 0) {
    return '';
  }
  
  const lines: string[] = ['RECENT WORKOUT FEEDBACK (for adaptive planning):'];
  
  const feedbackCounts = {
    easy: 0,
    moderate: 0,
    hard: 0
  };
  
  workoutsWithFeedback.forEach(w => {
    const feedback = w.performanceFeedback as 'easy' | 'moderate' | 'hard';
    feedbackCounts[feedback]++;
    
    const completedDate = w.completedAt ? new Date(w.completedAt).toLocaleDateString() : 'recently';
    lines.push(`- ${w.title} (${w.workoutType || 'workout'}) on ${completedDate}: ${feedback.toUpperCase()}`);
  });
  
  lines.push('');
  lines.push('FEEDBACK SUMMARY:');
  lines.push(`- Too Easy: ${feedbackCounts.easy} workouts`);
  lines.push(`- Just Right: ${feedbackCounts.moderate} workouts`);
  lines.push(`- Too Hard: ${feedbackCounts.hard} workouts`);
  
  if (feedbackCounts.easy > feedbackCounts.hard && feedbackCounts.easy > feedbackCounts.moderate) {
    lines.push('');
    lines.push('RECOMMENDATION: Athlete is finding workouts too easy. Consider INCREASING intensity, volume, or weight for next week.');
  } else if (feedbackCounts.hard > feedbackCounts.easy && feedbackCounts.hard > feedbackCounts.moderate) {
    lines.push('');
    lines.push('RECOMMENDATION: Athlete is struggling with workouts. Consider REDUCING intensity or volume, or adding more recovery time.');
  } else if (feedbackCounts.moderate >= feedbackCounts.easy && feedbackCounts.moderate >= feedbackCounts.hard) {
    lines.push('');
    lines.push('RECOMMENDATION: Training load is appropriate. Maintain current intensity with small progressive increases.');
  }
  
  return lines.join('\n');
}

/**
 * Build deload indicators section - helps trainer decide when to recommend a deload
 * Surfaces explicit metrics so the AI can make informed decisions
 */
function buildDeloadIndicatorsSection(
  workoutLogs: WorkoutLog[],
  checkIns: WeeklyCheckIn[],
  completedWorkouts: ScheduledWorkout[]
): string {
  const lines: string[] = ['DELOAD INDICATORS (use to decide if athlete needs recovery):'];
  let hasSignificantData = false;
  
  // 1. Calculate truly consecutive weeks of training (back-to-back, no gaps)
  // Use 10-week lookback to detect 5-6+ consecutive weeks
  const now = new Date();
  const tenWeeksAgo = new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000);
  const recentWorkouts = workoutLogs.filter(log => {
    const logDate = log.date ? new Date(log.date) : null;
    return logDate && logDate >= tenWeeksAgo;
  });
  
  // Get ISO week number AND ISO week year (handles year boundaries correctly)
  const getISOWeekAndYear = (date: Date): { week: number; year: number } => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    // The ISO week year is the year of the Thursday of that week
    const isoYear = d.getUTCFullYear();
    return { week, year: isoYear };
  };
  
  const getWeekKey = (date: Date): string => {
    const { week, year } = getISOWeekAndYear(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  };
  
  // Collect all weeks with workouts
  const weeksWithWorkouts = new Set<string>();
  recentWorkouts.forEach(log => {
    if (log.date) {
      weeksWithWorkouts.add(getWeekKey(new Date(log.date)));
    }
  });
  
  // Calculate truly consecutive weeks counting backwards from current week
  let consecutiveWeeks = 0;
  const currentWeekKey = getWeekKey(now);
  let checkDate = new Date(now);
  
  // Start from current week and count backwards
  for (let i = 0; i < 10; i++) {
    const weekKey = getWeekKey(checkDate);
    if (weeksWithWorkouts.has(weekKey)) {
      consecutiveWeeks++;
      // Move to previous week
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      // Gap found - stop counting
      break;
    }
  }
  
  if (consecutiveWeeks >= 3) {
    lines.push(`- Consecutive training weeks: ${consecutiveWeeks} weeks (no gaps)`);
    if (consecutiveWeeks >= 5) {
      lines.push(`  ⚠️ CONSIDER DELOAD: ${consecutiveWeeks} consecutive weeks of training`);
    }
    if (consecutiveWeeks >= 6) {
      lines.push(`  🔴 DELOAD STRONGLY RECOMMENDED: ${consecutiveWeeks}+ weeks without a break`);
    }
    hasSignificantData = true;
  }
  
  // 2. Check for performance stalls (same exercise, no weight progress)
  // Group by exercise and look for plateaus
  const exerciseHistory = new Map<string, { weight: number; date: Date }[]>();
  recentWorkouts.forEach(log => {
    if (log.exercises && Array.isArray(log.exercises) && log.date) {
      const exercises = log.exercises as Array<{ name?: string; weight?: number }>;
      exercises.forEach(ex => {
        if (ex.name && ex.weight) {
          if (!exerciseHistory.has(ex.name)) {
            exerciseHistory.set(ex.name, []);
          }
          exerciseHistory.get(ex.name)!.push({ weight: ex.weight, date: new Date(log.date!) });
        }
      });
    }
  });
  
  // Look for exercises with 3+ sessions at same weight
  const stalledExercises: string[] = [];
  exerciseHistory.forEach((history, exerciseName) => {
    if (history.length >= 3) {
      const sortedHistory = history.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);
      const weights = sortedHistory.map(h => h.weight);
      const allSame = weights.every(w => w === weights[0]);
      if (allSame) {
        stalledExercises.push(exerciseName);
      }
    }
  });
  
  if (stalledExercises.length > 0) {
    lines.push(`- Performance plateau detected on: ${stalledExercises.slice(0, 3).join(', ')}`);
    lines.push(`  ⚠️ No weight progress for 3+ sessions - may benefit from deload`);
    hasSignificantData = true;
  }
  
  // 3. Fatigue metrics from check-ins
  if (checkIns.length >= 2) {
    const recentCheckIns = checkIns.slice(0, 4);
    const avgSoreness = average(recentCheckIns.map(c => c.soreness || 5));
    const avgEnergy = average(recentCheckIns.map(c => c.energyLevel || 5));
    const avgSleep = average(recentCheckIns.map(c => c.sleepQuality || 5));
    const avgRPE = average(recentCheckIns.map(c => c.averageRPE || 6));
    
    lines.push(`- Rolling fatigue metrics (last ${recentCheckIns.length} check-ins):`);
    lines.push(`  Avg soreness: ${avgSoreness.toFixed(1)}/10 ${avgSoreness >= 7 ? '⚠️ HIGH' : ''}`);
    lines.push(`  Avg energy: ${avgEnergy.toFixed(1)}/10 ${avgEnergy <= 4 ? '⚠️ LOW' : ''}`);
    lines.push(`  Avg sleep: ${avgSleep.toFixed(1)}/10 ${avgSleep <= 4 ? '⚠️ POOR' : ''}`);
    lines.push(`  Avg training RPE: ${avgRPE.toFixed(1)}/10 ${avgRPE >= 8.5 ? '⚠️ VERY HIGH' : ''}`);
    
    // Count deload warning signals
    let warningCount = 0;
    if (avgSoreness >= 7) warningCount++;
    if (avgEnergy <= 4) warningCount++;
    if (avgSleep <= 4) warningCount++;
    if (avgRPE >= 8.5) warningCount++;
    
    if (warningCount >= 2) {
      lines.push(`  🔴 DELOAD RECOMMENDED: ${warningCount} fatigue indicators are elevated`);
    } else if (warningCount === 1) {
      lines.push(`  ⚠️ Monitor closely: 1 fatigue indicator elevated`);
    }
    
    hasSignificantData = true;
  }
  
  // 4. Check workout feedback for "too hard" pattern
  const hardFeedbackCount = completedWorkouts.filter(w => w.performanceFeedback === 'hard').length;
  const totalFeedback = completedWorkouts.filter(w => w.performanceFeedback).length;
  
  if (totalFeedback >= 3 && hardFeedbackCount >= Math.floor(totalFeedback * 0.6)) {
    lines.push(`- Workout difficulty trend: ${hardFeedbackCount}/${totalFeedback} recent workouts rated "too hard"`);
    lines.push(`  ⚠️ Majority of workouts feel too difficult - consider deload`);
    hasSignificantData = true;
  }
  
  // Summary recommendation
  if (hasSignificantData) {
    lines.push('');
    lines.push('ACTION: Review these indicators before prescribing more progression. If multiple warnings are present, propose a deload week.');
    return lines.join('\n');
  }
  
  // Return empty if no significant data to report
  return '';
}

/**
 * TRAINER CONTEXT HYDRATION LAYER
 * Comprehensive context builder that pulls ALL user data for every AI message
 * This ensures the trainer is always aware of the current state without relying on chat memory
 */
export interface TrainerContextData {
  userId: string;
  firstName: string;
  age: number | null;
  gender: string | null;
  currentWeight: number | null;
  height: number | null;
  fitnessGoal: string | null;
  activityLevel: string | null;
  weightHistory: Array<{ date: string; weight: number }>;
  connectedDevices: Array<{ provider: string; lastSyncAt: Date | null }>;
  primaryDevice: string | null;
  recentWorkouts: Array<{
    date: string;
    name: string;
    type: string;
    duration: number | null;
    calories: number | null;
    source: string;
    exercises?: any[];
  }>;
  wearableActivities: Array<{
    date: string;
    name: string;
    type: string;
    duration: number | null;
    calories: number | null;
    source: string;
    steps?: number | null;
    distance?: number | null;
    avgHeartRate?: number | null;
  }>;
  recoveryData: {
    sleepQuality: number | null;
    soreness: number | null;
    energyLevel: number | null;
    stressLevel: number | null;
    avgRPE: number | null;
    hrvScore: number | null;
  } | null;
  todayActivity: {
    steps: number | null;
    caloriesBurned: number | null;
    activeMinutes: number | null;
  } | null;
  currentDietPlan: {
    dailyCalories: number;
    macros: { protein: number; carbs: number; fats: number };
    contextLabel: string | null;
  } | null;
  upcomingWorkouts: Array<{
    date: string;
    dayOfWeek: string;
    title: string;
    type: string;
    status: string;
  }>;
  isPremium: boolean;
  
  // Extended data sources for comprehensive visibility
  bodyMeasurements: Array<{
    date: string;
    waist?: number | null;
    chest?: number | null;
    hips?: number | null;
    thighs?: number | null;
    arms?: number | null;
    bodyFat?: number | null;
  }>;
  recentFoodLogs: Array<{
    date: string;
    mealType: string;
    totalCalories: number;
    protein: number;
    carbs: number;
    fats: number;
    foods: string[];
  }>;
  nutritionAdherence: {
    avgDailyCalories: number;
    targetCalories: number;
    adherencePercent: number;
    daysTracked: number;
  } | null;
  activityHistory: Array<{
    date: string;
    steps: number;
    caloriesBurned: number;
    activeMinutes: number;
  }>;
  goalEvaluation: {
    weekStart: string;
    primaryGoal: string;
    verdict: string;
    adjustments: any;
    metricsSnapshot: any;
  } | null;
  workoutConsistency: {
    completedThisWeek: number;
    scheduledThisWeek: number;
    completionRate: number;
    avgWorkoutsPerWeek: number;
    streak: number;
  };
  weightAnalysis: {
    weeklyAverage: number | null;
    twoWeekAverage: number | null;
    monthlyChange: number | null;
    weeklyRateOfChange: number | null;
    trend: 'gaining' | 'losing' | 'stable' | 'unknown';
  };
}

/**
 * Format trainer context into a structured prompt section
 */
export function formatTrainerContext(ctx: TrainerContextData): string {
  const sections: string[] = [];
  
  // CURRENT BODY METRICS
  const bodyLines: string[] = ['CURRENT BODY METRICS (SOURCE OF TRUTH):'];
  bodyLines.push(`- Weight: ${ctx.currentWeight ? `${ctx.currentWeight} kg` : 'Not recorded'}`);
  bodyLines.push(`- Height: ${ctx.height ? `${ctx.height} cm` : 'Not recorded'}`);
  bodyLines.push(`- Age: ${ctx.age || 'Not recorded'}`);
  bodyLines.push(`- Gender: ${ctx.gender || 'Not specified'}`);
  
  if (ctx.weightHistory.length > 1) {
    const recentWeights = ctx.weightHistory.slice(0, 5);
    const weightTrend = recentWeights.map(w => `${w.date}: ${w.weight}kg`).join(', ');
    bodyLines.push(`- Recent Weight History: ${weightTrend}`);
    
    if (recentWeights.length >= 2) {
      const latestWeight = recentWeights[0].weight;
      const oldestWeight = recentWeights[recentWeights.length - 1].weight;
      const change = latestWeight - oldestWeight;
      if (Math.abs(change) >= 0.5) {
        bodyLines.push(`- Weight Trend: ${change > 0 ? 'Gaining' : 'Losing'} (${Math.abs(change).toFixed(1)}kg change)`);
      }
    }
  }
  sections.push(bodyLines.join('\n'));
  
  // GOALS & ACTIVITY LEVEL
  if (ctx.fitnessGoal || ctx.activityLevel) {
    const goalLines: string[] = ['ATHLETE GOALS & LIFESTYLE:'];
    if (ctx.fitnessGoal) goalLines.push(`- Primary Goal: ${ctx.fitnessGoal}`);
    if (ctx.activityLevel) goalLines.push(`- Activity Level: ${ctx.activityLevel}`);
    sections.push(goalLines.join('\n'));
  }
  
  // DEVICE SYNC STATUS
  if (ctx.connectedDevices.length > 0) {
    const deviceLines: string[] = ['CONNECTED DEVICES:'];
    for (const device of ctx.connectedDevices) {
      const lastSync = device.lastSyncAt 
        ? new Date(device.lastSyncAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Never synced';
      const isPrimary = device.provider === ctx.primaryDevice ? ' (PRIMARY)' : '';
      deviceLines.push(`- ${device.provider.charAt(0).toUpperCase() + device.provider.slice(1)}${isPrimary}: Last sync ${lastSync}`);
    }
    sections.push(deviceLines.join('\n'));
  }
  
  // CURRENT DIET PLAN
  if (ctx.currentDietPlan) {
    const dietLines: string[] = ['CURRENT DIET PLAN (TRAINER-CONFIRMED):'];
    dietLines.push(`- Daily Calories: ${ctx.currentDietPlan.dailyCalories} kcal`);
    dietLines.push(`- Protein: ${ctx.currentDietPlan.macros.protein}g`);
    dietLines.push(`- Carbs: ${ctx.currentDietPlan.macros.carbs}g`);
    dietLines.push(`- Fats: ${ctx.currentDietPlan.macros.fats}g`);
    if (ctx.currentDietPlan.contextLabel) {
      dietLines.push(`- Plan Context: ${ctx.currentDietPlan.contextLabel}`);
    }
    sections.push(dietLines.join('\n'));
  } else {
    sections.push('DIET PLAN: None confirmed yet. Athlete needs personalized nutrition targets.');
  }
  
  // TODAY'S ACTIVITY
  if (ctx.todayActivity && (ctx.todayActivity.steps || ctx.todayActivity.caloriesBurned)) {
    const activityLines: string[] = ["TODAY'S ACTIVITY:"];
    if (ctx.todayActivity.steps) activityLines.push(`- Steps: ${ctx.todayActivity.steps.toLocaleString()}`);
    if (ctx.todayActivity.caloriesBurned) activityLines.push(`- Calories Burned: ${ctx.todayActivity.caloriesBurned}`);
    if (ctx.todayActivity.activeMinutes) activityLines.push(`- Active Minutes: ${ctx.todayActivity.activeMinutes}`);
    sections.push(activityLines.join('\n'));
  }
  
  // RECOVERY STATUS
  if (ctx.recoveryData) {
    const recoveryLines: string[] = ['RECOVERY STATUS:'];
    if (ctx.recoveryData.sleepQuality !== null) {
      recoveryLines.push(`- Sleep Quality: ${ctx.recoveryData.sleepQuality}/10 ${getSleepIndicator(ctx.recoveryData.sleepQuality)}`);
    }
    if (ctx.recoveryData.soreness !== null) {
      recoveryLines.push(`- Soreness: ${ctx.recoveryData.soreness}/10 ${getSorenessIndicator(ctx.recoveryData.soreness)}`);
    }
    if (ctx.recoveryData.energyLevel !== null) {
      recoveryLines.push(`- Energy Level: ${ctx.recoveryData.energyLevel}/10`);
    }
    if (ctx.recoveryData.hrvScore !== null) {
      recoveryLines.push(`- HRV Score: ${ctx.recoveryData.hrvScore}`);
    }
    if (recoveryLines.length > 1) {
      sections.push(recoveryLines.join('\n'));
    }
  }
  
  // RECENT STRENGTH WORKOUTS WITH EXERCISE DETAILS (for progressive overload)
  // Only include workout logs that have exercise data - separate from wearable cardio activities
  const strengthWorkouts = ctx.recentWorkouts
    .filter(w => {
      const exercises = (w as any).exercises;
      return exercises && Array.isArray(exercises) && exercises.length > 0;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
  
  if (strengthWorkouts.length > 0) {
    const workoutLines: string[] = ['RECENT STRENGTH WORKOUTS WITH EXERCISE DETAILS (use these for progressive overload):'];
    for (const w of strengthWorkouts) {
      const dateStr = new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let line = `\n- ${dateStr}: ${w.name} (${w.type})`;
      if (w.duration) line += ` ${w.duration}min`;
      line += ` [${w.source}]`;
      workoutLines.push(line);
      
      const exercises = (w as any).exercises as any[];
      for (const ex of exercises) {
        if (ex.name) {
          let exLine = `    * ${ex.name}:`;
          let hasData = false;
          
          // Handle setsData array format (detailed set-by-set data from live tracking)
          if (ex.setsData && Array.isArray(ex.setsData) && ex.setsData.length > 0) {
            const setDetails = ex.setsData.map((s: any) => {
              const reps = s.reps || '?';
              const weight = s.weight ?? s.load ?? s.weightUsed ?? null;
              return weight !== null ? `${reps}@${weight}kg` : `${reps}reps`;
            }).join(', ');
            exLine += ` ${ex.setsData.length} sets (${setDetails})`;
            hasData = true;
          }
          // Handle sets array format (from scheduled workouts or alternative format)
          else if (ex.sets && Array.isArray(ex.sets)) {
            const setDetails = ex.sets.map((s: any) => {
              const reps = s.reps || '?';
              const weight = s.weight ?? s.load ?? s.weightUsed ?? null;
              return weight !== null ? `${reps}@${weight}kg` : `${reps}reps`;
            }).join(', ');
            exLine += ` ${ex.sets.length} sets (${setDetails})`;
            hasData = true;
          }
          // Handle simple format (sets x reps @ weight) - sets is a number
          else if (typeof ex.sets === 'number' && ex.reps) {
            const repsStr = Array.isArray(ex.reps) ? ex.reps.join('/') : ex.reps;
            exLine += ` ${ex.sets}x${repsStr}`;
            // Check multiple possible weight field names
            const weight = ex.weight ?? ex.load ?? ex.weightUsed ?? ex.targetWeight ?? null;
            if (weight !== null) exLine += ` @ ${weight}kg`;
            hasData = true;
          }
          
          if (hasData) {
            if (ex.completed !== undefined) {
              exLine += ex.completed ? ' ✓' : ' (incomplete)';
            }
            workoutLines.push(exLine);
          }
        }
      }
    }
    workoutLines.push('\nUSE THESE NUMBERS: When creating next week\'s plan, reference the weights above. Apply sensible progression (2.5-5kg upper body, 5-10kg lower body).');
    sections.push(workoutLines.join('\n'));
  }
  
  // RECENT CARDIO/WEARABLE ACTIVITIES (no exercise details available)
  const cardioActivities = [
    ...ctx.recentWorkouts.filter(w => {
      const exercises = (w as any).exercises;
      return !exercises || !Array.isArray(exercises) || exercises.length === 0;
    }),
    ...ctx.wearableActivities
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  
  if (cardioActivities.length > 0) {
    const activityLines: string[] = ['RECENT CARDIO/ACTIVITY (from wearables and logged activities):'];
    for (const w of cardioActivities) {
      const dateStr = new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let line = `- ${dateStr}: ${w.name} (${w.type})`;
      if (w.duration) line += ` ${w.duration}min`;
      if (w.calories) line += ` ${w.calories}cal`;
      const wearable = w as any;
      if (wearable.distance) line += ` ${wearable.distance}km`;
      if (wearable.avgHeartRate) line += ` avg HR ${wearable.avgHeartRate}bpm`;
      line += ` [${w.source}]`;
      activityLines.push(line);
    }
    sections.push(activityLines.join('\n'));
  }
  
  if (strengthWorkouts.length === 0 && cardioActivities.length === 0) {
    sections.push('RECENT WORKOUTS: None recorded yet. When creating workout plans, start with conservative weights and ask the athlete to log their actual performance.');
  }
  
  // UPCOMING SCHEDULED WORKOUTS
  if (ctx.upcomingWorkouts.length > 0) {
    const scheduleLines: string[] = ['UPCOMING SCHEDULED WORKOUTS:'];
    for (const w of ctx.upcomingWorkouts.slice(0, 7)) {
      const dateStr = new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      scheduleLines.push(`- ${dateStr}: ${w.title} (${w.type}) - ${w.status}`);
    }
    sections.push(scheduleLines.join('\n'));
  }
  
  // BODY COMPOSITION / MEASUREMENTS
  if (ctx.bodyMeasurements && ctx.bodyMeasurements.length > 0) {
    const measureLines: string[] = ['BODY MEASUREMENTS (most recent):'];
    const latest = ctx.bodyMeasurements[0];
    measureLines.push(`- Date: ${latest.date}`);
    if (latest.waist) measureLines.push(`- Waist: ${latest.waist} cm`);
    if (latest.chest) measureLines.push(`- Chest: ${latest.chest} cm`);
    if (latest.hips) measureLines.push(`- Hips: ${latest.hips} cm`);
    if (latest.thighs) measureLines.push(`- Thighs: ${latest.thighs} cm`);
    if (latest.arms) measureLines.push(`- Arms: ${latest.arms} cm`);
    if (latest.bodyFat) measureLines.push(`- Body Fat: ${latest.bodyFat}%`);
    sections.push(measureLines.join('\n'));
  }
  
  // NUTRITION TRACKING
  if (ctx.recentFoodLogs && ctx.recentFoodLogs.length > 0) {
    const nutritionLines: string[] = ['RECENT NUTRITION (last 7 days):'];
    
    // Group by date and show daily totals
    const dailyTotals = new Map<string, { calories: number; protein: number; carbs: number; fats: number }>();
    for (const log of ctx.recentFoodLogs) {
      if (!dailyTotals.has(log.date)) {
        dailyTotals.set(log.date, { calories: 0, protein: 0, carbs: 0, fats: 0 });
      }
      const totals = dailyTotals.get(log.date)!;
      totals.calories += log.totalCalories;
      totals.protein += log.protein;
      totals.carbs += log.carbs;
      totals.fats += log.fats;
    }
    
    for (const [date, totals] of Array.from(dailyTotals.entries()).slice(0, 5)) {
      nutritionLines.push(`- ${date}: ${totals.calories}kcal (P:${totals.protein}g C:${totals.carbs}g F:${totals.fats}g)`);
    }
    
    if (ctx.nutritionAdherence) {
      nutritionLines.push(`\nNUTRITION ADHERENCE:`);
      nutritionLines.push(`- Avg Daily Calories: ${ctx.nutritionAdherence.avgDailyCalories} kcal`);
      nutritionLines.push(`- Target Calories: ${ctx.nutritionAdherence.targetCalories} kcal`);
      nutritionLines.push(`- Adherence: ${ctx.nutritionAdherence.adherencePercent}%`);
      nutritionLines.push(`- Days Tracked: ${ctx.nutritionAdherence.daysTracked}`);
    }
    sections.push(nutritionLines.join('\n'));
  }
  
  // ACTIVITY HISTORY (STEPS/CALORIES)
  if (ctx.activityHistory && ctx.activityHistory.length > 0) {
    const activityLines: string[] = ['ACTIVITY HISTORY (last 7 days):'];
    for (const day of ctx.activityHistory.slice(0, 7)) {
      activityLines.push(`- ${day.date}: ${day.steps.toLocaleString()} steps, ${day.caloriesBurned}kcal burned, ${day.activeMinutes}min active`);
    }
    sections.push(activityLines.join('\n'));
  }
  
  // WORKOUT CONSISTENCY
  if (ctx.workoutConsistency) {
    const consistencyLines: string[] = ['WORKOUT CONSISTENCY:'];
    consistencyLines.push(`- This Week: ${ctx.workoutConsistency.completedThisWeek}/${ctx.workoutConsistency.scheduledThisWeek} workouts completed (${ctx.workoutConsistency.completionRate}%)`);
    consistencyLines.push(`- Avg Per Week (4-week): ${ctx.workoutConsistency.avgWorkoutsPerWeek} workouts`);
    consistencyLines.push(`- Current Streak: ${ctx.workoutConsistency.streak} consecutive days`);
    sections.push(consistencyLines.join('\n'));
  }
  
  // WEIGHT ANALYSIS
  if (ctx.weightAnalysis && ctx.weightAnalysis.trend !== 'unknown') {
    const weightLines: string[] = ['WEIGHT ANALYSIS:'];
    if (ctx.weightAnalysis.weeklyAverage) weightLines.push(`- Weekly Average: ${ctx.weightAnalysis.weeklyAverage} kg`);
    if (ctx.weightAnalysis.twoWeekAverage) weightLines.push(`- 2-Week Average: ${ctx.weightAnalysis.twoWeekAverage} kg`);
    if (ctx.weightAnalysis.monthlyChange !== null) weightLines.push(`- Monthly Change: ${ctx.weightAnalysis.monthlyChange > 0 ? '+' : ''}${ctx.weightAnalysis.monthlyChange} kg`);
    if (ctx.weightAnalysis.weeklyRateOfChange !== null) weightLines.push(`- Weekly Rate: ${ctx.weightAnalysis.weeklyRateOfChange > 0 ? '+' : ''}${ctx.weightAnalysis.weeklyRateOfChange} kg/week`);
    weightLines.push(`- Trend: ${ctx.weightAnalysis.trend.charAt(0).toUpperCase() + ctx.weightAnalysis.trend.slice(1)}`);
    sections.push(weightLines.join('\n'));
  }
  
  // GOAL EVALUATION
  if (ctx.goalEvaluation) {
    const goalLines: string[] = ['GOAL EVALUATION (latest):'];
    goalLines.push(`- Week: ${ctx.goalEvaluation.weekStart}`);
    goalLines.push(`- Primary Goal: ${ctx.goalEvaluation.primaryGoal}`);
    goalLines.push(`- Verdict: ${ctx.goalEvaluation.verdict}`);
    sections.push(goalLines.join('\n'));
  }
  
  // INSTRUCTIONS FOR TRAINER
  sections.push(`TRAINER INSTRUCTIONS:
- Use the data above as authoritative truth. Do NOT ask for information already shown here.
- If weight, diet, or workouts change mid-week, adapt recommendations immediately.
- Reference specific stored values (e.g., "Your current weight of ${ctx.currentWeight || '?'}kg...") in responses.
- Never re-calculate using outdated data from chat history. Always use the values above.
- You have full visibility into the user's progress, nutrition, activities, and goals. Use this data to provide informed coaching.`);
  
  return sections.join('\n\n');
}
