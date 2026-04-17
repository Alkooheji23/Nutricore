/**
 * Multi-Device Conflict Resolution System
 * 
 * Rules:
 * 1. Primary device is the source of truth when both devices report
 * 2. Fallback to most complete dataset if primary is missing
 * 3. Never sum overlapping metrics (calories, steps, activities)
 * 4. Per-metric source tagging for transparency
 */

import { DEVICE_PROVIDERS, type DeviceProvider } from './schema';

export interface RawDeviceMetric {
  sourceDevice: DeviceProvider;
  steps?: number | null;
  caloriesBurned?: number | null;
  activeMinutes?: number | null;
  distance?: number | null;
  floors?: number | null;
  restingHeartRate?: number | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  heartRateZones?: any;
  hrvRmssd?: number | null;
  hrvScore?: number | null;
  sleepMinutes?: number | null;
  sleepEfficiency?: number | null;
  sleepStages?: any;
  timeInBed?: number | null;
  activities?: any;
  syncedAt?: Date | null;
  isEvaluationData?: boolean;
}

export interface ResolvedMetrics {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number | null;
  floors: number | null;
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  heartRateZones: any;
  hrvRmssd: number | null;
  hrvScore: number | null;
  sleepMinutes: number | null;
  sleepEfficiency: number | null;
  sleepStages: any;
  timeInBed: number | null;
  activities: any;
  source: string; // Primary source used for resolution
  sourcesUsed: { [metric: string]: DeviceProvider }; // Per-metric source tracking
}

/**
 * Check if a value is defined (treats 0 as valid data)
 */
function hasData<T>(value: T | null | undefined): boolean {
  return value !== null && value !== undefined;
}

/**
 * Calculate completeness score for a device's metrics
 * Higher score = more complete data
 * Note: 0 is valid data (e.g., 0 steps on a rest day) and counts as "has data"
 */
function calculateCompletenessScore(metrics: RawDeviceMetric): number {
  let score = 0;
  
  // Movement metrics (high value) - 0 is valid data (rest day)
  if (hasData(metrics.steps)) score += 20;
  if (hasData(metrics.caloriesBurned)) score += 20;
  if (hasData(metrics.activeMinutes)) score += 15;
  if (hasData(metrics.distance)) score += 10;
  if (hasData(metrics.floors)) score += 5;
  
  // Heart rate metrics (medium value)
  if (hasData(metrics.restingHeartRate)) score += 10;
  if (hasData(metrics.averageHeartRate)) score += 5;
  if (hasData(metrics.maxHeartRate)) score += 5;
  if (metrics.heartRateZones) score += 5;
  
  // HRV (high value for recovery tracking)
  if (hasData(metrics.hrvRmssd)) score += 15;
  if (hasData(metrics.hrvScore)) score += 10;
  
  // Sleep metrics (high value) - 0 is valid (no sleep tracked)
  if (hasData(metrics.sleepMinutes)) score += 15;
  if (hasData(metrics.sleepEfficiency)) score += 10;
  if (metrics.sleepStages) score += 10;
  if (hasData(metrics.timeInBed)) score += 5;
  
  return score;
}

/**
 * Resolve a single metric from multiple device sources
 */
function resolveMetric<T>(
  primaryDevice: DeviceProvider | null,
  deviceMetrics: Map<DeviceProvider, T | null | undefined>,
  defaultValue: T
): { value: T; source: DeviceProvider | null } {
  // If primary device has valid data, use it
  if (primaryDevice && deviceMetrics.has(primaryDevice)) {
    const primaryValue = deviceMetrics.get(primaryDevice);
    if (primaryValue !== null && primaryValue !== undefined) {
      return { value: primaryValue, source: primaryDevice };
    }
  }
  
  // Fallback: use the first device with valid data
  const entries = Array.from(deviceMetrics.entries());
  for (const [device, value] of entries) {
    if (value !== null && value !== undefined) {
      return { value, source: device };
    }
  }
  
  return { value: defaultValue, source: null };
}

/**
 * Resolve conflicts between multiple device data sources
 * 
 * @param primaryDevice User's preferred primary device (source of truth)
 * @param rawMetrics Array of raw metrics from all connected devices
 * @returns Resolved metrics with source tracking
 */
export function resolveDeviceConflicts(
  primaryDevice: DeviceProvider | null,
  rawMetrics: RawDeviceMetric[]
): ResolvedMetrics {
  // Filter out evaluation data (Garmin sandbox)
  const productionMetrics = rawMetrics.filter(m => !m.isEvaluationData);
  
  if (productionMetrics.length === 0) {
    // Return empty metrics if no production data
    return {
      steps: 0,
      caloriesBurned: 0,
      activeMinutes: 0,
      distance: null,
      floors: null,
      restingHeartRate: null,
      averageHeartRate: null,
      maxHeartRate: null,
      heartRateZones: null,
      hrvRmssd: null,
      hrvScore: null,
      sleepMinutes: null,
      sleepEfficiency: null,
      sleepStages: null,
      timeInBed: null,
      activities: null,
      source: 'none',
      sourcesUsed: {},
    };
  }
  
  // If only one device, use it directly
  if (productionMetrics.length === 1) {
    const m = productionMetrics[0];
    const device = m.sourceDevice;
    return {
      steps: m.steps || 0,
      caloriesBurned: m.caloriesBurned || 0,
      activeMinutes: m.activeMinutes || 0,
      distance: m.distance || null,
      floors: m.floors || null,
      restingHeartRate: m.restingHeartRate || null,
      averageHeartRate: m.averageHeartRate || null,
      maxHeartRate: m.maxHeartRate || null,
      heartRateZones: m.heartRateZones || null,
      hrvRmssd: m.hrvRmssd || null,
      hrvScore: m.hrvScore || null,
      sleepMinutes: m.sleepMinutes || null,
      sleepEfficiency: m.sleepEfficiency || null,
      sleepStages: m.sleepStages || null,
      timeInBed: m.timeInBed || null,
      activities: m.activities || null,
      source: device,
      sourcesUsed: { all: device },
    };
  }
  
  // Multiple devices - need conflict resolution
  const metricsMap = new Map<DeviceProvider, RawDeviceMetric>();
  for (const m of productionMetrics) {
    metricsMap.set(m.sourceDevice, m);
  }
  
  // If no primary device set, determine based on completeness and recency
  let effectivePrimary = primaryDevice;
  if (!effectivePrimary || !metricsMap.has(effectivePrimary)) {
    let bestScore = -1;
    let bestSyncTime: Date | null = null;
    const mapEntries = Array.from(metricsMap.entries());
    for (const [device, metrics] of mapEntries) {
      const score = calculateCompletenessScore(metrics);
      const syncTime = metrics.syncedAt ? new Date(metrics.syncedAt) : null;
      
      // Prefer higher completeness score
      // If tied, prefer more recent sync time (null sync time is treated as oldest)
      const isBetterScore = score > bestScore;
      const isTiedScoreButNewerSync = score === bestScore && (
        (syncTime && !bestSyncTime) || // This device has sync time, best doesn't
        (syncTime && bestSyncTime && syncTime > bestSyncTime) // Both have sync time, this is newer
      );
      
      if (isBetterScore || isTiedScoreButNewerSync) {
        bestScore = score;
        bestSyncTime = syncTime;
        effectivePrimary = device;
      }
    }
  }
  
  const sourcesUsed: { [metric: string]: DeviceProvider } = {};
  const metricsEntries = Array.from(metricsMap.entries());
  
  // Helper to create metric map from entries
  const createMetricMap = <T>(extractor: (m: RawDeviceMetric) => T | null | undefined) => {
    return new Map<DeviceProvider, T | null | undefined>(
      metricsEntries.map(([d, m]) => [d, extractor(m)])
    );
  };
  
  // Resolve each metric individually
  const stepsResult = resolveMetric(effectivePrimary, createMetricMap(m => m.steps), 0);
  if (stepsResult.source) sourcesUsed.steps = stepsResult.source;
  
  const caloriesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.caloriesBurned), 0);
  if (caloriesResult.source) sourcesUsed.caloriesBurned = caloriesResult.source;
  
  const activeMinutesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.activeMinutes), 0);
  if (activeMinutesResult.source) sourcesUsed.activeMinutes = activeMinutesResult.source;
  
  const distanceResult = resolveMetric(effectivePrimary, createMetricMap(m => m.distance), null);
  if (distanceResult.source) sourcesUsed.distance = distanceResult.source;
  
  const floorsResult = resolveMetric(effectivePrimary, createMetricMap(m => m.floors), null);
  if (floorsResult.source) sourcesUsed.floors = floorsResult.source;
  
  const restingHRResult = resolveMetric(effectivePrimary, createMetricMap(m => m.restingHeartRate), null);
  if (restingHRResult.source) sourcesUsed.restingHeartRate = restingHRResult.source;
  
  const avgHRResult = resolveMetric(effectivePrimary, createMetricMap(m => m.averageHeartRate), null);
  if (avgHRResult.source) sourcesUsed.averageHeartRate = avgHRResult.source;
  
  const maxHRResult = resolveMetric(effectivePrimary, createMetricMap(m => m.maxHeartRate), null);
  if (maxHRResult.source) sourcesUsed.maxHeartRate = maxHRResult.source;
  
  const hrZonesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.heartRateZones), null);
  if (hrZonesResult.source) sourcesUsed.heartRateZones = hrZonesResult.source;
  
  const hrvRmssdResult = resolveMetric(effectivePrimary, createMetricMap(m => m.hrvRmssd), null);
  if (hrvRmssdResult.source) sourcesUsed.hrvRmssd = hrvRmssdResult.source;
  
  const hrvScoreResult = resolveMetric(effectivePrimary, createMetricMap(m => m.hrvScore), null);
  if (hrvScoreResult.source) sourcesUsed.hrvScore = hrvScoreResult.source;
  
  const sleepMinutesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.sleepMinutes), null);
  if (sleepMinutesResult.source) sourcesUsed.sleepMinutes = sleepMinutesResult.source;
  
  const sleepEfficiencyResult = resolveMetric(effectivePrimary, createMetricMap(m => m.sleepEfficiency), null);
  if (sleepEfficiencyResult.source) sourcesUsed.sleepEfficiency = sleepEfficiencyResult.source;
  
  const sleepStagesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.sleepStages), null);
  if (sleepStagesResult.source) sourcesUsed.sleepStages = sleepStagesResult.source;
  
  const timeInBedResult = resolveMetric(effectivePrimary, createMetricMap(m => m.timeInBed), null);
  if (timeInBedResult.source) sourcesUsed.timeInBed = timeInBedResult.source;
  
  const activitiesResult = resolveMetric(effectivePrimary, createMetricMap(m => m.activities), null);
  if (activitiesResult.source) sourcesUsed.activities = activitiesResult.source;
  
  return {
    steps: stepsResult.value,
    caloriesBurned: caloriesResult.value,
    activeMinutes: activeMinutesResult.value,
    distance: distanceResult.value,
    floors: floorsResult.value,
    restingHeartRate: restingHRResult.value,
    averageHeartRate: avgHRResult.value,
    maxHeartRate: maxHRResult.value,
    heartRateZones: hrZonesResult.value,
    hrvRmssd: hrvRmssdResult.value,
    hrvScore: hrvScoreResult.value,
    sleepMinutes: sleepMinutesResult.value,
    sleepEfficiency: sleepEfficiencyResult.value,
    sleepStages: sleepStagesResult.value,
    timeInBed: timeInBedResult.value,
    activities: activitiesResult.value,
    source: effectivePrimary || 'auto',
    sourcesUsed,
  };
}

/**
 * Check if metrics are from Garmin Evaluation Environment
 * Garmin evaluation data should never be treated as production data
 */
export function isGarminEvaluationEnvironment(): boolean {
  // Check for Garmin evaluation environment indicators
  // Normalize env flag values (handle 'true', '1', 'TRUE', etc.)
  const garminEnv = process.env.GARMIN_ENVIRONMENT?.toLowerCase();
  const garminSandbox = process.env.GARMIN_SANDBOX?.toLowerCase();
  
  const isEvaluation = garminEnv === 'evaluation' || 
                       garminEnv === 'sandbox' ||
                       garminSandbox === 'true' ||
                       garminSandbox === '1';
  return isEvaluation;
}

/**
 * Get list of supported device providers
 * Designed to be extensible for future devices (Apple, Whoop, Oura)
 */
export function getSupportedDevices(): DeviceProvider[] {
  return Object.values(DEVICE_PROVIDERS) as DeviceProvider[];
}
