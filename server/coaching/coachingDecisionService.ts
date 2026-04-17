import { storage } from "../storage";
import { 
  evaluateCoachingDecision, 
  calculatePerformanceTrend,
  calculateWeeksSinceDeload,
  type DecisionInputMetrics,
  type CoachingDecisionResult 
} from "./coachingDecisionEngine";
import type { CoachingDecision, InsertCoachingDecision } from "@shared/schema";

export interface DecisionGenerationResult {
  decision: CoachingDecision | null;
  skipped: boolean;
  reason?: string;
}

export async function generateCoachingDecision(userId: string): Promise<DecisionGenerationResult> {
  const metrics = await gatherUserMetrics(userId);
  
  const result = evaluateCoachingDecision(metrics);
  
  if (!result) {
    return {
      decision: null,
      skipped: true,
      reason: "Insufficient data to generate decision",
    };
  }

  const decisionData: InsertCoachingDecision = {
    userId,
    decisionType: result.decisionType,
    confidence: result.confidence,
    primaryReason: result.primaryReason,
    inputMetrics: result.inputMetrics,
  };

  const savedDecision = await storage.createCoachingDecision(decisionData);

  return {
    decision: savedDecision,
    skipped: false,
  };
}

async function gatherUserMetrics(userId: string): Promise<DecisionInputMetrics> {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [recentCheckIns, workoutLogs, previousDecisions] = await Promise.all([
    storage.getWeeklyCheckIns(userId, 4),
    storage.getWorkoutLogs(userId, fourWeeksAgo, new Date()),
    storage.getCoachingDecisionHistory(userId, 10),
  ]);

  let avgRPE: number | null = null;
  let avgSoreness: number | null = null;
  let sleepQuality: number | null = null;
  let hrvScore: number | null = null;

  if (recentCheckIns.length > 0) {
    const rpeValues = recentCheckIns.filter(c => c.averageRPE != null).map(c => c.averageRPE!);
    const sorenessValues = recentCheckIns.filter(c => c.soreness != null).map(c => c.soreness!);
    const sleepValues = recentCheckIns.filter(c => c.sleepQuality != null).map(c => c.sleepQuality!);
    
    avgRPE = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
    avgSoreness = sorenessValues.length > 0 ? sorenessValues.reduce((a, b) => a + b, 0) / sorenessValues.length : null;
    sleepQuality = sleepValues.length > 0 ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null;
  }

  let performanceTrend: 'improved' | 'maintained' | 'declined' | null = null;
  if (workoutLogs.length >= 3) {
    const performanceData = workoutLogs
      .filter(w => w.exercises && Array.isArray(w.exercises))
      .flatMap(w => {
        const exercises = w.exercises as Array<{ sets?: Array<{ weight?: number; reps?: number }> }>;
        return exercises.flatMap(e => 
          (e.sets || []).map(s => ({
            weight: s.weight || 0,
            reps: s.reps || 0,
            date: w.date,
          }))
        );
      })
      .filter(p => p.weight > 0 && p.reps > 0);
    
    performanceTrend = calculatePerformanceTrend(performanceData);
  }

  let weeksSinceDeload: number | null = null;
  const lastDeloadDecision = previousDecisions.find(d => d.decisionType === 'deload_suggested');
  if (lastDeloadDecision?.generatedAt) {
    weeksSinceDeload = calculateWeeksSinceDeload(lastDeloadDecision.generatedAt);
  }

  const dataPointCount = recentCheckIns.length + workoutLogs.length;

  return {
    avgRPE,
    avgSoreness,
    sleepQuality,
    weeksSinceDeload,
    performanceTrend,
    hrvScore,
    dataPointCount,
  };
}

export async function getLatestDecision(userId: string): Promise<CoachingDecision | null> {
  const decision = await storage.getLatestCoachingDecision(userId);
  return decision || null;
}

export async function markDecisionAsSurfaced(decisionId: string): Promise<void> {
  await storage.markDecisionSurfaced(decisionId);
}
