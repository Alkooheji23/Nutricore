/**
 * FITNESS ENGINE
 * Handles training volume, progression, RPE, and adaptive adjustments
 */

// Volume recommendations by experience level (sets per week per muscle group)
const VOLUME_RECOMMENDATIONS = {
  beginner: {
    chest: { min: 8, max: 10 },
    back: { min: 8, max: 12 },
    shoulders: { min: 6, max: 8 },
    biceps: { min: 4, max: 6 },
    triceps: { min: 4, max: 6 },
    quads: { min: 8, max: 10 },
    hamstrings: { min: 6, max: 8 },
    glutes: { min: 6, max: 8 },
    calves: { min: 4, max: 6 },
    abs: { min: 4, max: 6 },
  },
  intermediate: {
    chest: { min: 10, max: 16 },
    back: { min: 12, max: 18 },
    shoulders: { min: 8, max: 12 },
    biceps: { min: 8, max: 10 },
    triceps: { min: 8, max: 10 },
    quads: { min: 12, max: 16 },
    hamstrings: { min: 8, max: 12 },
    glutes: { min: 8, max: 12 },
    calves: { min: 6, max: 8 },
    abs: { min: 6, max: 8 },
  },
  advanced: {
    chest: { min: 16, max: 22 },
    back: { min: 18, max: 24 },
    shoulders: { min: 12, max: 16 },
    biceps: { min: 10, max: 14 },
    triceps: { min: 10, max: 14 },
    quads: { min: 16, max: 22 },
    hamstrings: { min: 12, max: 16 },
    glutes: { min: 12, max: 16 },
    calves: { min: 8, max: 12 },
    abs: { min: 8, max: 10 },
  },
};

export interface VolumeAdjustmentInput {
  currentVolume: number;
  soreness: number; // 1-10
  averageRPE: number; // 1-10
  sleepQuality: number; // 1-10
  stressLevel: number; // 1-10
}

export interface ProgressionRecommendation {
  action: 'increase' | 'maintain' | 'decrease' | 'deload';
  volumeMultiplier: number;
  reason: string;
}

/**
 * Adjusts training volume based on recovery metrics
 */
export function adjustVolume(input: VolumeAdjustmentInput): ProgressionRecommendation {
  const { currentVolume, soreness, averageRPE, sleepQuality, stressLevel } = input;
  
  // High soreness = reduce volume
  if (soreness >= 8) {
    return {
      action: 'deload',
      volumeMultiplier: 0.6,
      reason: 'High muscle soreness detected. Recommending deload week for recovery.',
    };
  }
  
  if (soreness >= 6) {
    return {
      action: 'decrease',
      volumeMultiplier: 0.85,
      reason: 'Elevated soreness. Reducing volume by 15% to aid recovery.',
    };
  }
  
  // High RPE = at limit, maintain or reduce
  if (averageRPE >= 9.5) {
    return {
      action: 'decrease',
      volumeMultiplier: 0.9,
      reason: 'Training intensity at maximum. Reducing volume to prevent overtraining.',
    };
  }
  
  if (averageRPE >= 8.5) {
    return {
      action: 'maintain',
      volumeMultiplier: 1.0,
      reason: 'Training at optimal intensity. Maintaining current volume.',
    };
  }
  
  // Poor sleep or high stress = reduce
  if (sleepQuality <= 4 || stressLevel >= 8) {
    return {
      action: 'decrease',
      volumeMultiplier: 0.85,
      reason: 'Recovery compromised due to sleep or stress. Reducing volume.',
    };
  }
  
  // Low RPE with good recovery = can progress
  if (averageRPE <= 7 && soreness <= 4 && sleepQuality >= 6) {
    return {
      action: 'increase',
      volumeMultiplier: 1.1,
      reason: 'Excellent recovery and room for progression. Increasing volume by 10%.',
    };
  }
  
  // Default: maintain
  return {
    action: 'maintain',
    volumeMultiplier: 1.0,
    reason: 'Recovery adequate. Maintaining current training volume.',
  };
}

/**
 * Get volume recommendations for a user's experience level
 */
export function getVolumeRecommendations(experienceLevel: string) {
  const level = experienceLevel.toLowerCase() as keyof typeof VOLUME_RECOMMENDATIONS;
  return VOLUME_RECOMMENDATIONS[level] || VOLUME_RECOMMENDATIONS.beginner;
}

/**
 * Calculate progressive overload recommendation
 */
export function calculateProgressiveOverload(
  previousWeight: number,
  previousReps: number,
  targetRPE: number,
  actualRPE: number
): { newWeight: number; newReps: number; recommendation: string } {
  const rpeDiff = targetRPE - actualRPE;
  
  if (rpeDiff >= 2) {
    // Too easy - increase weight
    const weightIncrease = previousWeight * 0.05; // 5% increase
    return {
      newWeight: Math.round((previousWeight + weightIncrease) * 2) / 2, // Round to nearest 0.5
      newReps: previousReps,
      recommendation: `Increase weight to ${Math.round((previousWeight + weightIncrease) * 2) / 2}kg. Last set felt too easy.`,
    };
  }
  
  if (rpeDiff >= 1) {
    // Slightly easy - add reps first
    return {
      newWeight: previousWeight,
      newReps: previousReps + 1,
      recommendation: `Add 1 rep per set. Once you hit ${previousReps + 2} reps, increase weight.`,
    };
  }
  
  if (rpeDiff <= -1) {
    // Too hard - reduce weight
    const weightDecrease = previousWeight * 0.05;
    return {
      newWeight: Math.round((previousWeight - weightDecrease) * 2) / 2,
      newReps: previousReps,
      recommendation: `Reduce weight slightly. Focus on form and controlled reps.`,
    };
  }
  
  // On target
  return {
    newWeight: previousWeight,
    newReps: previousReps,
    recommendation: `Perfect intensity! Maintain current weight and reps.`,
  };
}

/**
 * Determine if user needs a deload week
 */
export function shouldDeload(
  weeksWithoutDeload: number,
  averageSoreness: number,
  averageRPE: number,
  performanceDecline: boolean
): { needsDeload: boolean; reason: string } {
  // Every 4-6 weeks, or when recovery metrics are poor
  if (weeksWithoutDeload >= 5) {
    return {
      needsDeload: true,
      reason: 'Scheduled deload - 5 weeks of consistent training. Time to recover.',
    };
  }
  
  if (averageSoreness >= 7 && averageRPE >= 9) {
    return {
      needsDeload: true,
      reason: 'High accumulated fatigue detected. Deload recommended for recovery.',
    };
  }
  
  if (performanceDecline) {
    return {
      needsDeload: true,
      reason: 'Performance declining. Strategic deload will help you come back stronger.',
    };
  }
  
  return {
    needsDeload: false,
    reason: '',
  };
}

/**
 * Generate workout structure based on available days
 */
export function generateWorkoutSplit(daysPerWeek: number, goal: string): string[] {
  const splits: Record<number, Record<string, string[]>> = {
    2: {
      default: ['Full Body A', 'Full Body B'],
    },
    3: {
      muscle_gain: ['Push', 'Pull', 'Legs'],
      fat_loss: ['Full Body A', 'Full Body B', 'Full Body C'],
      default: ['Push', 'Pull', 'Legs'],
    },
    4: {
      muscle_gain: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
      strength: ['Squat Focus', 'Bench Focus', 'Deadlift Focus', 'Accessory'],
      default: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
    },
    5: {
      muscle_gain: ['Chest/Triceps', 'Back/Biceps', 'Legs', 'Shoulders', 'Arms'],
      default: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    },
    6: {
      muscle_gain: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
      default: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
    },
  };
  
  const daysConfig = splits[daysPerWeek] || splits[4];
  return daysConfig[goal] || daysConfig.default;
}
