/**
 * WEEKLY CADENCE ENGINE
 * 
 * Enforces weekly coaching rhythm where NutriCore adjusts training and diet
 * once per week based on trends - not daily noise.
 * 
 * Governing Principle: Train daily. Review weekly. Adjust deliberately.
 * 
 * HARD RULES:
 * - Coaching decisions occur on a weekly cycle
 * - No daily plan changes
 * - No mid-week tuning unless: injury, illness, full week missed, explicit user request
 */

import { storage } from '../storage';
import { resolveSystemState, type SystemInput, type UnifiedVerdict } from './unifiedDecisionLayer';
import { runGoalEvaluation, getUserPrimaryGoal } from './goalMetricsEngine';
import {
  WEEKLY_CLASSIFICATION,
  ADJUSTMENT_TYPE,
  REVIEW_TRIGGER,
  type WeeklyClassification,
  type AdjustmentType,
  type ReviewTrigger,
  type WeeklyAggregates,
  type WeeklyAdjustmentPlan,
  type InsertWeeklyCoachingReview,
  type GoalProgress,
} from '@shared/schema';

// =============================================================================
// CONSTANTS & THRESHOLDS
// =============================================================================

const CLASSIFICATION_THRESHOLDS = {
  COMPLETION_RATE_HIGH: 0.85,
  COMPLETION_RATE_LOW: 0.5,
  ADHERENCE_HIGH: 0.8,
  ADHERENCE_LOW: 0.6,
  RPE_TOO_HIGH: 9.0,
  RPE_TOO_LOW: 5.5,
  SLEEP_CONSISTENCY_HIGH: 0.8,
  SLEEP_CONSISTENCY_LOW: 0.6,
} as const;

const ADJUSTMENT_MAGNITUDES = {
  SMALL: 0.05,
  MEDIUM: 0.10,
  LARGE: 0.15,
} as const;

// =============================================================================
// WEEK BOUNDARY HELPERS
// =============================================================================

function getWeekBoundaries(referenceDate: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff - 7);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// =============================================================================
// AGGREGATION FUNCTIONS
// =============================================================================

async function aggregateWeeklyData(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyAggregates> {
  const startStr = formatDate(weekStart);
  const endStr = formatDate(weekEnd);
  
  const scheduledWorkouts = await storage.getScheduledWorkouts(userId, weekStart, weekEnd);
  const workoutLogs = await storage.getWorkoutLogs(userId, weekStart, weekEnd);
  const weeklyCheckIns = await storage.getWeeklyCheckIns(userId, 2);
  const dailyActivities = await storage.getDailyActivityRange(userId, startStr, endStr);
  
  const workoutsPlanned = scheduledWorkouts.length;
  const workoutsCompleted = workoutLogs.filter((w: any) => w.completed).length;
  const completionRate = workoutsPlanned > 0 ? workoutsCompleted / workoutsPlanned : 0;
  
  const strengthWorkouts = workoutLogs.filter((w: any) => 
    w.activityType === 'strength' || w.activityType === 'gym'
  );
  const avgStrengthRpe = strengthWorkouts.length > 0
    ? strengthWorkouts.reduce((sum: number, w: any) => {
        const exercises = (w.exercises as any[]) || [];
        const rpes = exercises.flatMap((e: any) => (e.sets || []).map((s: any) => s.rpe || 7));
        return sum + (rpes.length > 0 ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : 7);
      }, 0) / strengthWorkouts.length
    : 7;
  
  const cardioWorkouts = workoutLogs.filter((w: any) => 
    w.activityType === 'running' || w.activityType === 'walking' || w.activityType === 'cardio'
  );
  const totalCardioMinutes = cardioWorkouts.reduce((sum: number, w: any) => sum + (w.duration || 0), 0);
  
  const avgDailySteps = dailyActivities.length > 0
    ? dailyActivities.reduce((sum: number, d: any) => sum + (d.steps || 0), 0) / dailyActivities.length
    : 0;
  
  const latestCheckIn = weeklyCheckIns[0];
  const previousCheckIn = weeklyCheckIns[1];
  
  const avgSleepScore = latestCheckIn?.sleepQuality || 7;
  const sleepConsistency = latestCheckIn?.sleepQuality && previousCheckIn?.sleepQuality
    ? 1 - Math.abs(latestCheckIn.sleepQuality - previousCheckIn.sleepQuality) / 10
    : 0.7;
  
  const latestHrv = (latestCheckIn as any)?.hrvScore || null;
  const previousHrv = (previousCheckIn as any)?.hrvScore || null;
  const avgHrv = latestHrv;
  const hrvTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 
    latestHrv && previousHrv
      ? latestHrv > previousHrv + 5 ? 'improving'
        : latestHrv < previousHrv - 5 ? 'declining'
        : 'stable'
      : 'unknown';

  const stepsTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown' = 
    dailyActivities.length >= 7
      ? (() => {
          const firstHalf = dailyActivities.slice(0, 3).reduce((s: number, d: any) => s + (d.steps || 0), 0) / 3;
          const secondHalf = dailyActivities.slice(4, 7).reduce((s: number, d: any) => s + (d.steps || 0), 0) / 3;
          return firstHalf > secondHalf * 1.1 ? 'increasing'
            : firstHalf < secondHalf * 0.9 ? 'decreasing'
            : 'stable';
        })()
      : 'unknown';

  const adherenceScore = (
    completionRate * 0.4 +
    (avgStrengthRpe >= 6 && avgStrengthRpe <= 8.5 ? 1 : 0.7) * 0.3 +
    sleepConsistency * 0.3
  );

  return {
    workoutsPlanned,
    workoutsCompleted,
    completionRate,
    avgStrengthRpe,
    strengthProgressionCount: strengthWorkouts.length,
    cardioSessionsCompleted: cardioWorkouts.length,
    totalCardioMinutes,
    avgDailySteps,
    stepsTrend,
    avgSleepScore,
    sleepConsistency,
    avgHrv,
    hrvTrend,
    adherenceScore,
  };
}

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

function classifyWeek(aggregates: WeeklyAggregates): WeeklyClassification {
  const { completionRate, avgStrengthRpe, adherenceScore, hrvTrend, sleepConsistency } = aggregates;

  if (completionRate < CLASSIFICATION_THRESHOLDS.COMPLETION_RATE_LOW) {
    return WEEKLY_CLASSIFICATION.UNDER_ADHERING;
  }

  if (avgStrengthRpe >= CLASSIFICATION_THRESHOLDS.RPE_TOO_HIGH || hrvTrend === 'declining') {
    return WEEKLY_CLASSIFICATION.OVERREACHING;
  }

  if (
    completionRate >= CLASSIFICATION_THRESHOLDS.COMPLETION_RATE_HIGH &&
    adherenceScore >= CLASSIFICATION_THRESHOLDS.ADHERENCE_HIGH &&
    avgStrengthRpe >= 6 && avgStrengthRpe <= 8.5
  ) {
    return WEEKLY_CLASSIFICATION.PROGRESSING;
  }

  return WEEKLY_CLASSIFICATION.MAINTAINING;
}

// =============================================================================
// ADJUSTMENT PLAN GENERATION
// =============================================================================

function generateAdjustmentPlan(
  classification: WeeklyClassification,
  aggregates: WeeklyAggregates
): WeeklyAdjustmentPlan {
  const adjustments: WeeklyAdjustmentPlan['adjustments'] = [];
  let volumeMultiplier = 1.0;
  let intensityMultiplier = 1.0;
  let calorieAdjustment = 0;
  let nextWeekFocus = '';

  switch (classification) {
    case WEEKLY_CLASSIFICATION.PROGRESSING:
      volumeMultiplier = 1.0 + ADJUSTMENT_MAGNITUDES.SMALL;
      intensityMultiplier = 1.0 + ADJUSTMENT_MAGNITUDES.SMALL;
      adjustments.push({
        type: ADJUSTMENT_TYPE.VOLUME_INCREASE,
        domain: 'training',
        magnitude: ADJUSTMENT_MAGNITUDES.SMALL,
        rationale: 'Strong week performance supports progressive overload',
      });
      nextWeekFocus = 'Continue building momentum with slightly increased volume';
      break;

    case WEEKLY_CLASSIFICATION.MAINTAINING:
      adjustments.push({
        type: ADJUSTMENT_TYPE.MAINTAIN,
        domain: 'training',
        magnitude: 0,
        rationale: 'Current load is appropriate for adaptation',
      });
      nextWeekFocus = 'Stay consistent with current plan';
      break;

    case WEEKLY_CLASSIFICATION.OVERREACHING:
      volumeMultiplier = 1.0 - ADJUSTMENT_MAGNITUDES.MEDIUM;
      intensityMultiplier = 1.0 - ADJUSTMENT_MAGNITUDES.SMALL;
      calorieAdjustment = 100;
      adjustments.push({
        type: ADJUSTMENT_TYPE.VOLUME_DECREASE,
        domain: 'training',
        magnitude: ADJUSTMENT_MAGNITUDES.MEDIUM,
        rationale: 'Signs of accumulated fatigue detected',
      });
      adjustments.push({
        type: ADJUSTMENT_TYPE.CALORIE_ADJUST,
        domain: 'nutrition',
        magnitude: 100,
        rationale: 'Increase calories to support recovery',
      });
      nextWeekFocus = 'Prioritize recovery with reduced training load';
      break;

    case WEEKLY_CLASSIFICATION.UNDER_ADHERING:
      volumeMultiplier = 1.0 - ADJUSTMENT_MAGNITUDES.SMALL;
      adjustments.push({
        type: ADJUSTMENT_TYPE.VOLUME_DECREASE,
        domain: 'training',
        magnitude: ADJUSTMENT_MAGNITUDES.SMALL,
        rationale: 'Reduce volume to improve adherence',
      });
      nextWeekFocus = 'Focus on consistency with a more manageable plan';
      break;
  }

  return {
    adjustments,
    nextWeekFocus,
    volumeMultiplier,
    intensityMultiplier,
    calorieAdjustment,
  };
}

// =============================================================================
// SUMMARY GENERATION
// =============================================================================

function generateWeeklySummary(
  classification: WeeklyClassification,
  aggregates: WeeklyAggregates,
  adjustmentPlan: WeeklyAdjustmentPlan,
  goalProgress?: GoalProgress
): string {
  const completionPct = Math.round(aggregates.completionRate * 100);
  
  let summary = `Weekly Review: ${completionPct}% workout completion. `;
  
  switch (classification) {
    case WEEKLY_CLASSIFICATION.PROGRESSING:
      summary += `Strong performance this week. `;
      break;
    case WEEKLY_CLASSIFICATION.MAINTAINING:
      summary += `Steady week with good consistency. `;
      break;
    case WEEKLY_CLASSIFICATION.OVERREACHING:
      summary += `Signs of fatigue detected. Reducing load for recovery. `;
      break;
    case WEEKLY_CLASSIFICATION.UNDER_ADHERING:
      summary += `Lower adherence this week. Adjusting for better fit. `;
      break;
  }
  
  if (goalProgress) {
    const goalLabel = goalProgress.goal.replace('_', ' ');
    summary += `Goal (${goalLabel}): ${goalProgress.status.replace('_', ' ')}. `;
    if (goalProgress.recommendedAction) {
      summary += goalProgress.recommendedAction + ' ';
    }
  }
  
  summary += `Next week: ${adjustmentPlan.nextWeekFocus}`;
  
  return summary;
}

// =============================================================================
// MAIN ENGINE
// =============================================================================

export interface WeeklyReviewResult {
  classification: WeeklyClassification;
  aggregates: WeeklyAggregates;
  adjustmentPlan: WeeklyAdjustmentPlan;
  verdict: UnifiedVerdict;
  summary: string;
  goalProgress?: GoalProgress;
}

export async function runWeeklyReview(
  userId: string,
  trigger: ReviewTrigger = REVIEW_TRIGGER.SCHEDULED,
  referenceDate?: Date
): Promise<WeeklyReviewResult> {
  const { weekStart, weekEnd } = getWeekBoundaries(referenceDate);
  
  const existingReview = await storage.getWeeklyReview(userId, weekStart);
  if (existingReview && trigger === REVIEW_TRIGGER.SCHEDULED) {
    return {
      classification: existingReview.classification as WeeklyClassification,
      aggregates: existingReview.weeklyAggregates as WeeklyAggregates,
      adjustmentPlan: existingReview.adjustmentPlan as WeeklyAdjustmentPlan,
      verdict: existingReview.unifiedVerdict as UnifiedVerdict,
      summary: existingReview.summaryMessage || '',
    };
  }
  
  const aggregates = await aggregateWeeklyData(userId, weekStart, weekEnd);
  const classification = classifyWeek(aggregates);
  const adjustmentPlan = generateAdjustmentPlan(classification, aggregates);
  
  const weeklyCheckIns = await storage.getWeeklyCheckIns(userId, 1);
  const weeklyCheckIn = weeklyCheckIns[0];
  const systemInput: SystemInput = {
    physiological: {
      soreness: weeklyCheckIn?.soreness || 3,
      sleepQuality: aggregates.avgSleepScore,
      stressLevel: weeklyCheckIn?.stressLevel || 5,
      energyLevel: weeklyCheckIn?.energyLevel || 7,
      hrvScore: aggregates.avgHrv || undefined,
    },
    performance: {
      averageRPE: aggregates.avgStrengthRpe,
      performanceTrend: classification === WEEKLY_CLASSIFICATION.PROGRESSING ? 'improved'
        : classification === WEEKLY_CLASSIFICATION.OVERREACHING ? 'declined'
        : 'maintained',
      weeksSinceDeload: 0,
      recentWorkloadTrend: aggregates.completionRate >= 0.8 ? 'stable' : 'decreasing',
    },
    context: {
      goal: 'general_fitness',
      experienceLevel: 'intermediate',
      currentPhase: classification === WEEKLY_CLASSIFICATION.OVERREACHING ? 'deload' : 'building',
    },
  };
  
  const verdict = resolveSystemState(systemInput);
  
  const goalProgress = await runGoalEvaluation(userId, weekStart, weekEnd, aggregates);
  
  const summary = generateWeeklySummary(classification, aggregates, adjustmentPlan, goalProgress);
  
  const reviewData: InsertWeeklyCoachingReview = {
    userId,
    weekStart,
    weekEnd,
    classification,
    trigger,
    weeklyAggregates: aggregates,
    adjustmentPlan,
    unifiedVerdict: verdict,
    summaryMessage: summary,
    workoutCompletionRate: aggregates.completionRate,
    strengthTrend: aggregates.avgStrengthRpe >= 7 ? 'improving' : 'stable',
    cardioConsistency: aggregates.cardioSessionsCompleted / 7,
    stepsTrend: aggregates.stepsTrend,
    sleepConsistency: aggregates.sleepConsistency,
    hrvTrend: aggregates.hrvTrend,
    adherenceScore: aggregates.adherenceScore,
  };
  
  await storage.createWeeklyReview(reviewData);
  
  return {
    classification,
    aggregates,
    adjustmentPlan,
    verdict,
    summary,
    goalProgress,
  };
}

export function shouldAllowMidWeekAdjustment(trigger: ReviewTrigger): boolean {
  const midWeekTriggers: ReviewTrigger[] = [
    REVIEW_TRIGGER.INJURY,
    REVIEW_TRIGGER.ILLNESS,
    REVIEW_TRIGGER.MISSED_WEEK,
    REVIEW_TRIGGER.USER_REQUEST,
  ];
  return midWeekTriggers.includes(trigger);
}

export { getWeekBoundaries };
