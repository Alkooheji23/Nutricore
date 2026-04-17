/**
 * WEEKLY REVIEW SERVICE
 * 
 * Orchestrates end-of-week review process where the AI Trainer:
 * 1. Aggregates recovery + effort data from the past week
 * 2. Generates a comprehensive weekly report
 * 3. Updates caloric intake based on goal progress
 * 4. Amends workout plans as needed
 * 
 * Integrates with:
 * - WeeklyCadenceEngine: Weekly classification and aggregates
 * - GoalMetricsEngine: Goal-driven evaluation
 * - UnifiedDecisionLayer: Single authority for all adjustments
 */

import { storage } from '../storage';
import {
  resolveSystemState,
  type SystemInput,
  type UnifiedVerdict,
} from './unifiedDecisionLayer';
import { runGoalEvaluation, getUserPrimaryGoal } from './goalMetricsEngine';
import {
  type WeeklyAggregates,
  type InsertWeeklyReviewReport,
  type WeeklyReviewReport,
  type InsertChatMessage,
  PRIMARY_GOAL,
} from '@shared/schema';
import { sendPushNotification } from '../pushService';

// =============================================================================
// TYPES
// =============================================================================

interface RecoveryMetrics {
  avgSleepMinutes: number;
  avgSleepQuality: number;
  avgHrvScore: number | null;
  sleepConsistency: number;
  recoveryTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

interface EffortMetrics {
  avgRpe: number;
  workoutsCompleted: number;
  workoutsPlanned: number;
  completionRate: number;
  totalVolume: number;
  intensityTrend: 'increasing' | 'stable' | 'decreasing';
}

interface CalorieAdjustment {
  previousTarget: number;
  newTarget: number;
  adjustmentPercent: number;
  reason: string;
}

interface WorkoutAdjustment {
  volumeChange: 'increase' | 'maintain' | 'decrease' | 'deload';
  volumeChangePercent: number;
  intensityChange: 'increase' | 'maintain' | 'decrease';
  focusAreas: string[];
  deloadRecommended: boolean;
  specificChanges: string[];
}

// =============================================================================
// WEEK BOUNDARY HELPERS
// =============================================================================

function getWeekBoundaries(referenceDate: Date = new Date()): { weekStart: Date; weekEnd: Date; weekNumber: number } {
  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff - 7);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((weekStart.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  
  return { weekStart, weekEnd, weekNumber };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// =============================================================================
// DATA AGGREGATION
// =============================================================================

async function aggregateRecoveryMetrics(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<RecoveryMetrics> {
  const startStr = formatDate(weekStart);
  const endStr = formatDate(weekEnd);
  
  const dailyActivities = await storage.getDailyActivityRange(userId, startStr, endStr);
  const weeklyCheckIns = await storage.getWeeklyCheckIns(userId, 2);
  
  const avgSleepMinutes = dailyActivities.length > 0
    ? dailyActivities.reduce((sum, d) => sum + (d.sleepMinutes || 0), 0) / dailyActivities.length
    : 420;
  
  const avgSleepQuality = weeklyCheckIns[0]?.sleepQuality || 7;
  
  const hrvScores = dailyActivities.filter(d => d.hrvScore).map(d => d.hrvScore!);
  const avgHrvScore = hrvScores.length > 0
    ? hrvScores.reduce((sum, h) => sum + h, 0) / hrvScores.length
    : null;
  
  const sleepConsistency = dailyActivities.length >= 5 ? 0.8 : 0.6;
  
  let recoveryTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
  if (weeklyCheckIns.length >= 2) {
    const current = weeklyCheckIns[0]?.sleepQuality || 7;
    const previous = weeklyCheckIns[1]?.sleepQuality || 7;
    if (current > previous + 0.5) recoveryTrend = 'improving';
    else if (current < previous - 0.5) recoveryTrend = 'declining';
    else recoveryTrend = 'stable';
  }
  
  return {
    avgSleepMinutes,
    avgSleepQuality,
    avgHrvScore,
    sleepConsistency,
    recoveryTrend,
  };
}

async function aggregateEffortMetrics(
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<EffortMetrics> {
  const scheduledWorkouts = await storage.getScheduledWorkouts(userId, weekStart, weekEnd);
  const workoutLogs = await storage.getWorkoutLogs(userId, weekStart, weekEnd);
  
  const workoutsPlanned = scheduledWorkouts.length;
  const workoutsCompleted = workoutLogs.filter((w: any) => w.completed).length;
  const completionRate = workoutsPlanned > 0 ? workoutsCompleted / workoutsPlanned : 0;
  
  const allRpes: number[] = [];
  let totalVolume = 0;
  
  for (const log of workoutLogs) {
    const exercises = (log.exercises as any[]) || [];
    for (const exercise of exercises) {
      const sets = (exercise.sets || []) as any[];
      for (const set of sets) {
        if (set.rpe) allRpes.push(set.rpe);
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        totalVolume += weight * reps;
      }
    }
  }
  
  const avgRpe = allRpes.length > 0
    ? allRpes.reduce((sum, r) => sum + r, 0) / allRpes.length
    : 7;
  
  let intensityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (avgRpe >= 8.5) intensityTrend = 'increasing';
  else if (avgRpe <= 6) intensityTrend = 'decreasing';
  
  return {
    avgRpe,
    workoutsCompleted,
    workoutsPlanned,
    completionRate,
    totalVolume,
    intensityTrend,
  };
}

// =============================================================================
// ADJUSTMENT LOGIC
// =============================================================================

function calculateCalorieAdjustment(
  user: any,
  verdict: UnifiedVerdict,
  goalProgress: any
): CalorieAdjustment {
  const currentTarget = user.dailyCalorieGoal || 2000;
  let adjustmentPercent = 0;
  let reason = '';
  
  const goal = getUserPrimaryGoal(user.fitnessGoal);
  
  switch (verdict.nutritionAdjustment.calorieAdjustment) {
    case 'surplus':
      adjustmentPercent = goal === PRIMARY_GOAL.MUSCLE_GAIN ? 0.05 : 0.03;
      reason = 'Performance trending well, slight surplus to support muscle growth.';
      break;
    case 'deficit':
      adjustmentPercent = goal === PRIMARY_GOAL.WEIGHT_LOSS ? -0.08 : -0.05;
      reason = 'Reducing calories to accelerate fat loss while preserving muscle.';
      break;
    case 'recovery_surplus':
      adjustmentPercent = 0.10;
      reason = 'Recovery priority - increasing calories to support tissue repair.';
      break;
    default:
      adjustmentPercent = 0;
      reason = 'Maintaining current calorie target - progress on track.';
  }
  
  if (goalProgress?.status === 'stalled' && goalProgress?.consecutiveWeeks >= 2) {
    if (goal === PRIMARY_GOAL.WEIGHT_LOSS) {
      adjustmentPercent = Math.max(adjustmentPercent, -0.10);
      reason = 'Progress stalled for 2+ weeks - increasing deficit.';
    } else if (goal === PRIMARY_GOAL.MUSCLE_GAIN) {
      adjustmentPercent = Math.max(adjustmentPercent, 0.08);
      reason = 'Progress stalled for 2+ weeks - increasing surplus.';
    }
  }
  
  adjustmentPercent = Math.max(-0.15, Math.min(0.15, adjustmentPercent));
  
  const newTarget = Math.round(currentTarget * (1 + adjustmentPercent));
  
  return {
    previousTarget: currentTarget,
    newTarget,
    adjustmentPercent: adjustmentPercent * 100,
    reason,
  };
}

function calculateWorkoutAdjustment(
  verdict: UnifiedVerdict,
  effort: EffortMetrics,
  recovery: RecoveryMetrics
): WorkoutAdjustment {
  let volumeChange: 'increase' | 'maintain' | 'decrease' | 'deload' = 'maintain';
  let volumeChangePercent = 0;
  let intensityChange: 'increase' | 'maintain' | 'decrease' = 'maintain';
  const focusAreas: string[] = [];
  const specificChanges: string[] = [];
  
  const deloadRecommended = verdict.recoveryPriority.deloadRequired;
  
  if (deloadRecommended) {
    volumeChange = 'deload';
    volumeChangePercent = -40;
    intensityChange = 'decrease';
    specificChanges.push('Reduce training volume by 40% for recovery');
    specificChanges.push('Focus on technique and mobility work');
  } else if (verdict.status === 'increase' && effort.completionRate >= 0.85) {
    volumeChange = 'increase';
    volumeChangePercent = Math.round(verdict.trainingMultiplier * 100 - 100);
    intensityChange = 'maintain';
    specificChanges.push(`Increase weekly volume by ${volumeChangePercent}%`);
    focusAreas.push('Progressive overload');
  } else if (verdict.status === 'reduce' || effort.avgRpe >= 9) {
    volumeChange = 'decrease';
    volumeChangePercent = -15;
    intensityChange = 'decrease';
    specificChanges.push('Reduce intensity to prevent overtraining');
  } else if (verdict.status === 'recover') {
    volumeChange = 'decrease';
    volumeChangePercent = -25;
    intensityChange = 'decrease';
    specificChanges.push('Prioritize active recovery sessions');
    focusAreas.push('Recovery', 'Mobility');
  }
  
  if (recovery.recoveryTrend === 'declining') {
    focusAreas.push('Sleep optimization');
    specificChanges.push('Consider earlier bedtime and sleep hygiene improvements');
  }
  
  if (effort.completionRate < 0.7) {
    focusAreas.push('Consistency');
    specificChanges.push('Focus on completing scheduled workouts before adding volume');
  }
  
  return {
    volumeChange,
    volumeChangePercent,
    intensityChange,
    focusAreas,
    deloadRecommended,
    specificChanges,
  };
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function generateReportContent(
  recovery: RecoveryMetrics,
  effort: EffortMetrics,
  calorieAdj: CalorieAdjustment,
  workoutAdj: WorkoutAdjustment,
  goalProgress: any
): { title: string; summary: string; insights: string[]; recommendations: string[] } {
  const completionPercent = Math.round(effort.completionRate * 100);
  
  let title = 'Week in Review';
  if (workoutAdj.deloadRecommended) {
    title = 'Recovery Week Recommended';
  } else if (effort.completionRate >= 0.85 && recovery.recoveryTrend !== 'declining') {
    title = 'Strong Week - Keep It Up!';
  } else if (effort.completionRate < 0.5) {
    title = 'Consistency Focus Needed';
  }
  
  const summary = `You completed ${effort.workoutsCompleted} of ${effort.workoutsPlanned} planned workouts (${completionPercent}%). ` +
    `Average effort was ${effort.avgRpe.toFixed(1)}/10 RPE. ` +
    `Sleep averaged ${Math.round(recovery.avgSleepMinutes / 60)} hours with ${recovery.avgSleepQuality.toFixed(1)}/10 quality. ` +
    calorieAdj.reason;
  
  const insights: string[] = [];
  
  if (effort.completionRate >= 0.85) {
    insights.push('Excellent workout adherence this week');
  } else if (effort.completionRate < 0.7) {
    insights.push('Workout consistency needs improvement');
  }
  
  if (recovery.avgHrvScore && recovery.avgHrvScore >= 60) {
    insights.push('HRV indicates good recovery capacity');
  } else if (recovery.avgHrvScore && recovery.avgHrvScore < 50) {
    insights.push('HRV suggests accumulated fatigue');
  }
  
  if (effort.avgRpe >= 8.5) {
    insights.push('Training intensity is high - monitor for overtraining signs');
  }
  
  if (goalProgress?.status === 'on_track') {
    insights.push('Goal progress is on track');
  } else if (goalProgress?.status === 'ahead') {
    insights.push('Ahead of goal targets - great progress!');
  }
  
  const recommendations: string[] = [...workoutAdj.specificChanges];
  
  if (calorieAdj.adjustmentPercent !== 0) {
    const direction = calorieAdj.adjustmentPercent > 0 ? 'increased' : 'decreased';
    recommendations.push(`Calorie target ${direction} to ${calorieAdj.newTarget} kcal`);
  }
  
  return { title, summary, insights, recommendations };
}

// =============================================================================
// TRAINER AUTO-MESSAGES
// =============================================================================

async function sendTrainerUpdateMessage(
  userId: string,
  calorieAdj: CalorieAdjustment,
  workoutAdj: WorkoutAdjustment,
  goalProgress: any,
  reportTitle: string,
  trainerPreference: string
): Promise<void> {
  try {
    // Determine if there are meaningful changes to communicate
    const hasCalorieChange = calorieAdj.adjustmentPercent !== 0;
    const hasWorkoutChange = workoutAdj.volumeChange !== 'maintain' || workoutAdj.deloadRecommended;
    const hasGoalUpdate = goalProgress?.status && goalProgress.status !== 'on_track';
    
    // Only send message if there's something meaningful to communicate
    if (!hasCalorieChange && !hasWorkoutChange && !hasGoalUpdate) {
      return;
    }
    
    // Build trainer message content
    const messageParts: string[] = [];
    const trainerName = trainerPreference === 'male' ? 'Coach Mike' : 'Coach Sarah';
    
    // Opening based on changes
    if (workoutAdj.deloadRecommended) {
      messageParts.push(`Hey! I've been reviewing your progress this week and noticed your body could use some extra recovery time.`);
    } else if (hasGoalUpdate && goalProgress?.status === 'stalled') {
      messageParts.push(`I've been analyzing your progress and noticed things have plateaued a bit. I've made some adjustments to help get you back on track.`);
    } else if (hasGoalUpdate && goalProgress?.status === 'regressing') {
      messageParts.push(`Hey! I noticed some trends in your data this week that need our attention. I've adjusted your plan to help turn things around.`);
    } else {
      messageParts.push(`I've completed your weekly review and made a few adjustments to keep you progressing toward your goal.`);
    }
    
    // Calorie changes
    if (hasCalorieChange) {
      const direction = calorieAdj.adjustmentPercent > 0 ? 'increased' : 'decreased';
      const absPercent = Math.abs(Math.round(calorieAdj.adjustmentPercent));
      messageParts.push(`\n\n**Nutrition Update:** I've ${direction} your daily calorie target by ${absPercent}% to ${calorieAdj.newTarget} kcal. ${calorieAdj.reason}`);
    }
    
    // Workout changes
    if (hasWorkoutChange) {
      if (workoutAdj.deloadRecommended) {
        messageParts.push(`\n\n**Training Update:** I'm scheduling a deload week for you. We'll reduce training volume by about 40% to let your body recover properly. This isn't a step back — it's how we set up your next breakthrough.`);
      } else if (workoutAdj.volumeChange === 'increase') {
        messageParts.push(`\n\n**Training Update:** You've been crushing it, so I'm bumping up your training volume by ${workoutAdj.volumeChangePercent}%. You're ready for it!`);
      } else if (workoutAdj.volumeChange === 'decrease') {
        messageParts.push(`\n\n**Training Update:** I'm dialing back the intensity a bit this week to help with recovery. ${workoutAdj.specificChanges.join(' ')}`);
      }
    }
    
    // Goal-specific note
    if (goalProgress?.recommendedAction) {
      messageParts.push(`\n\n**Why?** ${goalProgress.recommendedAction}`);
    }
    
    // Closing
    messageParts.push(`\n\nYour updated plan is ready. Let me know if you have any questions!`);
    
    const fullMessage = messageParts.join('');
    
    // Get or create default conversation for the user
    const userConversations = await storage.getConversations(userId);
    let conversationId = userConversations[0]?.id;
    
    if (!conversationId) {
      const newConversation = await storage.createConversation({ userId, title: 'Trainer Chat' });
      conversationId = newConversation.id;
    }
    
    // Create chat message from trainer
    const chatMessage: InsertChatMessage = {
      userId,
      conversationId,
      role: 'assistant',
      content: fullMessage,
    };
    
    await storage.createChatMessage(chatMessage);
    
    // Send push notification
    const notificationBody = hasCalorieChange 
      ? `I've updated your nutrition plan. Tap to see the changes.`
      : workoutAdj.deloadRecommended
        ? `Recovery week scheduled. Tap to learn more.`
        : `I've made adjustments to your plan. Tap to see what's new.`;
    
    await sendPushNotification(userId, {
      title: `${trainerName} has an update`,
      body: notificationBody,
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });
    
    console.log(`[WeeklyReview] Sent trainer update message and notification to user ${userId}`);
  } catch (error) {
    console.error('[WeeklyReview] Failed to send trainer update message:', error);
    // Don't throw - this is a non-critical enhancement
  }
}

// =============================================================================
// MAIN ORCHESTRATION
// =============================================================================

export async function generateWeeklyReview(
  userId: string,
  referenceDate: Date = new Date()
): Promise<WeeklyReviewReport> {
  const { weekStart, weekEnd, weekNumber } = getWeekBoundaries(referenceDate);
  
  const existingReport = await storage.getWeeklyReviewReport(userId, weekStart);
  if (existingReport) {
    return existingReport;
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const recovery = await aggregateRecoveryMetrics(userId, weekStart, weekEnd);
  const effort = await aggregateEffortMetrics(userId, weekStart, weekEnd);
  
  let weeklyClassification: 'progressing' | 'maintaining' | 'overreaching' | 'under_adhering' = 'maintaining';
  if (effort.completionRate >= 0.85 && effort.avgRpe >= 6 && effort.avgRpe <= 8.5) {
    weeklyClassification = 'progressing';
  } else if (effort.avgRpe >= 9 || recovery.recoveryTrend === 'declining') {
    weeklyClassification = 'overreaching';
  } else if (effort.completionRate < 0.6) {
    weeklyClassification = 'under_adhering';
  }
  
  const systemInput: SystemInput = {
    physiological: {
      soreness: 10 - recovery.avgSleepQuality,
      sleepQuality: recovery.avgSleepQuality,
      stressLevel: effort.avgRpe > 8 ? 7 : 5,
      energyLevel: recovery.avgSleepQuality,
      hrvScore: recovery.avgHrvScore || undefined,
    },
    performance: {
      averageRPE: effort.avgRpe,
      performanceTrend: effort.intensityTrend === 'increasing' ? 'improved' : 
                        effort.intensityTrend === 'decreasing' ? 'declined' : 'maintained',
      weeksSinceDeload: 4,
      recentWorkloadTrend: effort.intensityTrend,
    },
    context: {
      goal: user.fitnessGoal || 'health',
      experienceLevel: 'intermediate',
    },
  };
  
  const verdict = resolveSystemState(systemInput);
  
  let goalProgress = null;
  try {
    const aggregates: WeeklyAggregates = {
      workoutsPlanned: effort.workoutsPlanned,
      workoutsCompleted: effort.workoutsCompleted,
      completionRate: effort.completionRate,
      avgStrengthRpe: effort.avgRpe,
      strengthProgressionCount: 0,
      cardioSessionsCompleted: 0,
      totalCardioMinutes: 0,
      avgDailySteps: 0,
      stepsTrend: 'stable',
      avgSleepScore: recovery.avgSleepQuality * 10,
      sleepConsistency: recovery.sleepConsistency,
      avgHrv: recovery.avgHrvScore,
      hrvTrend: recovery.recoveryTrend === 'improving' ? 'improving' : 
               recovery.recoveryTrend === 'declining' ? 'declining' : 'stable',
      adherenceScore: effort.completionRate,
    };
    goalProgress = await runGoalEvaluation(userId, weekStart, weekEnd, aggregates);
  } catch (e) {
    console.log('Goal evaluation not available:', e);
  }
  
  const calorieAdj = calculateCalorieAdjustment(user, verdict, goalProgress);
  const workoutAdj = calculateWorkoutAdjustment(verdict, effort, recovery);
  const { title, summary, insights, recommendations } = generateReportContent(
    recovery, effort, calorieAdj, workoutAdj, goalProgress
  );
  
  if (calorieAdj.newTarget !== calorieAdj.previousTarget) {
    await storage.upsertUser({
      id: userId,
      dailyCalorieGoal: calorieAdj.newTarget,
    });
  }
  
  const primaryGoal = getUserPrimaryGoal(user.fitnessGoal);
  let goalProgressStatus: 'on_track' | 'ahead' | 'behind' | 'stalled' = 'on_track';
  if (goalProgress?.status === 'on_track') goalProgressStatus = 'ahead';
  else if (goalProgress?.status === 'regressing') goalProgressStatus = 'behind';
  else if (goalProgress?.status === 'stalled') goalProgressStatus = 'stalled';
  
  const reportData: InsertWeeklyReviewReport = {
    userId,
    weekNumber,
    weekStart,
    weekEnd,
    weeklyClassification,
    avgSleepMinutes: Math.round(recovery.avgSleepMinutes),
    avgSleepQuality: recovery.avgSleepQuality,
    avgHrvScore: recovery.avgHrvScore,
    avgRpe: effort.avgRpe,
    workoutsCompleted: effort.workoutsCompleted,
    workoutsPlanned: effort.workoutsPlanned,
    completionRate: effort.completionRate,
    previousCalorieTarget: calorieAdj.previousTarget,
    newCalorieTarget: calorieAdj.newTarget,
    calorieAdjustmentPercent: calorieAdj.adjustmentPercent,
    calorieAdjustmentReason: calorieAdj.reason,
    previousProteinTarget: user.dailyProteinGoal,
    newProteinTarget: user.dailyProteinGoal,
    previousCarbsTarget: user.dailyCarbsGoal,
    newCarbsTarget: user.dailyCarbsGoal,
    previousFatsTarget: user.dailyFatsGoal,
    newFatsTarget: user.dailyFatsGoal,
    workoutAdjustments: workoutAdj,
    reportTitle: title,
    reportSummary: summary,
    keyInsights: insights,
    recommendations,
    primaryGoal,
    goalProgressStatus,
    appliedAt: new Date(),
  };
  
  const report = await storage.createWeeklyReviewReport(reportData);
  
  // Send automatic trainer message and push notification about changes
  await sendTrainerUpdateMessage(
    userId,
    calorieAdj,
    workoutAdj,
    goalProgress,
    title,
    user.trainerPreference || 'female'
  );
  
  return report;
}

export async function getLatestWeeklyReport(userId: string): Promise<WeeklyReviewReport | null> {
  const report = await storage.getLatestWeeklyReviewReport(userId);
  return report || null;
}

export async function getWeeklyReportHistory(
  userId: string,
  limit: number = 8
): Promise<WeeklyReviewReport[]> {
  return storage.getWeeklyReviewReportHistory(userId, limit);
}

export async function acknowledgeReport(reportId: string): Promise<WeeklyReviewReport | null> {
  const report = await storage.acknowledgeWeeklyReviewReport(reportId);
  return report || null;
}
