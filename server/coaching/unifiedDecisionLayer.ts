/**
 * UNIFIED DECISION LAYER
 * 
 * Single governing authority for all training, recovery, and nutrition decisions.
 * All decisions resolve to one verdict. No independent subsystems.
 * 
 * SINGLE BRAIN RULE (NON-NEGOTIABLE):
 * The Trainer (via this layer) is the ONLY entity allowed to:
 * - Adjust workout plans
 * - Adjust calorie targets  
 * - Interpret recovery and readiness
 * 
 * All other sections (tabs, features, integrations) are execution or display layers ONLY.
 * No domain may be adjusted in isolation. Changes trigger cross-domain rebalancing.
 * 
 * DECISION HIERARCHY:
 * 1. Physiological readiness (fatigue, recovery, injury risk)
 * 2. Performance trajectory (trend > single session)
 * 3. Sustainability (adherence, burnout avoidance)
 * 4. Aesthetic or short-term goals
 * 
 * DATA AWARENESS:
 * - Trainer reads from: logged workouts, synced smartwatch data, progress metrics
 * - Trainer never asks for data that already exists
 * - Missing data defaults to conservative assumptions
 * 
 * DECISION APPLICATION:
 * - Weekly cadence (no daily plan changes)
 * - Forward-only changes (no retroactive edits)
 * - No mid-week overhauls unless injury/illness detected
 */

export const DECISION_AUTHORITY = {
  TRAINER: 'trainer',
  SYSTEM: 'system',
} as const;
export type DecisionAuthority = typeof DECISION_AUTHORITY[keyof typeof DECISION_AUTHORITY];

export const DECISION_DOMAIN = {
  TRAINING: 'training',
  NUTRITION: 'nutrition',
  RECOVERY: 'recovery',
  ACTIVITY: 'activity',
} as const;
export type DecisionDomain = typeof DECISION_DOMAIN[keyof typeof DECISION_DOMAIN];

export type SystemStatus = 'maintain' | 'increase' | 'reduce' | 'deload' | 'recover';

export interface PhysiologicalState {
  soreness: number;
  sleepQuality: number;
  stressLevel: number;
  energyLevel: number;
  hrvScore?: number;
  injuryRisk?: 'low' | 'moderate' | 'high';
}

export interface PerformanceState {
  averageRPE: number;
  performanceTrend: 'improved' | 'maintained' | 'declined' | null;
  weeksSinceDeload: number;
  recentWorkloadTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface NutritionState {
  currentCalorieIntake?: number;
  proteinAdherence?: number;
  hydrationLevel?: number;
  mealTiming?: 'consistent' | 'irregular';
}

export interface AthleteContext {
  goal: string;
  experienceLevel: string;
  currentPhase?: 'building' | 'peaking' | 'deload' | 'maintenance';
}

export interface SystemInput {
  physiological: PhysiologicalState;
  performance: PerformanceState;
  nutrition?: NutritionState;
  context: AthleteContext;
}

export interface UnifiedVerdict {
  verdict: string;
  status: SystemStatus;
  trainingMultiplier: number;
  nutritionAdjustment: NutritionDirective;
  recoveryPriority: RecoveryDirective;
}

export interface NutritionDirective {
  calorieAdjustment: 'surplus' | 'maintenance' | 'deficit' | 'recovery_surplus';
  proteinEmphasis: 'standard' | 'high' | 'maximum';
  carbTiming: 'pre_workout' | 'post_workout' | 'distributed' | 'reduced';
}

export interface RecoveryDirective {
  priority: 'low' | 'moderate' | 'high' | 'critical';
  sleepTarget: number;
  activeRecovery: boolean;
  deloadRequired: boolean;
}

interface SignalWeights {
  physiological: number;
  performance: number;
  sustainability: number;
}

function calculatePhysiologicalScore(state: PhysiologicalState): number {
  const sorenessScore = Math.max(0, 10 - state.soreness);
  const sleepScore = state.sleepQuality;
  const stressScore = Math.max(0, 10 - state.stressLevel);
  const energyScore = state.energyLevel;
  
  let score = (sorenessScore * 0.3 + sleepScore * 0.25 + stressScore * 0.2 + energyScore * 0.25);
  
  if (state.injuryRisk === 'high') score *= 0.5;
  else if (state.injuryRisk === 'moderate') score *= 0.75;
  
  if (state.hrvScore !== undefined) {
    const hrvFactor = state.hrvScore >= 70 ? 1.1 : state.hrvScore >= 50 ? 1.0 : 0.85;
    score *= hrvFactor;
  }
  
  return Math.min(10, Math.max(0, score));
}

function calculatePerformanceScore(state: PerformanceState): number {
  let score = 5;
  
  const rpeOptimal = state.averageRPE >= 6 && state.averageRPE <= 8;
  const rpeTooLow = state.averageRPE < 6;
  const rpeTooHigh = state.averageRPE > 8;
  
  if (rpeOptimal) score += 2;
  else if (rpeTooLow) score += 1;
  else if (rpeTooHigh) score -= 1;
  
  if (state.performanceTrend === 'improved') score += 2;
  else if (state.performanceTrend === 'declined') score -= 2;
  
  if (state.weeksSinceDeload >= 5) score -= 1;
  if (state.weeksSinceDeload >= 7) score -= 2;
  
  return Math.min(10, Math.max(0, score));
}

function calculateSustainabilityScore(
  physiological: PhysiologicalState,
  performance: PerformanceState
): number {
  let score = 7;
  
  if (performance.averageRPE >= 9.5) score -= 3;
  else if (performance.averageRPE >= 9) score -= 2;
  
  if (physiological.soreness >= 8) score -= 2;
  if (physiological.stressLevel >= 8) score -= 2;
  if (physiological.sleepQuality <= 4) score -= 2;
  
  if (performance.weeksSinceDeload >= 6) score -= 1;
  
  return Math.min(10, Math.max(0, score));
}

function resolveConflicts(weights: SignalWeights): SystemStatus {
  if (weights.physiological <= 3) return 'recover';
  if (weights.physiological <= 4) return 'deload';
  if (weights.physiological <= 5 || weights.sustainability <= 4) return 'reduce';
  
  if (weights.physiological >= 7 && weights.performance >= 7 && weights.sustainability >= 6) {
    return 'increase';
  }
  
  return 'maintain';
}

function deriveNutritionDirective(
  status: SystemStatus,
  goal: string,
  physiological: PhysiologicalState
): NutritionDirective {
  if (status === 'recover' || status === 'deload') {
    return {
      calorieAdjustment: 'recovery_surplus',
      proteinEmphasis: 'maximum',
      carbTiming: 'distributed',
    };
  }
  
  if (status === 'reduce') {
    return {
      calorieAdjustment: 'maintenance',
      proteinEmphasis: 'high',
      carbTiming: 'post_workout',
    };
  }
  
  if (status === 'increase') {
    if (goal === 'fat_loss') {
      return {
        calorieAdjustment: 'deficit',
        proteinEmphasis: 'maximum',
        carbTiming: 'pre_workout',
      };
    }
    return {
      calorieAdjustment: 'surplus',
      proteinEmphasis: 'high',
      carbTiming: 'distributed',
    };
  }
  
  if (goal === 'fat_loss') {
    return {
      calorieAdjustment: 'deficit',
      proteinEmphasis: 'high',
      carbTiming: 'pre_workout',
    };
  }
  
  if (goal === 'muscle_gain') {
    return {
      calorieAdjustment: 'surplus',
      proteinEmphasis: 'high',
      carbTiming: 'distributed',
    };
  }
  
  return {
    calorieAdjustment: 'maintenance',
    proteinEmphasis: 'standard',
    carbTiming: 'distributed',
  };
}

function deriveRecoveryDirective(
  status: SystemStatus,
  physiological: PhysiologicalState
): RecoveryDirective {
  if (status === 'recover') {
    return {
      priority: 'critical',
      sleepTarget: 9,
      activeRecovery: true,
      deloadRequired: true,
    };
  }
  
  if (status === 'deload') {
    return {
      priority: 'high',
      sleepTarget: 8.5,
      activeRecovery: true,
      deloadRequired: true,
    };
  }
  
  if (status === 'reduce') {
    return {
      priority: 'moderate',
      sleepTarget: 8,
      activeRecovery: physiological.soreness >= 5,
      deloadRequired: false,
    };
  }
  
  return {
    priority: 'low',
    sleepTarget: 7.5,
    activeRecovery: false,
    deloadRequired: false,
  };
}

function getTrainingMultiplier(status: SystemStatus): number {
  switch (status) {
    case 'recover': return 0.4;
    case 'deload': return 0.6;
    case 'reduce': return 0.85;
    case 'maintain': return 1.0;
    case 'increase': return 1.1;
  }
}

function generateVerdict(status: SystemStatus, goal: string): string {
  const verdicts: Record<SystemStatus, Record<string, string>> = {
    recover: {
      default: 'Full recovery week. Light movement only. Sleep and nutrition are the priority.',
      fat_loss: 'Recovery takes precedence. Maintain protein, reduce training to movement-only.',
      muscle_gain: 'Recovery week. Maintain calories, focus on sleep and tissue repair.',
    },
    deload: {
      default: 'Deload week. Reduce intensity by 40%. Focus on movement quality.',
      fat_loss: 'Strategic deload. Maintain deficit but reduce training volume significantly.',
      muscle_gain: 'Deload to supercompensate. Maintain nutrition, reduce training load.',
    },
    reduce: {
      default: 'Pull back this week. Reduce volume and prioritize recovery.',
      fat_loss: 'Scale back training. Maintain protein high, reduce session intensity.',
      muscle_gain: 'Reduce load temporarily. Keep eating, let the body catch up.',
    },
    maintain: {
      default: 'Continue current approach. Consistency is key.',
      fat_loss: 'Stay the course. Training and nutrition are balanced.',
      muscle_gain: 'Maintain current programming. Progress is on track.',
    },
    increase: {
      default: 'Ready to progress. Increase training stimulus this week.',
      fat_loss: 'Recovery strong. Push harder in training while maintaining deficit.',
      muscle_gain: 'Time to grow. Increase volume and ensure nutrition supports it.',
    },
  };
  
  const goalVerdicts = verdicts[status];
  return goalVerdicts[goal] || goalVerdicts.default;
}

/**
 * UNIFIED DECISION AUTHORITY
 * 
 * Issues a single verdict that governs training, recovery, and nutrition.
 * Any change in one domain automatically rebalances the others.
 * Lower priority signals are silently overridden by higher ones.
 */
export function resolveSystemState(input: SystemInput): UnifiedVerdict {
  const physiologicalScore = calculatePhysiologicalScore(input.physiological);
  const performanceScore = calculatePerformanceScore(input.performance);
  const sustainabilityScore = calculateSustainabilityScore(
    input.physiological,
    input.performance
  );
  
  const weights: SignalWeights = {
    physiological: physiologicalScore,
    performance: performanceScore,
    sustainability: sustainabilityScore,
  };
  
  const status = resolveConflicts(weights);
  const verdict = generateVerdict(status, input.context.goal);
  const trainingMultiplier = getTrainingMultiplier(status);
  const nutritionAdjustment = deriveNutritionDirective(
    status,
    input.context.goal,
    input.physiological
  );
  const recoveryPriority = deriveRecoveryDirective(status, input.physiological);
  
  return {
    verdict,
    status,
    trainingMultiplier,
    nutritionAdjustment,
    recoveryPriority,
  };
}

/**
 * Quick verdict resolver for simple inputs
 */
export function getQuickVerdict(
  soreness: number,
  sleepQuality: number,
  averageRPE: number,
  stressLevel: number,
  goal: string = 'maintenance'
): { verdict: string; status: SystemStatus } {
  const input: SystemInput = {
    physiological: {
      soreness,
      sleepQuality,
      stressLevel,
      energyLevel: Math.round((10 - soreness + sleepQuality) / 2),
    },
    performance: {
      averageRPE,
      performanceTrend: null,
      weeksSinceDeload: 0,
      recentWorkloadTrend: 'stable',
    },
    context: {
      goal,
      experienceLevel: 'intermediate',
    },
  };
  
  const result = resolveSystemState(input);
  return {
    verdict: result.verdict,
    status: result.status,
  };
}

/**
 * Format verdict for display
 */
export function formatVerdictOutput(result: UnifiedVerdict): string {
  return `VERDICT: ${result.verdict}\nSTATUS: ${result.status.toUpperCase()}`;
}

// =============================================================================
// AUTHORITY ENFORCEMENT
// =============================================================================

/**
 * Validates that a decision request comes from an authorized source.
 * Only the Trainer (AI) or System (automated processes) can make decisions.
 * This is the single-brain enforcement mechanism.
 */
export function validateDecisionAuthority(source: string): { valid: boolean; authority: DecisionAuthority | null } {
  const authorizedSources = ['trainer', 'ai', 'system', 'weekly_cadence', 'goal_metrics'];
  
  if (authorizedSources.includes(source.toLowerCase())) {
    return {
      valid: true,
      authority: source === 'trainer' || source === 'ai' ? DECISION_AUTHORITY.TRAINER : DECISION_AUTHORITY.SYSTEM,
    };
  }
  
  return { valid: false, authority: null };
}

/**
 * Cross-domain impact assessment.
 * When one domain changes, this determines what other domains need adjustment.
 */
export function assessCrossDomainImpact(
  changeDomain: DecisionDomain,
  changeType: 'increase' | 'decrease' | 'hold'
): { domain: DecisionDomain; action: 'evaluate' | 'adjust' | 'hold' }[] {
  const impacts: { domain: DecisionDomain; action: 'evaluate' | 'adjust' | 'hold' }[] = [];
  
  switch (changeDomain) {
    case DECISION_DOMAIN.TRAINING:
      if (changeType === 'increase') {
        impacts.push({ domain: DECISION_DOMAIN.RECOVERY, action: 'evaluate' });
        impacts.push({ domain: DECISION_DOMAIN.NUTRITION, action: 'adjust' });
      } else if (changeType === 'decrease') {
        impacts.push({ domain: DECISION_DOMAIN.RECOVERY, action: 'hold' });
        impacts.push({ domain: DECISION_DOMAIN.NUTRITION, action: 'evaluate' });
      }
      break;
      
    case DECISION_DOMAIN.RECOVERY:
      if (changeType === 'decrease') {
        impacts.push({ domain: DECISION_DOMAIN.TRAINING, action: 'adjust' });
        impacts.push({ domain: DECISION_DOMAIN.NUTRITION, action: 'evaluate' });
      }
      break;
      
    case DECISION_DOMAIN.NUTRITION:
      if (changeType === 'decrease') {
        impacts.push({ domain: DECISION_DOMAIN.TRAINING, action: 'evaluate' });
      } else if (changeType === 'increase') {
        impacts.push({ domain: DECISION_DOMAIN.RECOVERY, action: 'evaluate' });
      }
      break;
      
    case DECISION_DOMAIN.ACTIVITY:
      impacts.push({ domain: DECISION_DOMAIN.RECOVERY, action: 'evaluate' });
      impacts.push({ domain: DECISION_DOMAIN.NUTRITION, action: 'evaluate' });
      break;
  }
  
  return impacts;
}

/**
 * Conservative default assumptions for missing data.
 * Used when the Trainer lacks sufficient information.
 */
export const CONSERVATIVE_DEFAULTS = {
  soreness: 4,
  sleepQuality: 6,
  stressLevel: 5,
  energyLevel: 6,
  averageRPE: 7,
  weeksSinceDeload: 2,
  adherenceRate: 0.7,
} as const;
