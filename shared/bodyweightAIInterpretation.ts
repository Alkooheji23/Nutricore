/**
 * Bodyweight Trend AI Interpretation Layer
 * 
 * Provides science-based, neutral commentary on bodyweight trends.
 * Silence is a feature - AI only speaks when it has something helpful to say.
 * 
 * SAFEGUARDS:
 * - No medical advice or diagnoses
 * - No promises or predictions
 * - No causal claims
 * - No praise or shame language
 * - No urgency or fear framing
 * - Always trend-focused, never day-focused
 */

import { TrendDataPoint, ChangeSummary, TimeRangeKey, TIME_RANGES } from './bodyweightTrendLogic';

const MIN_DATA_POINTS = 7;
const FLUCTUATION_THRESHOLD_PERCENT = 0.5; // Changes under 0.5% are considered normal fluctuation

export interface AIInterpretation {
  shouldShow: boolean;
  message: string | null;
  confidence: 'low' | 'moderate' | 'high';
}

export interface TrendAnalysis {
  direction: 'decreasing' | 'increasing' | 'stable';
  weeklyRate: number | null; // kg per week (approximate)
  isSustainable: boolean;
  dataQuality: 'insufficient' | 'sparse' | 'adequate' | 'good';
}

/**
 * Analyze the trend data to determine direction and rate
 */
export function analyzeTrend(
  trendData: TrendDataPoint[],
  changeSummary: ChangeSummary,
  timeRange: TimeRangeKey
): TrendAnalysis {
  const dataCount = trendData.length;
  
  // Determine data quality
  let dataQuality: TrendAnalysis['dataQuality'];
  if (dataCount < MIN_DATA_POINTS) {
    dataQuality = 'insufficient';
  } else if (dataCount < 14) {
    dataQuality = 'sparse';
  } else if (dataCount < 30) {
    dataQuality = 'adequate';
  } else {
    dataQuality = 'good';
  }

  // Calculate direction
  const percentChange = changeSummary.netChangePercent;
  let direction: TrendAnalysis['direction'];
  
  if (percentChange === null || Math.abs(percentChange) < FLUCTUATION_THRESHOLD_PERCENT) {
    direction = 'stable';
  } else if (percentChange < 0) {
    direction = 'decreasing';
  } else {
    direction = 'increasing';
  }

  // Calculate approximate weekly rate using actual elapsed days from data
  let weeklyRate: number | null = null;
  if (changeSummary.netChangeKg !== null && changeSummary.startDate && changeSummary.currentDate) {
    const startDate = new Date(changeSummary.startDate);
    const endDate = new Date(changeSummary.currentDate);
    const elapsedDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const weeks = elapsedDays / 7;
    if (weeks > 0.5) { // Only calculate if at least half a week of data
      weeklyRate = Math.round((changeSummary.netChangeKg / weeks) * 10) / 10;
    }
  }

  // Determine if rate is sustainable (generally 0.25-1kg/week for weight loss is considered sustainable)
  const isSustainable = weeklyRate === null || Math.abs(weeklyRate) <= 1.0;

  return {
    direction,
    weeklyRate,
    isSustainable,
    dataQuality,
  };
}

/**
 * Generate AI interpretation based on trend analysis
 * Returns null message when silence is appropriate
 * Enforces safeguards via validateMessage
 * 
 * SILENCE CONDITIONS (silence is a feature):
 * - Data quality is insufficient (<7 points) or sparse (<14 points)
 * - Trend is stable (within normal fluctuation threshold)
 * - Weekly rate is too small to be meaningful
 * - Message fails validation against forbidden language
 */
export function generateInterpretation(
  analysis: TrendAnalysis,
  timeRange: TimeRangeKey
): AIInterpretation {
  // Rule 1: Stay silent when data quality is not adequate or good
  // Only speak when we have enough confidence (14+ data points)
  if (analysis.dataQuality === 'insufficient' || analysis.dataQuality === 'sparse') {
    return {
      shouldShow: false,
      message: null,
      confidence: 'low',
    };
  }

  // Rule 2: Stay silent when trend is stable (normal fluctuation)
  if (analysis.direction === 'stable') {
    return {
      shouldShow: false,
      message: null,
      confidence: 'moderate',
    };
  }

  // Rule 3: Stay silent when weekly rate is too small to be meaningful
  if (analysis.weeklyRate !== null && Math.abs(analysis.weeklyRate) < 0.2) {
    return {
      shouldShow: false,
      message: null,
      confidence: 'low',
    };
  }

  // Generate appropriate message
  const message = buildMessage(analysis, timeRange);
  
  // Rule 4: Enforce safeguards - validate message before displaying
  if (message !== null && !validateMessage(message)) {
    console.warn('AI interpretation suppressed due to safeguard violation');
    return {
      shouldShow: false,
      message: null,
      confidence: 'low',
    };
  }
  
  return {
    shouldShow: message !== null,
    message,
    confidence: analysis.dataQuality === 'good' ? 'high' : 'moderate',
  };
}

/**
 * Build the interpretation message using neutral, trend-focused language
 */
function buildMessage(analysis: TrendAnalysis, timeRange: TimeRangeKey): string | null {
  const timeLabel = TIME_RANGES[timeRange].label.toLowerCase();
  const parts: string[] = [];

  // Direction statement
  if (analysis.direction === 'decreasing') {
    parts.push(`Your bodyweight trend has been gradually decreasing over the past ${timeLabel}.`);
  } else if (analysis.direction === 'increasing') {
    parts.push(`Your bodyweight trend has been gradually increasing over the past ${timeLabel}.`);
  }

  // Rate insight (only if we have enough confidence)
  if (analysis.weeklyRate !== null && analysis.dataQuality !== 'sparse') {
    const absRate = Math.abs(analysis.weeklyRate);
    if (absRate >= 0.2 && absRate <= 1.5) {
      if (analysis.isSustainable) {
        parts.push('The current rate of change appears steady and within a sustainable range.');
      }
    } else if (absRate > 1.5) {
      // Avoid alarming language, just note it's faster than typical
      parts.push('The rate of change is faster than typical gradual trends.');
    }
  }

  // Contextual framing (add occasionally to reinforce holistic view)
  if (parts.length > 0 && analysis.dataQuality === 'good') {
    parts.push('Weight trends are one signal alongside training, activity, and recovery.');
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Non-goals validation - ensures we never violate interpretation boundaries
 */
export const AI_INTERPRETATION_FORBIDDEN = {
  noPraise: ['great', 'amazing', 'excellent', 'good job', 'well done', 'proud', 'awesome'],
  noShame: ['disappointing', 'failed', 'bad', 'poor', 'worse', 'concerning'],
  noMedical: ['diagnosis', 'condition', 'disease', 'symptom', 'treatment', 'prescription'],
  noPromises: ['will lose', 'will gain', 'guaranteed', 'definitely', 'certainly'],
  noCausal: ['because you', 'due to your', 'caused by', 'result of your'],
  noUrgency: ['immediately', 'urgent', 'critical', 'warning', 'danger', 'risk'],
} as const;

/**
 * Validate that a message doesn't contain forbidden language
 */
export function validateMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  for (const category of Object.values(AI_INTERPRETATION_FORBIDDEN)) {
    for (const forbidden of category) {
      if (lowerMessage.includes(forbidden)) {
        console.warn(`AI interpretation contains forbidden term: "${forbidden}"`);
        return false;
      }
    }
  }
  
  return true;
}
