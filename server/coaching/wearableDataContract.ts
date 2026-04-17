/**
 * WEARABLE DATA CONTRACT
 * 
 * NutriCore's wearable data ingestion layer. Treats smartwatch data as noisy,
 * delayed, and directionally useful—NOT ground truth.
 * 
 * CONTRACT PRINCIPLES (NON-NEGOTIABLE):
 * 1. Aggregation-first: No decisions based on single workouts or single nights
 * 2. Trend > Absolute: 7-14 day rolling trends dominate logic
 * 3. Context-free ingestion: Wearable data never directly prescribes—only modulates
 * 4. Failure-tolerant: Missing days, device swaps, sensor drift must not break plans
 * 
 * SUCCESS CRITERION: If the user stops wearing their watch for a week,
 * NutriCore still functions coherently—with slightly less confidence, not broken logic.
 */

import type { DailyActivity, UserWearableBaseline, WearablePhysiologicalFlag } from '@shared/schema';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const BASELINE_WINDOW_MIN_DAYS = 14;
const BASELINE_WINDOW_MAX_DAYS = 21;
const TREND_SHORT_DAYS = 7;
const TREND_LONG_DAYS = 14;

// Trust weights for each signal (0-1)
const SIGNAL_TRUST_WEIGHTS = {
  steps: 0.9,           // High trust
  sleep_duration: 0.6,  // Medium trust
  sleep_efficiency: 0.5, // Medium-low trust
  sleep_stages: 0.3,    // Low trust - don't use for decisions
  calories_burned: 0.3, // Low trust - treat as directional only
  hrv: 0.6,             // Medium trust - trend only
  resting_heart_rate: 0.6, // Medium trust
} as const;

// Z-score thresholds for categorization
const Z_SCORE_THRESHOLDS = {
  significant_low: -1.5,
  mild_low: -0.75,
  normal_low: -0.5,
  normal_high: 0.5,
  mild_high: 0.75,
  significant_high: 1.5,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';
export type RecoveryStatus = 'ok' | 'compromised' | 'unknown';
export type DegradationLevel = 'none' | 'mild' | 'moderate' | 'severe';
export type ActivityLevel = 'low' | 'normal' | 'high' | 'unknown';
export type StressLevel = 'down' | 'normal' | 'up' | 'unknown';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface DailyMetrics {
  date: string;
  steps?: number | null;
  activeCalories?: number | null;
  sleepMinutes?: number | null;
  sleepEfficiency?: number | null;
  hrvRmssd?: number | null;
  restingHeartRate?: number | null;
}

export interface NormalizedMetrics {
  date: string;
  stepsZScore?: number;
  activeCaloriesZScore?: number;
  sleepMinutesZScore?: number;
  sleepEfficiencyZScore?: number;
  hrvZScore?: number;
  restingHrZScore?: number;
  stepsPercentDelta?: number;
  sleepPercentDelta?: number;
  hrvPercentDelta?: number;
  restingHrPercentDelta?: number;
}

export interface TrendAnalysis {
  steps: TrendDirection;
  sleep: TrendDirection;
  hrv: TrendDirection;
  restingHr: TrendDirection;
}

export interface PhysiologicalFlags {
  recoveryStatus: RecoveryStatus;
  recoveryDegradation: DegradationLevel;
  activityLevel: ActivityLevel;
  sleepDebtPresent: boolean;
  sleepDebtSeverity: DegradationLevel;
  physiologicalStress: StressLevel;
  overallConfidence: ConfidenceLevel;
  trend7Day: TrendAnalysis;
  trend14Day: TrendAnalysis;
  stepsPercentDelta?: number;
  sleepPercentDelta?: number;
  hrvPercentDelta?: number;
  restingHrPercentDelta?: number;
  dataAvailability: {
    steps: boolean;
    sleep: boolean;
    hrv: boolean;
    restingHr: boolean;
  };
}

// =============================================================================
// BASELINE CALCULATION
// =============================================================================

export function calculateBaseline(dailyData: DailyMetrics[]): {
  baseline: Partial<UserWearableBaseline>;
  isStable: boolean;
} {
  const validDays = dailyData.filter(d => 
    d.steps != null || d.sleepMinutes != null || d.hrvRmssd != null
  );
  
  if (validDays.length < BASELINE_WINDOW_MIN_DAYS) {
    return {
      baseline: {
        validDaysCount: validDays.length,
        isBaselineStable: false,
      },
      isStable: false,
    };
  }
  
  // Use the most recent 14-21 days
  const windowDays = validDays.slice(-BASELINE_WINDOW_MAX_DAYS);
  
  const stepsValues = windowDays.map(d => d.steps).filter((v): v is number => v != null);
  const caloriesValues = windowDays.map(d => d.activeCalories).filter((v): v is number => v != null);
  const sleepValues = windowDays.map(d => d.sleepMinutes).filter((v): v is number => v != null);
  const sleepEffValues = windowDays.map(d => d.sleepEfficiency).filter((v): v is number => v != null);
  const hrvValues = windowDays.map(d => d.hrvRmssd).filter((v): v is number => v != null);
  const restingHrValues = windowDays.map(d => d.restingHeartRate).filter((v): v is number => v != null);
  
  return {
    baseline: {
      validDaysCount: windowDays.length,
      baselineStartDate: windowDays[0]?.date,
      baselineEndDate: windowDays[windowDays.length - 1]?.date,
      baselineSteps: stepsValues.length >= 7 ? Math.round(mean(stepsValues)) : undefined,
      baselineActiveCalories: caloriesValues.length >= 7 ? Math.round(mean(caloriesValues)) : undefined,
      baselineSleepMinutes: sleepValues.length >= 7 ? Math.round(mean(sleepValues)) : undefined,
      baselineSleepEfficiency: sleepEffValues.length >= 7 ? Math.round(mean(sleepEffValues)) : undefined,
      baselineHrvRmssd: hrvValues.length >= 7 ? mean(hrvValues) : undefined,
      baselineRestingHeartRate: restingHrValues.length >= 7 ? Math.round(mean(restingHrValues)) : undefined,
      stdevSteps: stepsValues.length >= 7 ? standardDeviation(stepsValues) : undefined,
      stdevActiveCalories: caloriesValues.length >= 7 ? standardDeviation(caloriesValues) : undefined,
      stdevSleepMinutes: sleepValues.length >= 7 ? standardDeviation(sleepValues) : undefined,
      stdevSleepEfficiency: sleepEffValues.length >= 7 ? standardDeviation(sleepEffValues) : undefined,
      stdevHrvRmssd: hrvValues.length >= 7 ? standardDeviation(hrvValues) : undefined,
      stdevRestingHeartRate: restingHrValues.length >= 7 ? standardDeviation(restingHrValues) : undefined,
      isBaselineStable: windowDays.length >= BASELINE_WINDOW_MIN_DAYS,
    },
    isStable: windowDays.length >= BASELINE_WINDOW_MIN_DAYS,
  };
}

// =============================================================================
// NORMALIZATION (per-user, not population)
// =============================================================================

export function normalizeMetrics(
  current: DailyMetrics,
  baseline: Partial<UserWearableBaseline>
): NormalizedMetrics {
  const normalized: NormalizedMetrics = { date: current.date };
  
  // Steps z-score
  if (current.steps != null && baseline.baselineSteps && baseline.stdevSteps && baseline.stdevSteps > 0) {
    normalized.stepsZScore = (current.steps - baseline.baselineSteps) / baseline.stdevSteps;
    normalized.stepsPercentDelta = ((current.steps - baseline.baselineSteps) / baseline.baselineSteps) * 100;
  }
  
  // Sleep minutes z-score
  if (current.sleepMinutes != null && baseline.baselineSleepMinutes && baseline.stdevSleepMinutes && baseline.stdevSleepMinutes > 0) {
    normalized.sleepMinutesZScore = (current.sleepMinutes - baseline.baselineSleepMinutes) / baseline.stdevSleepMinutes;
    normalized.sleepPercentDelta = ((current.sleepMinutes - baseline.baselineSleepMinutes) / baseline.baselineSleepMinutes) * 100;
  }
  
  // HRV z-score
  if (current.hrvRmssd != null && baseline.baselineHrvRmssd && baseline.stdevHrvRmssd && baseline.stdevHrvRmssd > 0) {
    normalized.hrvZScore = (current.hrvRmssd - baseline.baselineHrvRmssd) / baseline.stdevHrvRmssd;
    normalized.hrvPercentDelta = ((current.hrvRmssd - baseline.baselineHrvRmssd) / baseline.baselineHrvRmssd) * 100;
  }
  
  // Resting HR z-score (inverted - lower is better)
  if (current.restingHeartRate != null && baseline.baselineRestingHeartRate && baseline.stdevRestingHeartRate && baseline.stdevRestingHeartRate > 0) {
    normalized.restingHrZScore = (current.restingHeartRate - baseline.baselineRestingHeartRate) / baseline.stdevRestingHeartRate;
    normalized.restingHrPercentDelta = ((current.restingHeartRate - baseline.baselineRestingHeartRate) / baseline.baselineRestingHeartRate) * 100;
  }
  
  return normalized;
}

// =============================================================================
// TREND CALCULATION (7-14 day rolling)
// =============================================================================

export function calculateTrend(values: (number | null | undefined)[], windowSize: number): TrendDirection {
  const validValues = values.slice(-windowSize).filter((v): v is number => v != null);
  
  if (validValues.length < Math.ceil(windowSize / 2)) {
    return 'unknown'; // Not enough data
  }
  
  // Simple linear regression slope
  const n = validValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += validValues[i];
    sumXY += i * validValues[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const meanValue = sumY / n;
  
  // Normalize slope by mean to get relative change
  const normalizedSlope = meanValue !== 0 ? (slope / meanValue) * 100 : 0;
  
  // Threshold: >1% change per day = trending
  if (normalizedSlope > 1) return 'up';
  if (normalizedSlope < -1) return 'down';
  return 'stable';
}

export function calculateAllTrends(recentData: DailyMetrics[], windowSize: number): TrendAnalysis {
  return {
    steps: calculateTrend(recentData.map(d => d.steps), windowSize),
    sleep: calculateTrend(recentData.map(d => d.sleepMinutes), windowSize),
    hrv: calculateTrend(recentData.map(d => d.hrvRmssd), windowSize),
    restingHr: calculateTrend(recentData.map(d => d.restingHeartRate), windowSize),
  };
}

// =============================================================================
// FLAG GENERATION (output of this layer)
// =============================================================================

export function generatePhysiologicalFlags(
  recentData: DailyMetrics[],
  baseline: Partial<UserWearableBaseline>
): PhysiologicalFlags {
  const today = recentData[recentData.length - 1];
  const last7Days = recentData.slice(-7);
  const last14Days = recentData.slice(-14);
  
  // Calculate trends
  const trend7Day = calculateAllTrends(last7Days, TREND_SHORT_DAYS);
  const trend14Day = calculateAllTrends(last14Days, TREND_LONG_DAYS);
  
  // Normalize today's metrics
  const normalized = today ? normalizeMetrics(today, baseline) : { date: '' };
  
  // Data availability check
  const dataAvailability = {
    steps: last7Days.some(d => d.steps != null),
    sleep: last7Days.some(d => d.sleepMinutes != null),
    hrv: last7Days.some(d => d.hrvRmssd != null),
    restingHr: last7Days.some(d => d.restingHeartRate != null),
  };
  
  // Calculate confidence based on data availability AND data continuity
  const validDaysCount = last7Days.filter(d => 
    d.steps != null || d.sleepMinutes != null || d.hrvRmssd != null
  ).length;
  const availableSignals = Object.values(dataAvailability).filter(Boolean).length;
  
  // Confidence requires BOTH signal availability AND sufficient data points
  const overallConfidence: ConfidenceLevel = 
    (availableSignals >= 3 && validDaysCount >= 5) ? 'high' :
    (availableSignals >= 2 && validDaysCount >= 3) ? 'medium' : 'low';
  
  // Calculate rolling average HRV delta for trend-based degradation
  const rollingAvgHrvDelta = calculateRollingAvgDelta(last7Days, baseline, 'hrv');
  
  // Recovery status (from HRV + sleep TRENDS - NOT single-day values)
  const recoveryStatus = deriveRecoveryStatus(trend7Day, trend14Day, dataAvailability);
  const recoveryDegradation = deriveRecoveryDegradation(trend7Day, trend14Day, rollingAvgHrvDelta);
  
  // Activity level (from steps TREND)
  const activityLevel = deriveActivityLevel(trend7Day, trend14Day, dataAvailability);
  
  // Sleep debt (from sleep duration TREND)
  const { sleepDebtPresent, sleepDebtSeverity } = deriveSleepDebt(trend7Day, trend14Day, last7Days, baseline);
  
  // Physiological stress (from HRV + resting HR TRENDS)
  const physiologicalStress = derivePhysiologicalStress(trend7Day, trend14Day, dataAvailability);
  
  return {
    recoveryStatus,
    recoveryDegradation,
    activityLevel,
    sleepDebtPresent,
    sleepDebtSeverity,
    physiologicalStress,
    overallConfidence,
    trend7Day,
    trend14Day,
    stepsPercentDelta: normalized.stepsPercentDelta,
    sleepPercentDelta: normalized.sleepPercentDelta,
    hrvPercentDelta: normalized.hrvPercentDelta,
    restingHrPercentDelta: normalized.restingHrPercentDelta,
    dataAvailability,
  };
}

// =============================================================================
// DERIVED FLAGS (private helpers)
// CRITICAL: All flags MUST use rolling 7/14 day trends as PRIMARY input.
// Single-day z-scores are NEVER sufficient alone to flip flags.
// =============================================================================

function deriveRecoveryStatus(
  trend7Day: TrendAnalysis,
  trend14Day: TrendAnalysis,
  availability: { hrv: boolean; sleep: boolean }
): RecoveryStatus {
  // If we don't have HRV or sleep data over the trend window, we can't assess recovery
  if (!availability.hrv && !availability.sleep) {
    return 'unknown';
  }
  
  // CRITICAL: If trends are unknown, we cannot make affirmative statements
  // Return 'unknown' when trends are unknown - never return 'ok' without confirming data
  const hrvTrendsUnknown = trend7Day.hrv === 'unknown' && trend14Day.hrv === 'unknown';
  const sleepTrendsUnknown = trend7Day.sleep === 'unknown' && trend14Day.sleep === 'unknown';
  
  if (availability.hrv && hrvTrendsUnknown && availability.sleep && sleepTrendsUnknown) {
    return 'unknown'; // Have data availability but trends couldn't be calculated
  }
  
  // TREND-FIRST: Recovery is compromised ONLY when trends indicate consistent degradation
  // Single-day values are NEVER sufficient to flip this flag
  
  const hrv7Down = trend7Day.hrv === 'down';
  const hrv14Down = trend14Day.hrv === 'down';
  const sleep7Down = trend7Day.sleep === 'down';
  const sleep14Down = trend14Day.sleep === 'down';
  
  // Conservative: require agreement across BOTH 7-day AND 14-day trends
  // OR require BOTH HRV AND sleep trending down in the same window
  if ((hrv7Down && hrv14Down) || (sleep7Down && sleep14Down) || (hrv7Down && sleep7Down)) {
    return 'compromised';
  }
  
  // Only return 'ok' if we have at least one known trend that isn't unknown
  const hasKnownHrvTrend = trend7Day.hrv !== 'unknown' || trend14Day.hrv !== 'unknown';
  const hasKnownSleepTrend = trend7Day.sleep !== 'unknown' || trend14Day.sleep !== 'unknown';
  
  if (!hasKnownHrvTrend && !hasKnownSleepTrend) {
    return 'unknown';
  }
  
  return 'ok';
}

function deriveRecoveryDegradation(
  trend7Day: TrendAnalysis,
  trend14Day: TrendAnalysis,
  rollingAvgHrvDelta: number | undefined
): DegradationLevel {
  // TREND-FIRST: Use rolling average delta and trend direction, NOT single-day z-scores
  
  // Severe: Both 7-day and 14-day HRV trending down with significant rolling average drop
  if (trend7Day.hrv === 'down' && trend14Day.hrv === 'down' && (rollingAvgHrvDelta ?? 0) < -15) {
    return 'severe';
  }
  
  // Moderate: 7-day HRV down with moderate rolling average drop
  if (trend7Day.hrv === 'down' && (rollingAvgHrvDelta ?? 0) < -10) {
    return 'moderate';
  }
  
  // Mild: 7-day HRV trend down (with or without sleep also down)
  if (trend7Day.hrv === 'down') {
    return 'mild';
  }
  
  return 'none';
}

function deriveActivityLevel(
  trend7Day: TrendAnalysis,
  trend14Day: TrendAnalysis,
  availability: { steps: boolean }
): ActivityLevel {
  if (!availability.steps) {
    return 'unknown';
  }
  
  // CRITICAL: If trends are unknown, return unknown - never assume 'normal'
  if (trend7Day.steps === 'unknown' && trend14Day.steps === 'unknown') {
    return 'unknown';
  }
  
  // TREND-FIRST: Activity level based on step trend direction, NOT single-day count
  // Require trend confirmation from at least the 7-day window
  
  if (trend7Day.steps === 'up') {
    return 'high';
  }
  if (trend7Day.steps === 'down') {
    return 'low';
  }
  
  // Only return 'normal' if we have a known stable trend
  if (trend7Day.steps === 'stable' || trend14Day.steps === 'stable') {
    return 'normal';
  }
  
  // If we still don't have a known trend, return unknown
  return 'unknown';
}

function deriveSleepDebt(
  trend7Day: TrendAnalysis,
  trend14Day: TrendAnalysis,
  last7Days: DailyMetrics[],
  baseline: Partial<UserWearableBaseline>
): { sleepDebtPresent: boolean; sleepDebtSeverity: DegradationLevel } {
  // TREND-FIRST: Sleep debt based on rolling trend, NOT single-day values
  
  // Count nights with valid sleep data below baseline
  const validSleepNights = last7Days.filter(d => d.sleepMinutes != null);
  const belowBaselineNights = validSleepNights.filter(d => {
    if (!baseline.baselineSleepMinutes) return false;
    return (d.sleepMinutes ?? 0) < baseline.baselineSleepMinutes * 0.85; // 15% below baseline
  }).length;
  
  // Sleep debt present if trending down OR multiple below-baseline nights
  // BUT: "Sleep duration ↑ but efficiency ↓ → no automatic recovery credit"
  const durationUp = trend7Day.sleep === 'up';
  const efficiencyDown = last7Days.some(d => 
    d.sleepEfficiency != null && d.sleepEfficiency < 75
  );
  
  if (durationUp && efficiencyDown) {
    // Duration increased but efficiency dropped - no recovery credit
    return { sleepDebtPresent: true, sleepDebtSeverity: 'mild' };
  }
  
  // TREND-BASED severity determination
  // Both 7-day and 14-day trending down = severe
  if ((trend7Day.sleep === 'down' && trend14Day.sleep === 'down') || belowBaselineNights >= 5) {
    return { sleepDebtPresent: true, sleepDebtSeverity: 'severe' };
  }
  // 7-day trending down with multiple below-baseline nights = moderate
  if (trend7Day.sleep === 'down' && belowBaselineNights >= 3) {
    return { sleepDebtPresent: true, sleepDebtSeverity: 'moderate' };
  }
  // 7-day trending down = mild
  if (trend7Day.sleep === 'down') {
    return { sleepDebtPresent: true, sleepDebtSeverity: 'mild' };
  }
  
  return { sleepDebtPresent: false, sleepDebtSeverity: 'none' };
}

function derivePhysiologicalStress(
  trend7Day: TrendAnalysis,
  trend14Day: TrendAnalysis,
  availability: { hrv: boolean; restingHr: boolean }
): StressLevel {
  if (!availability.hrv && !availability.restingHr) {
    return 'unknown';
  }
  
  // CRITICAL: If all relevant trends are unknown, return unknown - never assume 'normal'
  const hrvTrendsUnknown = trend7Day.hrv === 'unknown' && trend14Day.hrv === 'unknown';
  const restingHrTrendsUnknown = trend7Day.restingHr === 'unknown' && trend14Day.restingHr === 'unknown';
  
  if (hrvTrendsUnknown && restingHrTrendsUnknown) {
    return 'unknown';
  }
  
  // TREND-FIRST: HRV down + resting HR up = stress increasing
  // HRV up + resting HR down = stress decreasing
  // Require 7-day trends to agree
  const hrv7Down = trend7Day.hrv === 'down';
  const hrv7Up = trend7Day.hrv === 'up';
  const restingHr7Up = trend7Day.restingHr === 'up';
  const restingHr7Down = trend7Day.restingHr === 'down';
  
  // Conservative: require agreement between 7-day trends of BOTH signals
  if (hrv7Down && restingHr7Up) {
    return 'up';
  }
  if (hrv7Up && restingHr7Down) {
    return 'down';
  }
  
  // Only return 'normal' if we have at least one known stable trend
  const hasStableHrv = trend7Day.hrv === 'stable' || trend14Day.hrv === 'stable';
  const hasStableRestingHr = trend7Day.restingHr === 'stable' || trend14Day.restingHr === 'stable';
  
  if (hasStableHrv || hasStableRestingHr) {
    return 'normal';
  }
  
  // If we have up/down trends but they don't agree, still return normal (conflicting signals)
  if (!hrvTrendsUnknown || !restingHrTrendsUnknown) {
    return 'normal';
  }
  
  return 'unknown';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function calculateRollingAvgDelta(
  data: DailyMetrics[],
  baseline: Partial<UserWearableBaseline>,
  metric: 'hrv' | 'sleep' | 'steps' | 'restingHr'
): number | undefined {
  const metricKey = {
    hrv: 'hrvRmssd',
    sleep: 'sleepMinutes',
    steps: 'steps',
    restingHr: 'restingHeartRate',
  } as const;
  
  const baselineKey = {
    hrv: 'baselineHrvRmssd',
    sleep: 'baselineSleepMinutes',
    steps: 'baselineSteps',
    restingHr: 'baselineRestingHeartRate',
  } as const;
  
  const values = data
    .map(d => d[metricKey[metric]] as number | null | undefined)
    .filter((v): v is number => v != null);
  
  const baselineValue = baseline[baselineKey[metric]] as number | null | undefined;
  
  if (values.length < 3 || !baselineValue) {
    return undefined;
  }
  
  const avg = mean(values);
  return ((avg - baselineValue) / baselineValue) * 100;
}

// =============================================================================
// CONTRACT OUTPUT TRANSFORMATION (for trainer context)
// =============================================================================

export function formatFlagsForTrainer(flags: PhysiologicalFlags): string {
  const lines: string[] = [];
  
  // Only include if confidence is at least medium
  if (flags.overallConfidence === 'low') {
    lines.push('WEARABLE DATA: Limited data available. Flags have low confidence.');
    return lines.join('\n');
  }
  
  lines.push(`WEARABLE SIGNALS (${flags.overallConfidence} confidence):`);
  
  // Recovery
  if (flags.recoveryStatus !== 'unknown') {
    const recoveryLine = flags.recoveryStatus === 'compromised' 
      ? `Recovery: COMPROMISED (${flags.recoveryDegradation})`
      : 'Recovery: OK';
    lines.push(`  ${recoveryLine}`);
  }
  
  // Activity
  if (flags.activityLevel !== 'unknown') {
    lines.push(`  Activity Level: ${flags.activityLevel.toUpperCase()}`);
  }
  
  // Sleep debt
  if (flags.sleepDebtPresent) {
    lines.push(`  Sleep Debt: PRESENT (${flags.sleepDebtSeverity})`);
  }
  
  // Physiological stress
  if (flags.physiologicalStress !== 'unknown' && flags.physiologicalStress !== 'normal') {
    lines.push(`  Physiological Stress: ${flags.physiologicalStress === 'up' ? 'ELEVATED' : 'REDUCED'}`);
  }
  
  // Trend summary (7-day)
  const trends: string[] = [];
  if (flags.trend7Day.hrv !== 'stable' && flags.trend7Day.hrv !== 'unknown') {
    trends.push(`HRV ${flags.trend7Day.hrv}`);
  }
  if (flags.trend7Day.sleep !== 'stable' && flags.trend7Day.sleep !== 'unknown') {
    trends.push(`Sleep ${flags.trend7Day.sleep}`);
  }
  if (trends.length > 0) {
    lines.push(`  7-Day Trends: ${trends.join(', ')}`);
  }
  
  return lines.join('\n');
}

// =============================================================================
// CONVERT DAILY ACTIVITY TO METRICS
// =============================================================================

export function dailyActivityToMetrics(activity: DailyActivity): DailyMetrics {
  return {
    date: activity.date,
    steps: activity.steps,
    activeCalories: activity.caloriesBurned, // Maps to active calories
    sleepMinutes: activity.sleepMinutes,
    sleepEfficiency: activity.sleepEfficiency,
    hrvRmssd: activity.hrvRmssd,
    restingHeartRate: activity.restingHeartRate,
  };
}

// =============================================================================
// ANTI-PATTERNS (documented for clarity)
// =============================================================================

/**
 * EXPLICIT ANTI-PATTERNS - DO NOT IMPLEMENT:
 * 
 * 1. "Eat more today because HRV is low"
 *    - Wearable data never directly prescribes diet
 *    - Flags feed trainer authority, which makes holistic decisions
 * 
 * 2. Daily plan rewrites
 *    - Never rewrite plans based on single-day data
 *    - Trend > absolute, always
 * 
 * 3. Treating wearables as medical devices
 *    - All data is directionally useful, not ground truth
 *    - Conservative conflict resolution (under-react)
 * 
 * 4. Decisions based on single workouts or nights
 *    - Aggregation window minimum: 7 days for trends
 *    - Baseline window minimum: 14 days
 */
