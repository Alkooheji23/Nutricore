import { storage } from '../storage';
import {
  PRIMARY_GOAL,
  GOAL_EVALUATION_STATUS,
  ADJUSTMENT_AXIS,
  GOAL_METRIC_STACKS,
  type PrimaryGoal,
  type GoalEvaluationStatus,
  type AdjustmentAxis,
  type GoalProgress,
  type InsertGoalEvaluation,
  type WeeklyAggregates,
} from '@shared/schema';

const MIN_DAYS_FOR_EVALUATION = 5;
const MIN_ADHERENCE_FOR_EVALUATION = 0.7;
const CONSECUTIVE_WEEKS_FOR_ADJUSTMENT = 2;

const ADJUSTMENT_RANGES = {
  [ADJUSTMENT_AXIS.CALORIES]: { min: -0.10, max: 0.10 },
  [ADJUSTMENT_AXIS.TRAINING_VOLUME]: { min: -0.20, max: 0.20 },
  [ADJUSTMENT_AXIS.CARDIO_EMPHASIS]: { min: -1, max: 1 },
  [ADJUSTMENT_AXIS.RECOVERY_BIAS]: { min: 0, max: 1 },
} as const;

interface WeeklyMetrics {
  avgWeight: number | null;
  weightTrend: 'decreasing' | 'stable' | 'increasing' | 'unknown';
  strengthProgressionRate: number;
  calorieAdherence: number;
  trainingVolumeCompletion: number;
  consistencyScore: number;
  recoveryScore: number;
}

function getUserPrimaryGoal(userGoal: string | null | undefined): PrimaryGoal {
  if (!userGoal) return PRIMARY_GOAL.HEALTH_MAINTENANCE;
  
  const normalized = userGoal.toLowerCase().replace(/[\s_-]/g, '');
  
  if (normalized.includes('weightloss') || normalized.includes('fatloss') || normalized.includes('lose')) {
    return PRIMARY_GOAL.WEIGHT_LOSS;
  }
  if (normalized.includes('muscle') || normalized.includes('gain') || normalized.includes('bulk') || normalized.includes('strength')) {
    return PRIMARY_GOAL.MUSCLE_GAIN;
  }
  if (normalized.includes('performance') || normalized.includes('endurance') || normalized.includes('athletic')) {
    return PRIMARY_GOAL.PERFORMANCE;
  }
  return PRIMARY_GOAL.HEALTH_MAINTENANCE;
}

async function computeWeeklyMetrics(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
  aggregates: WeeklyAggregates
): Promise<WeeklyMetrics> {
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  
  const startDateStr = previousWeekStart.toISOString().split('T')[0];
  const endDateStr = weekEnd.toISOString().split('T')[0];
  
  const bodyweightEntries = await storage.getBodyweightEntries(userId, startDateStr, endDateStr);
  
  const weekEntries = bodyweightEntries.filter(e => {
    const entryDate = new Date(e.date);
    return entryDate >= weekStart && entryDate <= weekEnd;
  });
  
  const avgWeight = weekEntries.length > 0
    ? weekEntries.reduce((sum, e) => sum + e.weight, 0) / weekEntries.length
    : null;

  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  
  const prevWeekEntries = bodyweightEntries.filter(e => {
    const entryDate = new Date(e.date);
    return entryDate >= previousWeekStart && entryDate <= previousWeekEnd;
  });
  
  const prevAvgWeight = prevWeekEntries.length > 0
    ? prevWeekEntries.reduce((sum, e) => sum + e.weight, 0) / prevWeekEntries.length
    : null;

  let weightTrend: 'decreasing' | 'stable' | 'increasing' | 'unknown' = 'unknown';
  if (avgWeight !== null && prevAvgWeight !== null) {
    const diff = avgWeight - prevAvgWeight;
    if (diff < -0.3) weightTrend = 'decreasing';
    else if (diff > 0.3) weightTrend = 'increasing';
    else weightTrend = 'stable';
  }

  const strengthProgressionRate = aggregates.workoutsPlanned > 0
    ? aggregates.strengthProgressionCount / aggregates.workoutsPlanned
    : 0;

  const consistencyScore = (
    (aggregates.completionRate * 0.4) +
    (aggregates.sleepConsistency * 0.3) +
    ((aggregates.avgDailySteps > 7000 ? 1 : aggregates.avgDailySteps / 7000) * 0.3)
  );

  const recoveryScore = aggregates.hrvTrend === 'improving' ? 1
    : aggregates.hrvTrend === 'stable' ? 0.7
    : aggregates.hrvTrend === 'declining' ? 0.4
    : 0.5;

  return {
    avgWeight,
    weightTrend,
    strengthProgressionRate,
    calorieAdherence: aggregates.adherenceScore,
    trainingVolumeCompletion: aggregates.completionRate,
    consistencyScore,
    recoveryScore,
  };
}

function evaluateGoalProgress(
  goal: PrimaryGoal,
  currentMetrics: WeeklyMetrics,
  previousMetrics: WeeklyMetrics | null
): GoalEvaluationStatus {
  const metricStack = GOAL_METRIC_STACKS[goal];

  switch (goal) {
    case PRIMARY_GOAL.WEIGHT_LOSS:
      if (currentMetrics.avgWeight === null) return GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA;
      if (currentMetrics.weightTrend === 'decreasing') return GOAL_EVALUATION_STATUS.ON_TRACK;
      if (currentMetrics.weightTrend === 'stable') return GOAL_EVALUATION_STATUS.STALLED;
      if (currentMetrics.weightTrend === 'increasing') return GOAL_EVALUATION_STATUS.REGRESSING;
      return GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA;

    case PRIMARY_GOAL.MUSCLE_GAIN:
      if (currentMetrics.strengthProgressionRate >= 0.5) return GOAL_EVALUATION_STATUS.ON_TRACK;
      if (currentMetrics.strengthProgressionRate >= 0.2) return GOAL_EVALUATION_STATUS.STALLED;
      if (currentMetrics.strengthProgressionRate < 0.1 && currentMetrics.trainingVolumeCompletion > 0.8) {
        return GOAL_EVALUATION_STATUS.STALLED;
      }
      if (currentMetrics.trainingVolumeCompletion < 0.5) return GOAL_EVALUATION_STATUS.REGRESSING;
      return GOAL_EVALUATION_STATUS.STALLED;

    case PRIMARY_GOAL.PERFORMANCE:
      if (currentMetrics.trainingVolumeCompletion >= 0.85 && currentMetrics.recoveryScore >= 0.7) {
        return GOAL_EVALUATION_STATUS.ON_TRACK;
      }
      if (currentMetrics.trainingVolumeCompletion >= 0.6) return GOAL_EVALUATION_STATUS.STALLED;
      return GOAL_EVALUATION_STATUS.REGRESSING;

    case PRIMARY_GOAL.HEALTH_MAINTENANCE:
      if (currentMetrics.consistencyScore >= 0.8) return GOAL_EVALUATION_STATUS.ON_TRACK;
      if (currentMetrics.consistencyScore >= 0.6) return GOAL_EVALUATION_STATUS.STALLED;
      return GOAL_EVALUATION_STATUS.REGRESSING;

    default:
      return GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA;
  }
}

interface AdjustmentRecommendation {
  axis: AdjustmentAxis;
  magnitude: number;
  rationale: string;
}

function determineAdjustment(
  goal: PrimaryGoal,
  status: GoalEvaluationStatus,
  consecutiveWeeks: number,
  metrics: WeeklyMetrics
): AdjustmentRecommendation | null {
  if (consecutiveWeeks < CONSECUTIVE_WEEKS_FOR_ADJUSTMENT) {
    return null;
  }

  if (status === GOAL_EVALUATION_STATUS.ON_TRACK) {
    return null;
  }

  if (status === GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA) {
    return null;
  }

  switch (goal) {
    case PRIMARY_GOAL.WEIGHT_LOSS:
      if (status === GOAL_EVALUATION_STATUS.STALLED) {
        if (metrics.calorieAdherence < 0.8) {
          return null;
        }
        return {
          axis: ADJUSTMENT_AXIS.CALORIES,
          magnitude: -0.05,
          rationale: 'Weight stalled for 2+ weeks with good adherence - reducing calories by 5%',
        };
      }
      if (status === GOAL_EVALUATION_STATUS.REGRESSING) {
        return {
          axis: ADJUSTMENT_AXIS.CALORIES,
          magnitude: -0.10,
          rationale: 'Weight trending up - reducing calories by 10%',
        };
      }
      break;

    case PRIMARY_GOAL.MUSCLE_GAIN:
      if (status === GOAL_EVALUATION_STATUS.STALLED) {
        if (metrics.recoveryScore < 0.5) {
          return {
            axis: ADJUSTMENT_AXIS.RECOVERY_BIAS,
            magnitude: 1,
            rationale: 'Strength stalled with poor recovery - adding deload/rest',
          };
        }
        return {
          axis: ADJUSTMENT_AXIS.TRAINING_VOLUME,
          magnitude: 0.10,
          rationale: 'Strength stalled with good recovery - increasing volume by 10%',
        };
      }
      if (status === GOAL_EVALUATION_STATUS.REGRESSING) {
        return {
          axis: ADJUSTMENT_AXIS.RECOVERY_BIAS,
          magnitude: 1,
          rationale: 'Training completion declining - adding recovery focus',
        };
      }
      break;

    case PRIMARY_GOAL.PERFORMANCE:
      if (status === GOAL_EVALUATION_STATUS.STALLED) {
        return {
          axis: ADJUSTMENT_AXIS.TRAINING_VOLUME,
          magnitude: 0.10,
          rationale: 'Performance plateaued - moderate volume increase',
        };
      }
      if (status === GOAL_EVALUATION_STATUS.REGRESSING) {
        return {
          axis: ADJUSTMENT_AXIS.RECOVERY_BIAS,
          magnitude: 1,
          rationale: 'Performance declining - prioritizing recovery',
        };
      }
      break;

    case PRIMARY_GOAL.HEALTH_MAINTENANCE:
      if (status === GOAL_EVALUATION_STATUS.STALLED || status === GOAL_EVALUATION_STATUS.REGRESSING) {
        return {
          axis: ADJUSTMENT_AXIS.TRAINING_VOLUME,
          magnitude: -0.10,
          rationale: 'Consistency dropping - reducing training load to improve adherence',
        };
      }
      break;
  }

  return null;
}

export async function runGoalEvaluation(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
  aggregates: WeeklyAggregates
): Promise<GoalProgress> {
  const user = await storage.getUser(userId);
  const primaryGoal = getUserPrimaryGoal(user?.fitnessGoal);

  const daysWithData = Math.min(7, Math.max(
    aggregates.workoutsCompleted,
    Math.round(aggregates.adherenceScore * 7)
  ));
  const dataCompleteness = daysWithData / 7;

  if (daysWithData < MIN_DAYS_FOR_EVALUATION && aggregates.adherenceScore < MIN_ADHERENCE_FOR_EVALUATION) {
    const evaluation: InsertGoalEvaluation = {
      userId,
      weekStart,
      weekEnd,
      primaryGoal,
      evaluationStatus: GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA,
      consecutiveWeeksInStatus: 1,
      daysWithData,
      dataCompleteness,
      adjustmentTriggered: false,
    };
    await storage.createGoalEvaluation(evaluation);

    return {
      goal: primaryGoal,
      status: GOAL_EVALUATION_STATUS.INSUFFICIENT_DATA,
      trend: 'unknown',
      consecutiveWeeks: 1,
      primaryMetrics: {},
      recommendedAction: null,
    };
  }

  const currentMetrics = await computeWeeklyMetrics(userId, weekStart, weekEnd, aggregates);

  const previousEvaluations = await storage.getGoalEvaluationHistory(userId, 2);
  const previousEvaluation = previousEvaluations[0];

  let previousMetrics: WeeklyMetrics | null = null;
  if (previousEvaluation) {
    const prevWeekStart = new Date(previousEvaluation.weekStart);
    const prevWeekEnd = new Date(previousEvaluation.weekEnd);
    const prevAggregates: WeeklyAggregates = {
      workoutsPlanned: 4,
      workoutsCompleted: 3,
      completionRate: 0.75,
      avgStrengthRpe: 7,
      strengthProgressionCount: 2,
      cardioSessionsCompleted: 2,
      totalCardioMinutes: 60,
      avgDailySteps: 8000,
      stepsTrend: 'stable',
      avgSleepScore: 75,
      sleepConsistency: 0.8,
      avgHrv: null,
      hrvTrend: 'stable',
      adherenceScore: 0.8,
    };
    previousMetrics = await computeWeeklyMetrics(userId, prevWeekStart, prevWeekEnd, prevAggregates);
  }

  const status = evaluateGoalProgress(primaryGoal, currentMetrics, previousMetrics);

  let consecutiveWeeks = 1;
  if (previousEvaluation && previousEvaluation.evaluationStatus === status) {
    consecutiveWeeks = (previousEvaluation.consecutiveWeeksInStatus || 1) + 1;
  }

  const adjustment = determineAdjustment(primaryGoal, status, consecutiveWeeks, currentMetrics);

  const primaryMetricValues: Record<string, number | null> = {};
  const secondaryMetricValues: Record<string, number | null> = {};

  switch (primaryGoal) {
    case PRIMARY_GOAL.WEIGHT_LOSS:
      primaryMetricValues.weekly_avg_weight_trend = currentMetrics.avgWeight;
      secondaryMetricValues.calorie_adherence = currentMetrics.calorieAdherence;
      break;
    case PRIMARY_GOAL.MUSCLE_GAIN:
      primaryMetricValues.strength_progression = currentMetrics.strengthProgressionRate;
      secondaryMetricValues.training_volume_completion = currentMetrics.trainingVolumeCompletion;
      break;
    case PRIMARY_GOAL.PERFORMANCE:
      primaryMetricValues.training_volume = currentMetrics.trainingVolumeCompletion;
      secondaryMetricValues.recovery = currentMetrics.recoveryScore;
      break;
    case PRIMARY_GOAL.HEALTH_MAINTENANCE:
      primaryMetricValues.consistency = currentMetrics.consistencyScore;
      break;
  }

  const evaluation: InsertGoalEvaluation = {
    userId,
    weekStart,
    weekEnd,
    primaryGoal,
    evaluationStatus: status,
    consecutiveWeeksInStatus: consecutiveWeeks,
    primaryMetricValues,
    secondaryMetricValues,
    daysWithData,
    dataCompleteness,
    adjustmentTriggered: !!adjustment,
    adjustmentAxis: adjustment?.axis,
    adjustmentMagnitude: adjustment?.magnitude,
    adjustmentRationale: adjustment?.rationale,
  };

  await storage.createGoalEvaluation(evaluation);

  const trend = status === GOAL_EVALUATION_STATUS.ON_TRACK ? 'improving'
    : status === GOAL_EVALUATION_STATUS.STALLED ? 'stable'
    : status === GOAL_EVALUATION_STATUS.REGRESSING ? 'declining'
    : 'unknown';

  const previousMetricValues = previousEvaluation?.primaryMetricValues as Record<string, number | null> | null;

  return {
    goal: primaryGoal,
    status,
    trend,
    consecutiveWeeks,
    primaryMetrics: Object.fromEntries(
      Object.entries(primaryMetricValues).map(([key, value]) => [
        key,
        {
          current: value,
          previous: previousMetricValues?.[key] ?? null,
          trend,
        },
      ])
    ),
    recommendedAction: adjustment?.rationale ?? null,
  };
}

export function getGoalMetricStack(goal: PrimaryGoal) {
  return GOAL_METRIC_STACKS[goal];
}

export { getUserPrimaryGoal, CONSECUTIVE_WEEKS_FOR_ADJUSTMENT };
