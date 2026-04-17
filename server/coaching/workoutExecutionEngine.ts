/**
 * Workout Execution Engine - Live in-session workout management
 * 
 * This engine runs training in-session. It is NOT for planning or strategy.
 * It operates set-by-set, calling the next action based on current session data.
 * 
 * Core principles:
 * - One decision at a time
 * - No retroactive changes
 * - No mid-session goal switching
 * - Log everything
 * - Short, actionable instructions
 */

import type {
  SetLogInput,
  SetDecisionResult,
  CardioDecisionResult,
  ExercisePlanItem,
  CardioPlanItem,
  SetDecision,
  CardioIntervalType,
  HeartRateZone,
  LiveSetLog,
  CardioInterval,
} from '@shared/schema';

import {
  SET_DECISION,
  CARDIO_INTERVAL_TYPE,
  HEART_RATE_ZONE,
} from '@shared/schema';

// =============================================================================
// CONSTANTS & THRESHOLDS
// =============================================================================

const RPE_THRESHOLDS = {
  TOO_EASY: 6,
  TARGET_LOW: 7,
  TARGET_HIGH: 9,
  TOO_HARD: 9.5,
  FAILURE: 10,
} as const;

const RIR_THRESHOLDS = {
  TOO_EASY: 4,
  TARGET_LOW: 2,
  TARGET_HIGH: 1,
  FAILURE: 0,
} as const;

const WEIGHT_ADJUSTMENTS = {
  SMALL_INCREASE: 2.5,
  STANDARD_INCREASE: 5,
  SMALL_DECREASE: 2.5,
  STANDARD_DECREASE: 5,
  LARGE_DECREASE: 10,
} as const;

const REST_TIMES = {
  COMPOUND_SECONDS: 180,
  ISOLATION_SECONDS: 90,
  AFTER_FAILURE_SECONDS: 240,
  MINIMUM_SECONDS: 60,
} as const;

const PERFORMANCE_DROP_THRESHOLD = 0.25; // 25% drop in reps = end exercise

// =============================================================================
// SET DECISION ENGINE
// =============================================================================

export interface SetContext {
  currentSet: SetLogInput;
  previousSets: LiveSetLog[];
  targetRpe: number;
  targetReps: string;
  exerciseName: string;
  targetSets: number;
  currentSetNumber: number;
  isCompound: boolean;
}

export function decideNextSet(context: SetContext): SetDecisionResult {
  const { currentSet, previousSets, targetRpe, targetReps, targetSets, currentSetNumber, isCompound } = context;
  
  const rpe = currentSet.rpe ?? rirToRpe(currentSet.repsInReserve);
  const targetRepRange = parseRepRange(targetReps);
  const baseRestTime = isCompound ? REST_TIMES.COMPOUND_SECONDS : REST_TIMES.ISOLATION_SECONDS;
  
  // Check if target sets completed
  if (currentSetNumber >= targetSets) {
    return {
      decision: SET_DECISION.END_EXERCISE,
      reason: `Target ${targetSets} sets completed.`,
      nextSetWeight: currentSet.weight,
      nextSetReps: targetRepRange.max,
      restSeconds: 0,
      endExercise: true,
    };
  }
  
  // Check for performance drop
  if (previousSets.length > 0) {
    const firstSetReps = previousSets[0]?.actualReps ?? 0;
    const dropPercent = firstSetReps > 0 ? (firstSetReps - currentSet.reps) / firstSetReps : 0;
    
    if (dropPercent >= PERFORMANCE_DROP_THRESHOLD) {
      return {
        decision: SET_DECISION.END_EXERCISE,
        reason: `Performance dropped ${Math.round(dropPercent * 100)}%. Ending exercise.`,
        nextSetWeight: currentSet.weight,
        nextSetReps: currentSet.reps,
        restSeconds: 0,
        endExercise: true,
      };
    }
  }
  
  // Check for failure
  if (rpe >= RPE_THRESHOLDS.FAILURE) {
    return {
      decision: SET_DECISION.REDUCE,
      reason: 'Hit failure. Reducing weight for next set.',
      nextSetWeight: currentSet.weight - WEIGHT_ADJUSTMENTS.LARGE_DECREASE,
      nextSetReps: targetRepRange.min,
      restSeconds: REST_TIMES.AFTER_FAILURE_SECONDS,
      endExercise: false,
    };
  }
  
  // Determine next set based on RPE
  const decision = determineLoadDecision(rpe, targetRpe, currentSet.reps, targetRepRange);
  
  return {
    ...decision,
    restSeconds: rpe >= RPE_THRESHOLDS.TOO_HARD ? baseRestTime + 60 : baseRestTime,
    endExercise: false,
  };
}

function determineLoadDecision(
  actualRpe: number,
  targetRpe: number,
  actualReps: number,
  targetRepRange: { min: number; max: number }
): Omit<SetDecisionResult, 'restSeconds' | 'endExercise'> {
  const rpeDiff = actualRpe - targetRpe;
  
  // RPE too low (too easy)
  if (rpeDiff <= -2) {
    return {
      decision: SET_DECISION.INCREASE,
      reason: `RPE ${actualRpe} is well below target ${targetRpe}. Increasing weight.`,
      nextSetWeight: 0, // Placeholder - needs actual weight
      nextSetReps: targetRepRange.max,
    };
  }
  
  if (rpeDiff <= -1) {
    return {
      decision: SET_DECISION.INCREASE,
      reason: `RPE ${actualRpe} is below target. Small weight increase.`,
      nextSetWeight: 0,
      nextSetReps: targetRepRange.max,
    };
  }
  
  // RPE too high
  if (rpeDiff >= 1) {
    return {
      decision: SET_DECISION.REDUCE,
      reason: `RPE ${actualRpe} exceeds target ${targetRpe}. Reducing weight.`,
      nextSetWeight: 0,
      nextSetReps: targetRepRange.min,
    };
  }
  
  // RPE in target range
  return {
    decision: SET_DECISION.HOLD,
    reason: `RPE ${actualRpe} is on target. Maintain weight.`,
    nextSetWeight: 0,
    nextSetReps: actualReps,
  };
}

export function calculateNextSetWeight(
  currentWeight: number,
  decision: SetDecision,
  isBarbell: boolean = true
): number {
  const increment = isBarbell ? WEIGHT_ADJUSTMENTS.STANDARD_INCREASE : WEIGHT_ADJUSTMENTS.SMALL_INCREASE;
  const decrement = isBarbell ? WEIGHT_ADJUSTMENTS.STANDARD_DECREASE : WEIGHT_ADJUSTMENTS.SMALL_DECREASE;
  
  switch (decision) {
    case SET_DECISION.INCREASE:
      return currentWeight + increment;
    case SET_DECISION.REDUCE:
      return Math.max(0, currentWeight - decrement);
    case SET_DECISION.HOLD:
    case SET_DECISION.END_EXERCISE:
    default:
      return currentWeight;
  }
}

// =============================================================================
// CARDIO DECISION ENGINE (Walking + Jogging Model)
// =============================================================================

export interface CardioContext {
  currentInterval: {
    type: CardioIntervalType;
    durationSeconds: number;
    speed?: number;
    heartRate?: number;
    perceivedExertion?: number;
  };
  previousIntervals: CardioInterval[];
  cardioPlan: CardioPlanItem;
  totalElapsedMinutes: number;
}

export function decideNextCardioInterval(context: CardioContext): CardioDecisionResult {
  const { currentInterval, previousIntervals, cardioPlan, totalElapsedMinutes } = context;
  
  // Check if target duration reached
  if (totalElapsedMinutes >= cardioPlan.totalTargetMinutes) {
    return {
      nextIntervalType: CARDIO_INTERVAL_TYPE.REST,
      nextDuration: 0,
      reason: `Target ${cardioPlan.totalTargetMinutes} minutes completed. Session done.`,
      endCardio: true,
    };
  }
  
  const fatigue = assessCardioFatigue(currentInterval, previousIntervals);
  const currentType = currentInterval.type;
  
  // Fatigue-based adjustments
  if (fatigue === 'high') {
    if (currentType === CARDIO_INTERVAL_TYPE.JOGGING) {
      return {
        nextIntervalType: CARDIO_INTERVAL_TYPE.WALKING,
        nextDuration: cardioPlan.defaultWalkDuration * 1.5, // Extended walking
        reason: 'Fatigue high. Extended walking interval.',
        endCardio: false,
      };
    }
    return {
      nextIntervalType: CARDIO_INTERVAL_TYPE.WALKING,
      nextDuration: cardioPlan.defaultWalkDuration,
      reason: 'Continue walking for recovery.',
      endCardio: false,
    };
  }
  
  if (fatigue === 'low') {
    if (currentType === CARDIO_INTERVAL_TYPE.WALKING) {
      return {
        nextIntervalType: CARDIO_INTERVAL_TYPE.JOGGING,
        nextDuration: cardioPlan.defaultJogDuration * 1.25, // Extended jogging
        reason: 'Energy strong. Extended jogging interval.',
        endCardio: false,
      };
    }
    return {
      nextIntervalType: CARDIO_INTERVAL_TYPE.JOGGING,
      nextDuration: cardioPlan.defaultJogDuration,
      reason: 'Continue jogging.',
      endCardio: false,
    };
  }
  
  // Normal fatigue - alternate intervals
  if (currentType === CARDIO_INTERVAL_TYPE.WALKING) {
    return {
      nextIntervalType: CARDIO_INTERVAL_TYPE.JOGGING,
      nextDuration: cardioPlan.defaultJogDuration,
      reason: 'Switch to jogging.',
      endCardio: false,
    };
  }
  
  return {
    nextIntervalType: CARDIO_INTERVAL_TYPE.WALKING,
    nextDuration: cardioPlan.defaultWalkDuration,
    reason: 'Switch to walking for recovery.',
    endCardio: false,
  };
}

function assessCardioFatigue(
  currentInterval: CardioContext['currentInterval'],
  previousIntervals: CardioInterval[]
): 'low' | 'normal' | 'high' {
  const { heartRate, perceivedExertion } = currentInterval;
  
  // Use perceived exertion if available (1-10 scale)
  if (perceivedExertion !== undefined) {
    if (perceivedExertion >= 8) return 'high';
    if (perceivedExertion <= 4) return 'low';
    return 'normal';
  }
  
  // Use heart rate zone if available
  if (heartRate !== undefined) {
    const zone = getHeartRateZone(heartRate, 190); // Default max HR estimate
    if (zone === HEART_RATE_ZONE.ZONE_4 || zone === HEART_RATE_ZONE.ZONE_5) return 'high';
    if (zone === HEART_RATE_ZONE.ZONE_1) return 'low';
    return 'normal';
  }
  
  // Check trend from previous intervals
  const recentJoggingIntervals = previousIntervals
    .slice(-3)
    .filter(i => i.intervalType === CARDIO_INTERVAL_TYPE.JOGGING);
  
  if (recentJoggingIntervals.length >= 2) {
    const avgExertion = recentJoggingIntervals.reduce((sum, i) => sum + (i.perceivedExertion ?? 5), 0) / recentJoggingIntervals.length;
    if (avgExertion >= 7) return 'high';
    if (avgExertion <= 4) return 'low';
  }
  
  return 'normal';
}

export function getHeartRateZone(heartRate: number, maxHr: number): HeartRateZone {
  const percentage = (heartRate / maxHr) * 100;
  
  if (percentage < 50) return HEART_RATE_ZONE.ZONE_1;
  if (percentage < 60) return HEART_RATE_ZONE.ZONE_2;
  if (percentage < 70) return HEART_RATE_ZONE.ZONE_3;
  if (percentage < 80) return HEART_RATE_ZONE.ZONE_4;
  if (percentage <= 100) return HEART_RATE_ZONE.ZONE_5;
  return HEART_RATE_ZONE.UNKNOWN;
}

// =============================================================================
// INSTRUCTION GENERATION (Trainer Voice)
// =============================================================================

export interface NextInstruction {
  action: 'do_set' | 'rest' | 'next_exercise' | 'start_cardio' | 'cardio_interval' | 'session_complete';
  message: string;
  details?: {
    weight?: number;
    reps?: number;
    restSeconds?: number;
    exerciseName?: string;
    intervalType?: CardioIntervalType;
    durationSeconds?: number;
  };
}

export function generateSetInstruction(
  exerciseName: string,
  setNumber: number,
  weight: number,
  targetReps: number,
  weightUnit: string = 'kg'
): NextInstruction {
  return {
    action: 'do_set',
    message: `${exerciseName} - Set ${setNumber}: ${weight}${weightUnit} x ${targetReps} reps`,
    details: {
      exerciseName,
      weight,
      reps: targetReps,
    },
  };
}

export function generateRestInstruction(restSeconds: number, reason: string): NextInstruction {
  const minutes = Math.floor(restSeconds / 60);
  const seconds = restSeconds % 60;
  const timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
  
  return {
    action: 'rest',
    message: `Rest ${timeStr}. ${reason}`,
    details: {
      restSeconds,
    },
  };
}

export function generateNextExerciseInstruction(
  exerciseName: string,
  targetSets: number,
  targetReps: string,
  startingWeight?: number,
  weightUnit: string = 'kg'
): NextInstruction {
  const weightStr = startingWeight ? ` @ ${startingWeight}${weightUnit}` : '';
  return {
    action: 'next_exercise',
    message: `Next: ${exerciseName} - ${targetSets} sets x ${targetReps}${weightStr}`,
    details: {
      exerciseName,
      weight: startingWeight,
    },
  };
}

export function generateCardioInstruction(
  intervalType: CardioIntervalType,
  durationSeconds: number,
  reason: string
): NextInstruction {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timeStr = minutes > 0 
    ? (seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} min`)
    : `${seconds}s`;
  
  const actionWord = intervalType === CARDIO_INTERVAL_TYPE.WALKING ? 'Walk' : 'Jog';
  
  return {
    action: 'cardio_interval',
    message: `${actionWord} for ${timeStr}. ${reason}`,
    details: {
      intervalType,
      durationSeconds,
    },
  };
}

export function generateSessionCompleteInstruction(summary: string): NextInstruction {
  return {
    action: 'session_complete',
    message: `Session complete. ${summary}`,
  };
}

// =============================================================================
// SESSION STATE MANAGEMENT
// =============================================================================

export interface SessionState {
  sessionId: string;
  userId: string;
  phase: 'weights' | 'cardio' | 'complete';
  currentExerciseIndex: number;
  currentSetNumber: number;
  exercises: ExercisePlanItem[];
  cardioPlan?: CardioPlanItem;
  completedSets: LiveSetLog[];
  completedCardioIntervals: CardioInterval[];
}

export function getNextAction(state: SessionState): NextInstruction {
  if (state.phase === 'complete') {
    return generateSessionCompleteInstruction(generateSessionSummary(state));
  }
  
  if (state.phase === 'weights') {
    const currentExercise = state.exercises[state.currentExerciseIndex];
    
    if (!currentExercise) {
      // All exercises complete - move to cardio or end
      if (state.cardioPlan) {
        return {
          action: 'start_cardio',
          message: 'Weights complete. Starting cardio.',
        };
      }
      return generateSessionCompleteInstruction(generateSessionSummary(state));
    }
    
    // Get previous sets for this exercise
    const exerciseSets = state.completedSets.filter(
      s => s.exerciseOrder === currentExercise.exerciseOrder
    );
    
    if (state.currentSetNumber === 1 && exerciseSets.length === 0) {
      return generateNextExerciseInstruction(
        currentExercise.exerciseName,
        currentExercise.targetSets,
        currentExercise.targetReps,
        currentExercise.startingWeight
      );
    }
    
    const lastSet = exerciseSets[exerciseSets.length - 1];
    const nextWeight = lastSet 
      ? lastSet.nextSetWeight ?? lastSet.actualWeight ?? currentExercise.startingWeight ?? 0
      : currentExercise.startingWeight ?? 0;
    
    const targetRepRange = parseRepRange(currentExercise.targetReps);
    
    return generateSetInstruction(
      currentExercise.exerciseName,
      state.currentSetNumber,
      nextWeight,
      targetRepRange.max
    );
  }
  
  // Cardio phase
  if (state.phase === 'cardio' && state.cardioPlan) {
    const lastInterval = state.completedCardioIntervals[state.completedCardioIntervals.length - 1];
    
    if (!lastInterval) {
      // First cardio interval - start with walking
      return generateCardioInstruction(
        CARDIO_INTERVAL_TYPE.WALKING,
        state.cardioPlan.defaultWalkDuration,
        'Starting cardio with warm-up walk.'
      );
    }
    
    // Calculate total elapsed time
    const totalElapsed = state.completedCardioIntervals.reduce(
      (sum, i) => sum + (i.actualDurationSeconds ?? 0),
      0
    ) / 60;
    
    const decision = decideNextCardioInterval({
      currentInterval: {
        type: lastInterval.intervalType as CardioIntervalType,
        durationSeconds: lastInterval.actualDurationSeconds ?? 0,
        heartRate: lastInterval.averageHeartRate ?? undefined,
        perceivedExertion: lastInterval.perceivedExertion ?? undefined,
      },
      previousIntervals: state.completedCardioIntervals,
      cardioPlan: state.cardioPlan,
      totalElapsedMinutes: totalElapsed,
    });
    
    if (decision.endCardio) {
      return generateSessionCompleteInstruction(generateSessionSummary(state));
    }
    
    return generateCardioInstruction(
      decision.nextIntervalType,
      decision.nextDuration,
      decision.reason
    );
  }
  
  return generateSessionCompleteInstruction(generateSessionSummary(state));
}

function generateSessionSummary(state: SessionState): string {
  const totalSets = state.completedSets.length;
  const exercises = new Set(state.completedSets.map(s => s.exerciseName)).size;
  const cardioMinutes = Math.round(
    state.completedCardioIntervals.reduce((sum, i) => sum + (i.actualDurationSeconds ?? 0), 0) / 60
  );
  
  const parts: string[] = [];
  if (totalSets > 0) {
    parts.push(`${exercises} exercises, ${totalSets} sets`);
  }
  if (cardioMinutes > 0) {
    parts.push(`${cardioMinutes} min cardio`);
  }
  
  return parts.join(' + ') || 'Session logged.';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function rirToRpe(rir: number | undefined): number {
  if (rir === undefined) return 7; // Default to moderate
  return 10 - rir;
}

function parseRepRange(repRangeStr: string): { min: number; max: number } {
  const match = repRangeStr.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  const single = parseInt(repRangeStr);
  if (!isNaN(single)) {
    return { min: single, max: single };
  }
  return { min: 8, max: 12 };
}

export function isCompoundExercise(exerciseName: string): boolean {
  const compounds = [
    'squat', 'deadlift', 'bench', 'press', 'row', 'pull-up', 'pullup',
    'chin-up', 'chinup', 'dip', 'lunge', 'clean', 'snatch', 'thruster'
  ];
  const nameLower = exerciseName.toLowerCase();
  return compounds.some(c => nameLower.includes(c));
}

// =============================================================================
// WORKOUT EXECUTION ENGINE CLASS
// Stateful session management for real-time workout execution
// =============================================================================

export type SessionPhase = 'warmup' | 'weights' | 'cardio' | 'cooldown' | 'complete';

export interface SetCompletionData {
  exerciseName: string;
  setNumber: number;
  targetWeight?: number;
  targetReps?: number;
  actualWeight: number;
  actualReps: number;
  rpe?: number;
  rir?: number;
}

export interface CardioCompletionData {
  intervalNumber: number;
  type: CardioIntervalType;
  durationSeconds: number;
  heartRate?: number;
  perceivedExertion?: number;
}

export interface ExecutionDecision {
  phase: SessionPhase;
  action: 'continue' | 'next_set' | 'next_exercise' | 'start_cardio' | 'next_interval' | 'complete';
  instruction: string;
  note: string;
  nextWeight?: number;
  nextReps?: number;
  restSeconds?: number;
  nextIntervalType?: CardioIntervalType;
  nextIntervalDuration?: number;
}

export interface EngineState {
  phase: SessionPhase;
  currentExerciseIndex: number;
  currentSetNumber: number;
  totalCardioSeconds: number;
  completedExercises: string[];
}

export class WorkoutExecutionEngine {
  private phase: SessionPhase;
  private currentExerciseIndex: number;
  private currentSetNumber: number;
  private totalCardioSeconds: number;
  private completedExercises: string[];
  private exercisePlan: ExercisePlanItem[];
  private cardioPlan: CardioPlanItem;
  private exerciseHistory: Record<string, { lastWeight: number; lastReps: number; lastRir?: number }>;

  constructor(
    exercisePlan: ExercisePlanItem[],
    cardioPlan: CardioPlanItem,
    exerciseHistory: Record<string, { lastWeight: number; lastReps: number; lastRir?: number }> = {},
    savedState?: EngineState
  ) {
    this.exercisePlan = exercisePlan;
    this.cardioPlan = cardioPlan;
    this.exerciseHistory = exerciseHistory;

    if (savedState) {
      this.phase = savedState.phase;
      this.currentExerciseIndex = savedState.currentExerciseIndex;
      this.currentSetNumber = savedState.currentSetNumber;
      this.totalCardioSeconds = savedState.totalCardioSeconds;
      this.completedExercises = savedState.completedExercises;
    } else {
      this.phase = 'warmup';
      this.currentExerciseIndex = 0;
      this.currentSetNumber = 1;
      this.totalCardioSeconds = 0;
      this.completedExercises = [];
    }
  }

  getState(): EngineState {
    return {
      phase: this.phase,
      currentExerciseIndex: this.currentExerciseIndex,
      currentSetNumber: this.currentSetNumber,
      totalCardioSeconds: this.totalCardioSeconds,
      completedExercises: [...this.completedExercises],
    };
  }

  advancePhase(): ExecutionDecision {
    switch (this.phase) {
      case 'warmup':
        this.phase = this.exercisePlan.length > 0 ? 'weights' : 
                     (this.cardioPlan.totalTargetMinutes > 0 ? 'cardio' : 'complete');
        if (this.phase === 'weights') {
          const exercise = this.exercisePlan[0];
          return {
            phase: this.phase,
            action: 'next_set',
            instruction: `Start ${exercise?.exerciseName || 'weights'} - Set 1`,
            note: 'Beginning strength training.',
          };
        }
        if (this.phase === 'cardio') {
          return {
            phase: this.phase,
            action: 'start_cardio',
            instruction: 'Start with a walking interval',
            note: 'Beginning cardio.',
            nextIntervalType: CARDIO_INTERVAL_TYPE.WALKING,
            nextIntervalDuration: this.cardioPlan.defaultWalkDuration,
          };
        }
        return this.completeSession();

      case 'weights':
        this.phase = this.cardioPlan.totalTargetMinutes > 0 ? 'cardio' : 'cooldown';
        if (this.phase === 'cardio') {
          return {
            phase: this.phase,
            action: 'start_cardio',
            instruction: 'Weights complete. Start cardio with walking interval.',
            note: 'Transitioning to cardio.',
            nextIntervalType: CARDIO_INTERVAL_TYPE.WALKING,
            nextIntervalDuration: this.cardioPlan.defaultWalkDuration,
          };
        }
        return {
          phase: this.phase,
          action: 'complete',
          instruction: 'Weights complete. Begin cooldown.',
          note: 'Moving to cooldown.',
        };

      case 'cardio':
        this.phase = 'cooldown';
        return {
          phase: this.phase,
          action: 'complete',
          instruction: 'Cardio complete. Begin cooldown stretches.',
          note: 'Finishing up.',
        };

      case 'cooldown':
        return this.completeSession();

      default:
        return this.completeSession();
    }
  }

  processSetCompletion(data: SetCompletionData): ExecutionDecision {
    const currentExercise = this.exercisePlan[this.currentExerciseIndex];
    if (!currentExercise) {
      return this.advancePhase();
    }

    const rpe = data.rpe ?? (data.rir !== undefined ? 10 - data.rir : 7);
    const targetReps = parseRepRange(currentExercise.targetReps);
    const isCompound = isCompoundExercise(data.exerciseName);

    const setContext: SetContext = {
      currentSet: {
        weight: data.actualWeight,
        reps: data.actualReps,
        rpe: data.rpe,
        repsInReserve: data.rir,
      },
      previousSets: [],
      targetRpe: currentExercise.targetRpe || 8,
      targetReps: currentExercise.targetReps,
      exerciseName: data.exerciseName,
      targetSets: currentExercise.targetSets,
      currentSetNumber: data.setNumber,
      isCompound,
    };

    const decision = decideNextSet(setContext);

    if (decision.endExercise) {
      this.completedExercises.push(data.exerciseName);
      this.currentExerciseIndex++;
      this.currentSetNumber = 1;

      if (this.currentExerciseIndex >= this.exercisePlan.length) {
        return this.advancePhase();
      }

      const nextExercise = this.exercisePlan[this.currentExerciseIndex];
      const history = this.exerciseHistory[nextExercise.exerciseName];
      
      return {
        phase: this.phase,
        action: 'next_exercise',
        instruction: `Next: ${nextExercise.exerciseName} - ${nextExercise.targetSets} sets x ${nextExercise.targetReps}`,
        note: decision.reason,
        nextWeight: history?.lastWeight || nextExercise.startingWeight,
        nextReps: parseRepRange(nextExercise.targetReps).max,
        restSeconds: REST_TIMES.COMPOUND_SECONDS,
      };
    }

    this.currentSetNumber++;
    const nextWeight = calculateNextSetWeight(data.actualWeight, decision.decision, isCompound);

    return {
      phase: this.phase,
      action: 'next_set',
      instruction: `Set ${this.currentSetNumber}: ${nextWeight}kg x ${decision.nextSetReps} reps`,
      note: decision.reason,
      nextWeight,
      nextReps: decision.nextSetReps,
      restSeconds: decision.restSeconds,
    };
  }

  processCardioInterval(data: CardioCompletionData): ExecutionDecision {
    this.totalCardioSeconds += data.durationSeconds;
    const totalMinutes = this.totalCardioSeconds / 60;

    if (totalMinutes >= this.cardioPlan.totalTargetMinutes) {
      return this.advancePhase();
    }

    const cardioContext: CardioContext = {
      currentInterval: {
        type: data.type,
        durationSeconds: data.durationSeconds,
        heartRate: data.heartRate,
        perceivedExertion: data.perceivedExertion,
      },
      previousIntervals: [],
      cardioPlan: this.cardioPlan,
      totalElapsedMinutes: totalMinutes,
    };

    const decision = decideNextCardioInterval(cardioContext);

    if (decision.endCardio) {
      return this.advancePhase();
    }

    return {
      phase: this.phase,
      action: 'next_interval',
      instruction: `${decision.nextIntervalType === CARDIO_INTERVAL_TYPE.WALKING ? 'Walk' : 'Jog'} for ${Math.round(decision.nextDuration / 60)} minutes`,
      note: decision.reason,
      nextIntervalType: decision.nextIntervalType,
      nextIntervalDuration: decision.nextDuration,
    };
  }

  private completeSession(): ExecutionDecision {
    this.phase = 'complete';
    return {
      phase: 'complete',
      action: 'complete',
      instruction: 'Session complete. Great work!',
      note: `Completed ${this.completedExercises.length} exercises, ${Math.round(this.totalCardioSeconds / 60)} minutes cardio.`,
    };
  }
}
