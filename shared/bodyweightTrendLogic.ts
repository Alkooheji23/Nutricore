/**
 * Bodyweight Trend - Chart Behavior & Data Logic
 * 
 * Implements smoothing algorithms and data processing for the Bodyweight Trend feature.
 * Reference: shared/bodyweightTrendConcept.ts for positioning and naming rules.
 */

import { BODYWEIGHT_TREND_CONCEPT } from './bodyweightTrendConcept';

// Time range options
export const TIME_RANGES = {
  TWO_WEEKS: { days: 14, label: '2 Weeks', smoothingWindow: 3 },
  ONE_MONTH: { days: 30, label: '1 Month', smoothingWindow: 5 },
  THREE_MONTHS: { days: 90, label: '3 Months', smoothingWindow: 7 },
  SIX_MONTHS: { days: 180, label: '6 Months', smoothingWindow: 10 },
  ONE_YEAR: { days: 365, label: '1 Year', smoothingWindow: 14 },
} as const;

export type TimeRangeKey = keyof typeof TIME_RANGES;
export const DEFAULT_TIME_RANGE: TimeRangeKey = 'ONE_MONTH';

export interface BodyweightDataPoint {
  date: string; // YYYY-MM-DD
  weight: number; // kg
  source: 'manual' | 'device';
}

export interface TrendDataPoint {
  date: string;
  actualWeight: number | null; // null for days with no data
  trendWeight: number; // smoothed value
}

export interface ChangeSummary {
  startWeight: number | null;
  startDate: string | null;
  currentWeight: number | null;
  currentDate: string | null;
  netChangeKg: number | null;
  netChangePercent: number | null;
}

/**
 * Calculate smoothed trend line using weighted moving average
 * Adapts smoothing window based on selected timeframe
 */
export function calculateTrendLine(
  dataPoints: BodyweightDataPoint[],
  timeRange: TimeRangeKey
): TrendDataPoint[] {
  if (dataPoints.length === 0) return [];
  
  const window = TIME_RANGES[timeRange].smoothingWindow;
  const sorted = [...dataPoints].sort((a, b) => a.date.localeCompare(b.date));
  
  const result: TrendDataPoint[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    // Get points within the smoothing window (centered)
    const halfWindow = Math.floor(window / 2);
    const windowStart = Math.max(0, i - halfWindow);
    const windowEnd = Math.min(sorted.length - 1, i + halfWindow);
    
    // Calculate weighted average (more recent = higher weight)
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let j = windowStart; j <= windowEnd; j++) {
      // Gaussian-like weighting: closer to center = higher weight
      const distance = Math.abs(j - i);
      const weight = Math.exp(-0.5 * Math.pow(distance / (halfWindow || 1), 2));
      weightedSum += sorted[j].weight * weight;
      totalWeight += weight;
    }
    
    result.push({
      date: current.date,
      actualWeight: current.weight,
      trendWeight: totalWeight > 0 ? weightedSum / totalWeight : current.weight,
    });
  }
  
  return result;
}

/**
 * Calculate change summary for display
 * Returns Start, Current, and Net Change values
 */
export function calculateChangeSummary(
  dataPoints: BodyweightDataPoint[]
): ChangeSummary {
  if (dataPoints.length === 0) {
    return {
      startWeight: null,
      startDate: null,
      currentWeight: null,
      currentDate: null,
      netChangeKg: null,
      netChangePercent: null,
    };
  }
  
  const sorted = [...dataPoints].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  const netChangeKg = last.weight - first.weight;
  const netChangePercent = first.weight > 0 
    ? (netChangeKg / first.weight) * 100 
    : 0;
  
  return {
    startWeight: first.weight,
    startDate: first.date,
    currentWeight: last.weight,
    currentDate: last.date,
    netChangeKg: Math.round(netChangeKg * 10) / 10, // 1 decimal place
    netChangePercent: Math.round(netChangePercent * 10) / 10,
  };
}

/**
 * Filter data points by time range
 */
export function filterByTimeRange(
  dataPoints: BodyweightDataPoint[],
  timeRange: TimeRangeKey
): BodyweightDataPoint[] {
  const days = TIME_RANGES[timeRange].days;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  return dataPoints.filter(dp => dp.date >= cutoffStr);
}

/**
 * Get the time range options for UI rendering
 */
export function getTimeRangeOptions(): Array<{ key: TimeRangeKey; label: string }> {
  return Object.entries(TIME_RANGES).map(([key, value]) => ({
    key: key as TimeRangeKey,
    label: value.label,
  }));
}

/**
 * Format weight change for display (neutral language per concept rules)
 */
export function formatNetChange(netChangeKg: number | null): string {
  if (netChangeKg === null) return '--';
  const sign = netChangeKg >= 0 ? '+' : '';
  return `${sign}${netChangeKg.toFixed(1)} kg`;
}

/**
 * Format percentage change for display
 */
export function formatPercentChange(netChangePercent: number | null): string {
  if (netChangePercent === null) return '';
  const sign = netChangePercent >= 0 ? '+' : '';
  return `(${sign}${netChangePercent.toFixed(1)}%)`;
}

/**
 * Non-goals validation - ensures we don't violate concept boundaries
 */
export const TREND_LOGIC_NON_GOALS = {
  noCalorieMath: true,
  noCausationClaims: true, // Never say "because of workouts/diet"
  noDailyNotifications: true,
} as const;
