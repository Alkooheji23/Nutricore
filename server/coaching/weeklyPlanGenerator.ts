/**
 * WEEKLY ADAPTIVE PLAN GENERATOR
 * 
 * Generates personalized weekly workout and nutrition plans.
 * All decisions are governed by the Unified Decision Layer.
 * Training, recovery, and nutrition are not independent systems.
 */

import { getVolumeRecommendations, generateWorkoutSplit } from './fitnessEngine';
import { 
  calculateMacros, 
  generateMealPlan, 
  adjustMacrosForDay, 
  applyNutritionDirective,
  type UserNutritionInput, 
  type MacroBreakdown 
} from './nutritionEngine';
import { 
  resolveSystemState, 
  formatVerdictOutput,
  type SystemInput, 
  type UnifiedVerdict,
  type SystemStatus 
} from './unifiedDecisionLayer';

export interface UserContext {
  userId: string;
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  
  primaryGoal: string;
  experienceLevel: string;
  activityLevel: string;
  
  preferredWorkoutDays: number;
  preferredWorkoutDuration: number;
  availableEquipment: string[];
  trainingLocation: string;
  
  lastWeekSoreness: number;
  lastWeekAverageRPE: number;
  lastWeekSleepQuality: number;
  lastWeekStressLevel: number;
  lastWeekEnergyLevel?: number;
  lastWeekVolume: Record<string, number>;
  weeksSinceDeload?: number;
  performanceTrend?: 'improved' | 'maintained' | 'declined' | null;
  
  dietaryRestrictions: string[];
  culturalCuisine: string;
}

export interface WeeklyPlan {
  weekNumber: number;
  verdict: string;
  status: SystemStatus;
  summary: string;
  workoutPlan: WorkoutDay[];
  nutritionPlan: {
    dailyMacros: MacroBreakdown;
    trainingDayMacros: MacroBreakdown;
    restDayMacros: MacroBreakdown;
    mealDistribution: any;
  };
  volumeTargets: Record<string, number>;
  recoveryDirectives: {
    sleepTarget: number;
    activeRecovery: boolean;
    priority: string;
  };
  focusAreas: string[];
}

export interface WorkoutDay {
  day: string;
  name: string;
  type: string;
  duration: number;
  exercises: Exercise[];
  warmup: string[];
  cooldown: string[];
}

export interface Exercise {
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

function buildSystemInput(user: UserContext): SystemInput {
  return {
    physiological: {
      soreness: user.lastWeekSoreness,
      sleepQuality: user.lastWeekSleepQuality,
      stressLevel: user.lastWeekStressLevel,
      energyLevel: user.lastWeekEnergyLevel ?? Math.round((10 - user.lastWeekSoreness + user.lastWeekSleepQuality) / 2),
    },
    performance: {
      averageRPE: user.lastWeekAverageRPE,
      performanceTrend: user.performanceTrend ?? null,
      weeksSinceDeload: user.weeksSinceDeload ?? 0,
      recentWorkloadTrend: 'stable',
    },
    context: {
      goal: user.primaryGoal,
      experienceLevel: user.experienceLevel,
    },
  };
}

/**
 * Generate a complete weekly plan governed by the Unified Decision Layer.
 * One verdict controls all domains.
 */
export function generateWeeklyPlan(user: UserContext, weekNumber: number): WeeklyPlan {
  const systemInput = buildSystemInput(user);
  const unifiedVerdict = resolveSystemState(systemInput);
  
  const volumeRecs = getVolumeRecommendations(user.experienceLevel);
  
  const volumeTargets: Record<string, number> = {};
  for (const [muscle, range] of Object.entries(volumeRecs)) {
    const baseVolume = Math.round((range.min + range.max) / 2);
    volumeTargets[muscle] = Math.round(baseVolume * unifiedVerdict.trainingMultiplier);
  }
  
  const effectiveWorkoutDays = deriveWorkoutDays(user.preferredWorkoutDays, unifiedVerdict);
  const workoutSplit = generateWorkoutSplit(effectiveWorkoutDays, user.primaryGoal);
  
  const workoutPlan = buildWorkoutDays(workoutSplit, volumeTargets, user, unifiedVerdict);
  
  const nutritionInput: UserNutritionInput = {
    weight: user.weight,
    height: user.height,
    age: user.age,
    gender: user.gender,
    activityLevel: user.activityLevel,
    goal: user.primaryGoal,
  };
  
  const baseMacros = calculateMacros(nutritionInput);
  const dailyMacros = applyNutritionDirective(baseMacros, unifiedVerdict.nutritionAdjustment);
  
  const trainingIntensity = unifiedVerdict.status === 'increase' ? 'intense' : 
                            unifiedVerdict.status === 'maintain' ? 'moderate' : 'light';
  const trainingDayMacros = adjustMacrosForDay(dailyMacros, true, trainingIntensity);
  const restDayMacros = adjustMacrosForDay(dailyMacros, false);
  const mealDistribution = generateMealPlan(dailyMacros, 4);
  
  const focusAreas = deriveFocusAreas(unifiedVerdict, user);
  
  return {
    weekNumber,
    verdict: unifiedVerdict.verdict,
    status: unifiedVerdict.status,
    summary: unifiedVerdict.verdict,
    workoutPlan,
    nutritionPlan: {
      dailyMacros,
      trainingDayMacros,
      restDayMacros,
      mealDistribution,
    },
    volumeTargets,
    recoveryDirectives: {
      sleepTarget: unifiedVerdict.recoveryPriority.sleepTarget,
      activeRecovery: unifiedVerdict.recoveryPriority.activeRecovery,
      priority: unifiedVerdict.recoveryPriority.priority,
    },
    focusAreas,
  };
}

function deriveWorkoutDays(preferred: number, verdict: UnifiedVerdict): number {
  if (verdict.status === 'recover') {
    return Math.max(1, Math.min(preferred, 2));
  }
  if (verdict.status === 'deload') {
    return Math.max(1, Math.min(preferred, 3));
  }
  if (verdict.status === 'reduce') {
    return Math.max(1, Math.min(preferred - 1, preferred));
  }
  return preferred;
}

function buildWorkoutDays(
  split: string[],
  volumeTargets: Record<string, number>,
  user: UserContext,
  verdict: UnifiedVerdict
): WorkoutDay[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const workoutDays: WorkoutDay[] = [];
  
  const workoutPattern = distributeWorkouts(split.length);
  
  let workoutIndex = 0;
  for (let i = 0; i < 7; i++) {
    if (workoutPattern[i] && workoutIndex < split.length) {
      const workoutType = split[workoutIndex];
      const duration = Math.round(user.preferredWorkoutDuration * verdict.trainingMultiplier);
      
      workoutDays.push({
        day: days[i],
        name: workoutType,
        type: categorizeWorkout(workoutType),
        duration: Math.max(30, duration),
        exercises: generateExercises(workoutType, volumeTargets, user, verdict),
        warmup: generateWarmup(workoutType),
        cooldown: verdict.recoveryPriority.priority === 'critical' || verdict.recoveryPriority.priority === 'high'
          ? ['Extended stretching - 10 min', 'Foam rolling - 5 min', 'Breathing exercises - 3 min']
          : ['Stretching - 5 min', 'Foam rolling - Optional'],
      });
      workoutIndex++;
    }
  }
  
  return workoutDays;
}

function distributeWorkouts(numWorkouts: number): boolean[] {
  const patterns: Record<number, boolean[]> = {
    1: [true, false, false, false, false, false, false],
    2: [true, false, false, true, false, false, false],
    3: [true, false, true, false, true, false, false],
    4: [true, true, false, true, true, false, false],
    5: [true, true, false, true, true, true, false],
    6: [true, true, true, false, true, true, true],
  };
  return patterns[numWorkouts] || patterns[4];
}

function categorizeWorkout(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('push')) return 'push';
  if (lower.includes('pull')) return 'pull';
  if (lower.includes('leg') || lower.includes('lower')) return 'legs';
  if (lower.includes('upper')) return 'upper';
  if (lower.includes('full')) return 'full_body';
  return 'mixed';
}

function generateExercises(
  workoutType: string,
  volumeTargets: Record<string, number>,
  user: UserContext,
  verdict: UnifiedVerdict
): Exercise[] {
  const exercises: Exercise[] = [];
  const type = workoutType.toLowerCase();
  
  const setMultiplier = verdict.trainingMultiplier;
  
  if (type.includes('push') || type.includes('chest')) {
    exercises.push(
      { name: 'Bench Press', muscleGroup: 'chest', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 90, notes: 'Control the negative' },
      { name: 'Incline Dumbbell Press', muscleGroup: 'chest', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Shoulder Press', muscleGroup: 'shoulders', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Lateral Raises', muscleGroup: 'shoulders', sets: Math.round(3 * setMultiplier), reps: '12-15', restSeconds: 60 },
      { name: 'Tricep Pushdowns', muscleGroup: 'triceps', sets: Math.round(3 * setMultiplier), reps: '12-15', restSeconds: 60 },
    );
  }
  
  if (type.includes('pull') || type.includes('back')) {
    exercises.push(
      { name: 'Lat Pulldown', muscleGroup: 'back', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Barbell Row', muscleGroup: 'back', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Seated Cable Row', muscleGroup: 'back', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Face Pulls', muscleGroup: 'shoulders', sets: Math.round(3 * setMultiplier), reps: '15-20', restSeconds: 60 },
      { name: 'Bicep Curls', muscleGroup: 'biceps', sets: Math.round(3 * setMultiplier), reps: '12-15', restSeconds: 60 },
    );
  }
  
  if (type.includes('leg') || type.includes('lower')) {
    exercises.push(
      { name: 'Squats', muscleGroup: 'quads', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 120, notes: 'Depth below parallel' },
      { name: 'Romanian Deadlift', muscleGroup: 'hamstrings', sets: Math.round(4 * setMultiplier), reps: '10-12', restSeconds: 90 },
      { name: 'Leg Press', muscleGroup: 'quads', sets: Math.round(3 * setMultiplier), reps: '12-15', restSeconds: 90 },
      { name: 'Leg Curl', muscleGroup: 'hamstrings', sets: Math.round(3 * setMultiplier), reps: '12-15', restSeconds: 60 },
      { name: 'Calf Raises', muscleGroup: 'calves', sets: Math.round(4 * setMultiplier), reps: '15-20', restSeconds: 45 },
    );
  }
  
  if (type.includes('full')) {
    exercises.push(
      { name: 'Squats', muscleGroup: 'quads', sets: Math.round(3 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Bench Press', muscleGroup: 'chest', sets: Math.round(3 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Barbell Row', muscleGroup: 'back', sets: Math.round(3 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Shoulder Press', muscleGroup: 'shoulders', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Romanian Deadlift', muscleGroup: 'hamstrings', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
    );
  }
  
  if (type.includes('upper')) {
    exercises.push(
      { name: 'Bench Press', muscleGroup: 'chest', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Barbell Row', muscleGroup: 'back', sets: Math.round(4 * setMultiplier), reps: '8-10', restSeconds: 90 },
      { name: 'Shoulder Press', muscleGroup: 'shoulders', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Lat Pulldown', muscleGroup: 'back', sets: Math.round(3 * setMultiplier), reps: '10-12', restSeconds: 75 },
      { name: 'Bicep Curls', muscleGroup: 'biceps', sets: Math.round(2 * setMultiplier), reps: '12-15', restSeconds: 60 },
      { name: 'Tricep Extensions', muscleGroup: 'triceps', sets: Math.round(2 * setMultiplier), reps: '12-15', restSeconds: 60 },
    );
  }
  
  return exercises.map(e => ({
    ...e,
    sets: Math.max(1, e.sets),
  }));
}

function generateWarmup(workoutType: string): string[] {
  const type = workoutType.toLowerCase();
  
  if (type.includes('leg') || type.includes('lower')) {
    return [
      '5 min light cardio (treadmill/bike)',
      'Leg swings - 10 each side',
      'Bodyweight squats - 15 reps',
      'Hip circles - 10 each direction',
    ];
  }
  
  if (type.includes('push') || type.includes('upper') || type.includes('chest')) {
    return [
      '5 min light cardio',
      'Arm circles - 20 each direction',
      'Push-ups - 10-15 reps',
      'Band pull-aparts - 15 reps',
    ];
  }
  
  if (type.includes('pull') || type.includes('back')) {
    return [
      '5 min light cardio',
      'Arm circles - 20 each direction',
      'Band pull-aparts - 15 reps',
      'Scapular retractions - 10 reps',
    ];
  }
  
  return [
    '5 min light cardio',
    'Dynamic stretching - 2-3 min',
    'Movement-specific warmup sets',
  ];
}

function deriveFocusAreas(verdict: UnifiedVerdict, user: UserContext): string[] {
  const focuses: string[] = [];
  
  if (verdict.status === 'recover' || verdict.status === 'deload') {
    focuses.push('Recovery is the priority');
    focuses.push(`Target ${verdict.recoveryPriority.sleepTarget}+ hours of sleep`);
  }
  
  if (verdict.nutritionAdjustment.proteinEmphasis === 'maximum') {
    focuses.push('Maximize protein intake');
  }
  
  if (verdict.recoveryPriority.activeRecovery) {
    focuses.push('Include active recovery activities');
  }
  
  if (verdict.status === 'increase') {
    focuses.push('Push training intensity');
  }
  
  return focuses;
}

/**
 * Get just the verdict for quick decisions
 */
export function getSystemVerdict(user: UserContext): { verdict: string; status: SystemStatus } {
  const systemInput = buildSystemInput(user);
  const result = resolveSystemState(systemInput);
  return {
    verdict: result.verdict,
    status: result.status,
  };
}
