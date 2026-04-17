import { 
  COACHING_DECISION_TYPES, 
  CONFIDENCE_LEVELS,
  type CoachingDecisionType,
  type ConfidenceLevel 
} from "@shared/schema";

export interface DecisionInputMetrics {
  avgRPE: number | null;
  avgSoreness: number | null;
  sleepQuality: number | null;
  weeksSinceDeload: number | null;
  performanceTrend: 'improved' | 'maintained' | 'declined' | null;
  hrvScore: number | null;
  dataPointCount: number;
}

export interface CoachingDecisionResult {
  decisionType: CoachingDecisionType;
  confidence: ConfidenceLevel;
  primaryReason: string;
  inputMetrics: DecisionInputMetrics;
}

const MIN_DATA_POINTS_REQUIRED = 2;

export function evaluateCoachingDecision(metrics: DecisionInputMetrics): CoachingDecisionResult | null {
  if (metrics.dataPointCount < MIN_DATA_POINTS_REQUIRED) {
    return null;
  }

  const { avgRPE, avgSoreness, sleepQuality, weeksSinceDeload, performanceTrend } = metrics;

  if (avgRPE === null && avgSoreness === null && sleepQuality === null) {
    return null;
  }

  const rpe = avgRPE ?? 5;
  const soreness = avgSoreness ?? 3;
  const sleep = sleepQuality ?? 7;
  const weeksNoDeload = weeksSinceDeload ?? 0;

  if (soreness >= 7 && rpe >= 9) {
    return {
      decisionType: COACHING_DECISION_TYPES.DELOAD_SUGGESTED,
      confidence: CONFIDENCE_LEVELS.HIGH,
      primaryReason: "high soreness + elevated RPE",
      inputMetrics: metrics,
    };
  }

  if (weeksNoDeload >= 5 && soreness >= 6) {
    return {
      decisionType: COACHING_DECISION_TYPES.DELOAD_SUGGESTED,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      primaryReason: `${weeksNoDeload} weeks without deload + elevated soreness`,
      inputMetrics: metrics,
    };
  }

  if (sleep <= 5 || performanceTrend === 'declined') {
    const reasons: string[] = [];
    if (sleep <= 5) reasons.push("poor sleep quality");
    if (performanceTrend === 'declined') reasons.push("declining performance");
    
    return {
      decisionType: COACHING_DECISION_TYPES.REDUCE_VOLUME,
      confidence: reasons.length > 1 ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM,
      primaryReason: reasons.join(" + "),
      inputMetrics: metrics,
    };
  }

  if (rpe <= 6 && soreness <= 3 && sleep >= 7) {
    return {
      decisionType: COACHING_DECISION_TYPES.INCREASE_VOLUME,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      primaryReason: "low RPE + good recovery + quality sleep",
      inputMetrics: metrics,
    };
  }

  if (rpe <= 5 && soreness <= 2 && sleep >= 8 && performanceTrend === 'improved') {
    return {
      decisionType: COACHING_DECISION_TYPES.INCREASE_VOLUME,
      confidence: CONFIDENCE_LEVELS.HIGH,
      primaryReason: "excellent recovery + improving performance",
      inputMetrics: metrics,
    };
  }

  return {
    decisionType: COACHING_DECISION_TYPES.MAINTAIN,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    primaryReason: "recovery metrics within normal range",
    inputMetrics: metrics,
  };
}

export function calculatePerformanceTrend(
  recentPerformance: Array<{ weight: number; reps: number; date: Date }>
): 'improved' | 'maintained' | 'declined' | null {
  if (recentPerformance.length < 3) {
    return null;
  }

  const sorted = [...recentPerformance].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const avgFirst = firstHalf.reduce((sum, p) => sum + (p.weight * p.reps), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, p) => sum + (p.weight * p.reps), 0) / secondHalf.length;

  const percentChange = ((avgSecond - avgFirst) / avgFirst) * 100;

  if (percentChange >= 5) return 'improved';
  if (percentChange <= -5) return 'declined';
  return 'maintained';
}

export function calculateWeeksSinceDeload(
  lastDeloadDate: Date | null,
  currentDate: Date = new Date()
): number {
  if (!lastDeloadDate) {
    return 0;
  }

  const diffMs = currentDate.getTime() - lastDeloadDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays / 7);
}
