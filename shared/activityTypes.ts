/**
 * Activity Classification System
 * 
 * Current Focus: Strength/Gym Training and Running ONLY.
 * Other activities deferred for future development.
 */

export const ACTIVITY_CATEGORIES = {
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
} as const;

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[keyof typeof ACTIVITY_CATEGORIES];

export interface ActivityTypeConfig {
  category: ActivityCategory;
  name: string;
  icon: string;
  showSets: boolean;
  showReps: boolean;
  showWeight: boolean;
  showRPE: boolean;
  showDistance: boolean;
  showPace: boolean;
  showHeartRateZones: boolean;
  showDuration: boolean;
  showCalories: boolean;
  description: string;
  manualInputEnabled: boolean;
}

export const ACTIVITY_TYPES: Record<string, ActivityTypeConfig> = {
  'strength_training': {
    category: ACTIVITY_CATEGORIES.STRENGTH,
    name: 'Strength Training',
    icon: 'dumbbell',
    showSets: true,
    showReps: true,
    showWeight: true,
    showRPE: true,
    showDistance: false,
    showPace: false,
    showHeartRateZones: false,
    showDuration: true,
    showCalories: true,
    description: 'Weight lifting, resistance training',
    manualInputEnabled: true,
  },
  'running': {
    category: ACTIVITY_CATEGORIES.ENDURANCE,
    name: 'Running',
    icon: 'footprints',
    showSets: false,
    showReps: false,
    showWeight: false,
    showRPE: false,
    showDistance: true,
    showPace: true,
    showHeartRateZones: true,
    showDuration: true,
    showCalories: true,
    description: 'Jogging, sprints, trail running',
    manualInputEnabled: true,
  },
};

export function getActivityConfig(activityType: string): ActivityTypeConfig | undefined {
  return ACTIVITY_TYPES[activityType];
}

export function getActivityCategory(activityType: string): ActivityCategory {
  return ACTIVITY_TYPES[activityType]?.category || ACTIVITY_CATEGORIES.STRENGTH;
}

export function isStrengthActivity(activityType: string): boolean {
  return getActivityCategory(activityType) === ACTIVITY_CATEGORIES.STRENGTH;
}

export function isEnduranceActivity(activityType: string): boolean {
  return getActivityCategory(activityType) === ACTIVITY_CATEGORIES.ENDURANCE;
}

export function shouldAllowManualInput(activityType: string): boolean {
  return ACTIVITY_TYPES[activityType]?.manualInputEnabled ?? false;
}

export function shouldUseWearableAsPrimary(activityType: string): boolean {
  const config = ACTIVITY_TYPES[activityType];
  if (!config) return true;
  return !config.manualInputEnabled;
}

export function getActivityList(): Array<{ key: string; config: ActivityTypeConfig }> {
  return Object.entries(ACTIVITY_TYPES).map(([key, config]) => ({ key, config }));
}

export function getActivitiesByCategory(category: ActivityCategory): Array<{ key: string; config: ActivityTypeConfig }> {
  return getActivityList().filter(({ config }) => config.category === category);
}

export function formatWorkoutSummary(
  workoutName: string,
  activityType: string | undefined,
  duration: number | undefined,
  distance: number | undefined,
  exerciseCount: number | undefined,
  totalSets: number | undefined
): string {
  const config = activityType ? getActivityConfig(activityType) : undefined;
  const parts: string[] = [];
  
  if (duration && duration > 0) {
    parts.push(`${duration}-minute`);
  }
  
  const activityName = config?.name?.toLowerCase() || workoutName.toLowerCase();
  parts.push(activityName);
  
  if (config?.showDistance && distance && distance > 0) {
    return `${parts.join(' ')}, ${distance.toFixed(1)} km`;
  }
  
  if (config?.showSets && exerciseCount && exerciseCount > 0 && totalSets && totalSets > 0) {
    return `${parts.join(' ')} - ${exerciseCount} exercises, ${totalSets} sets`;
  }
  
  return parts.join(' ');
}

export function inferActivityType(workoutName: string): string {
  const name = workoutName.toLowerCase();
  
  if (name.includes('run') || name.includes('jog') || name.includes('sprint')) {
    return 'running';
  }
  
  return 'strength_training';
}

export interface ScheduledWorkoutFormDefaults {
  duration: number;
  intensity: string;
  distance?: number;
}

export function getScheduledWorkoutDefaults(activityType: string): ScheduledWorkoutFormDefaults {
  const config = getActivityConfig(activityType);
  
  if (config?.category === ACTIVITY_CATEGORIES.ENDURANCE) {
    return { duration: 45, intensity: 'moderate', distance: undefined };
  }
  
  return { duration: 60, intensity: 'moderate' };
}

export const ALLOWED_FIELDS_BY_CATEGORY: Record<ActivityCategory, string[]> = {
  [ACTIVITY_CATEGORIES.STRENGTH]: ['duration', 'intensity', 'exercises'],
  [ACTIVITY_CATEGORIES.ENDURANCE]: ['duration', 'distance', 'intensity'],
};

export function pruneWorkoutPayload<T extends Record<string, any>>(
  payload: T,
  activityType: string
): Partial<T> {
  const config = getActivityConfig(activityType);
  const category = config?.category || ACTIVITY_CATEGORIES.STRENGTH;
  const allowedFields = ALLOWED_FIELDS_BY_CATEGORY[category];
  
  const baseFields = [
    'userId', 'scheduledDate', 'dayOfWeek', 'timeSlot',
    'workoutType', 'title', 'description', 'status',
    'completedAt', 'performanceFeedback', 'notes',
    'aiGenerated', 'weekNumber', 'activityType',
    'sportCategory', 'location', 'equipment', 'dataSource'
  ];
  
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    if (baseFields.includes(key) || allowedFields.includes(key)) {
      (result as any)[key] = value;
    }
  }
  
  if (category !== ACTIVITY_CATEGORIES.STRENGTH) {
    delete (result as any).exercises;
  }
  
  return result;
}

// Helper to validate structured exercises
export function hasValidExercises(exercises: unknown): boolean {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return false;
  }
  
  return exercises.every(ex => {
    if (typeof ex !== 'object' || ex === null) return false;
    const exercise = ex as Record<string, unknown>;
    
    // Must have name, sets, and either reps or targetRir
    const hasName = typeof exercise.name === 'string' && exercise.name.length > 0;
    const hasSets = typeof exercise.sets === 'number' && exercise.sets > 0;
    const hasReps = exercise.reps !== undefined && exercise.reps !== null;
    const hasTargetRir = typeof exercise.targetRir === 'number';
    
    return hasName && hasSets && (hasReps || hasTargetRir);
  });
}

export function validateWorkoutPayload(
  payload: Record<string, any>,
  activityType: string,
  options: { allowLegacy?: boolean } = {}
): { valid: boolean; errors: string[]; isLegacyUnstructured?: boolean } {
  const config = getActivityConfig(activityType);
  const errors: string[] = [];
  let isLegacyUnstructured = false;
  
  if (!payload.title || payload.title.trim() === '') {
    errors.push('Title is required');
  }
  
  if (!payload.scheduledDate) {
    errors.push('Scheduled date is required');
  }
  
  // STRENGTH WORKOUT VALIDATION - Sets/Reps are MANDATORY
  if (config?.category === ACTIVITY_CATEGORIES.STRENGTH || isStrengthType(activityType)) {
    if (!hasValidExercises(payload.exercises)) {
      if (options.allowLegacy && payload.duration && payload.duration > 0) {
        // Allow legacy duration-only but flag it
        isLegacyUnstructured = true;
      } else {
        errors.push('Strength workouts require structured exercises with sets and reps.');
      }
    }
  }
  
  // ENDURANCE WORKOUT VALIDATION - Duration required
  if (config?.category === ACTIVITY_CATEGORIES.ENDURANCE) {
    if (!payload.duration || payload.duration <= 0) {
      errors.push('Duration is required for running');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    isLegacyUnstructured,
  };
}

// Check if activity type name indicates strength training
function isStrengthType(activityType: string): boolean {
  const strengthKeywords = ['strength', 'gym', 'weight', 'resistance', 'lifting'];
  const normalized = activityType.toLowerCase();
  return strengthKeywords.some(kw => normalized.includes(kw));
}

export const DATA_SOURCES = {
  MANUAL: 'manual',
  WEARABLE_FITBIT: 'fitbit',
  WEARABLE_GARMIN: 'garmin',
  AI_GENERATED: 'ai_generated',
} as const;

export type DataSource = typeof DATA_SOURCES[keyof typeof DATA_SOURCES];

export function shouldAutoImportFromWearable(activityType: string, hasWearableConnected: boolean): boolean {
  if (!hasWearableConnected) return false;
  return shouldUseWearableAsPrimary(activityType);
}

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES)
  .map(([key, config]) => ({
    key,
    name: config.name,
    category: config.category,
    icon: config.icon,
    description: config.description,
  }));
