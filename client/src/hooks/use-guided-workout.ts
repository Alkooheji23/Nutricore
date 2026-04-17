import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'nutricore_guided_workout';
const SAVE_INTERVAL_MS = 1000;
const DEFAULT_REST_SECONDS = 90;

export interface SetResult {
  exerciseIndex: number;
  setIndex: number;
  targetReps: number;
  actualReps: number | null;
  targetWeight: number | null;
  actualWeight: number | null;
  rir: number | null;
  completed: boolean;
  skipped: boolean;
}

export interface GuidedExercise {
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  muscleGroup?: string;
  warmupSets?: number; // Number of warmup sets at the beginning (no target weight)
}

export type GuidedPhase = 'not_started' | 'active_set' | 'resting' | 'completed';

export interface GuidedWorkoutState {
  workoutName: string;
  exercises: GuidedExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  phase: GuidedPhase;
  restStartTimestamp: number | null; // When rest started (for ascending stopwatch)
  restDurationSeconds: number;
  completedSets: SetResult[];
  sessionStartTimestamp: number | null;
  lastSaveTimestamp: number;
  accumulatedMinutes: number; // Track time from previous sessions when pausing/resuming
  scheduledWorkoutId: string | null; // Link to scheduled workout if started from one
}

const getDefaultState = (): GuidedWorkoutState => ({
  workoutName: '',
  exercises: [],
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  phase: 'not_started',
  restStartTimestamp: null,
  restDurationSeconds: DEFAULT_REST_SECONDS,
  completedSets: [],
  sessionStartTimestamp: null,
  lastSaveTimestamp: Date.now(),
  accumulatedMinutes: 0,
  scheduledWorkoutId: null,
});

export function useGuidedWorkout() {
  const [state, setState] = useState<GuidedWorkoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GuidedWorkoutState;
        const hoursSinceSave = (Date.now() - parsed.lastSaveTimestamp) / (1000 * 60 * 60);
        if (hoursSinceSave < 12 && parsed.phase !== 'not_started' && parsed.phase !== 'completed') {
          // Calculate time elapsed before the pause and add to accumulated
          const previousSessionMinutes = parsed.sessionStartTimestamp 
            ? Math.floor((parsed.lastSaveTimestamp - parsed.sessionStartTimestamp) / 1000 / 60)
            : 0;
          const totalAccumulated = (parsed.accumulatedMinutes || 0) + previousSessionMinutes;
          
          // Reset session start to now, carry forward accumulated time
          return {
            ...parsed,
            accumulatedMinutes: totalAccumulated,
            sessionStartTimestamp: Date.now(),
          };
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return getDefaultState();
  });

  const [restSecondsElapsed, setRestSecondsElapsed] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveToStorage = useCallback((newState: GuidedWorkoutState) => {
    try {
      const stateToSave = { ...newState, lastSaveTimestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save guided workout state:', e);
    }
  }, []);

  useEffect(() => {
    if (state.phase !== 'not_started') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveToStorage(state), 300);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, saveToStorage]);

  // Save immediately on component unmount (covers in-app navigation)
  useEffect(() => {
    const currentState = state;
    return () => {
      if (currentState.phase !== 'not_started' && currentState.phase !== 'completed') {
        const stateToSave = { ...currentState, lastSaveTimestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
    };
  }, [state]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.phase !== 'not_started') {
        saveToStorage(state);
      }
    };
    const handleBeforeUnload = () => {
      if (state.phase !== 'not_started') {
        const stateToSave = { ...state, lastSaveTimestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state, saveToStorage]);

  // Ascending rest timer - counts how long user has been resting (stopwatch style)
  useEffect(() => {
    if (state.phase === 'resting' && state.restStartTimestamp) {
      const updateRest = () => {
        const elapsed = Math.floor((Date.now() - state.restStartTimestamp!) / 1000);
        setRestSecondsElapsed(elapsed);
        // No auto-advance - user skips when ready
      };
      updateRest();
      const interval = setInterval(updateRest, 250);
      return () => clearInterval(interval);
    } else {
      setRestSecondsElapsed(0);
    }
  }, [state.phase, state.restStartTimestamp]);

  const startWorkout = useCallback((workoutName: string, exercises: GuidedExercise[], restSeconds = DEFAULT_REST_SECONDS, scheduledWorkoutId: string | null = null) => {
    if (exercises.length === 0) return;
    const newState: GuidedWorkoutState = {
      workoutName,
      exercises,
      currentExerciseIndex: 0,
      currentSetIndex: 0,
      phase: 'active_set',
      restStartTimestamp: null,
      restDurationSeconds: restSeconds,
      completedSets: [],
      sessionStartTimestamp: Date.now(),
      lastSaveTimestamp: Date.now(),
      accumulatedMinutes: 0,
      scheduledWorkoutId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setState(newState);
  }, []);

  const getCurrentExercise = useCallback(() => {
    if (state.currentExerciseIndex >= state.exercises.length) return null;
    return state.exercises[state.currentExerciseIndex];
  }, [state.currentExerciseIndex, state.exercises]);

  const getTotalSets = useCallback(() => {
    return state.exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  }, [state.exercises]);

  const getCompletedSetsCount = useCallback(() => {
    return state.completedSets.filter(s => s.completed || s.skipped).length;
  }, [state.completedSets]);

  const completeSet = useCallback((actualReps: number | null, actualWeight: number | null, rir: number | null = null) => {
    const exercise = getCurrentExercise();
    if (!exercise) return;

    const setResult: SetResult = {
      exerciseIndex: state.currentExerciseIndex,
      setIndex: state.currentSetIndex,
      targetReps: exercise.targetReps,
      actualReps,
      targetWeight: exercise.targetWeight,
      actualWeight,
      rir,
      completed: true,
      skipped: false,
    };

    const isLastSetOfExercise = state.currentSetIndex >= exercise.targetSets - 1;
    const isLastExercise = state.currentExerciseIndex >= state.exercises.length - 1;
    const isWorkoutComplete = isLastSetOfExercise && isLastExercise;

    if (isWorkoutComplete) {
      setState(prev => ({
        ...prev,
        completedSets: [...prev.completedSets, setResult],
        phase: 'completed',
        restStartTimestamp: null,
      }));
    } else {
      setState(prev => ({
        ...prev,
        completedSets: [...prev.completedSets, setResult],
        phase: 'resting',
        restStartTimestamp: Date.now(), // Start the ascending stopwatch
      }));
    }
  }, [state.currentExerciseIndex, state.currentSetIndex, state.exercises, getCurrentExercise]);

  const skipSet = useCallback(() => {
    const exercise = getCurrentExercise();
    if (!exercise) return;

    const setResult: SetResult = {
      exerciseIndex: state.currentExerciseIndex,
      setIndex: state.currentSetIndex,
      targetReps: exercise.targetReps,
      actualReps: null,
      targetWeight: exercise.targetWeight,
      actualWeight: null,
      rir: null,
      completed: false,
      skipped: true,
    };

    const isLastSetOfExercise = state.currentSetIndex >= exercise.targetSets - 1;
    const isLastExercise = state.currentExerciseIndex >= state.exercises.length - 1;
    const isWorkoutComplete = isLastSetOfExercise && isLastExercise;

    if (isWorkoutComplete) {
      setState(prev => ({
        ...prev,
        completedSets: [...prev.completedSets, setResult],
        phase: 'completed',
        restStartTimestamp: null,
      }));
    } else {
      advanceToNextSetInternal([...state.completedSets, setResult]);
    }
  }, [state.currentExerciseIndex, state.currentSetIndex, state.completedSets, getCurrentExercise]);

  const advanceToNextSetInternal = useCallback((completedSets: SetResult[]) => {
    setState(prev => {
      const exercise = prev.exercises[prev.currentExerciseIndex];
      const isLastSetOfExercise = prev.currentSetIndex >= exercise.targetSets - 1;

      if (isLastSetOfExercise) {
        const nextExerciseIndex = prev.currentExerciseIndex + 1;
        if (nextExerciseIndex >= prev.exercises.length) {
          return { ...prev, phase: 'completed', completedSets, restEndTimestamp: null };
        }
        return {
          ...prev,
          currentExerciseIndex: nextExerciseIndex,
          currentSetIndex: 0,
          phase: 'active_set',
          completedSets,
          restStartTimestamp: null,
        };
      }
      return {
        ...prev,
        currentSetIndex: prev.currentSetIndex + 1,
        phase: 'active_set',
        completedSets,
        restStartTimestamp: null,
      };
    });
  }, []);

  const advanceToNextSet = useCallback(() => {
    advanceToNextSetInternal(state.completedSets);
  }, [state.completedSets, advanceToNextSetInternal]);

  const skipRest = useCallback(() => {
    advanceToNextSet();
  }, [advanceToNextSet]);

  const getNextSetInfo = useCallback(() => {
    const exercise = state.exercises[state.currentExerciseIndex];
    if (!exercise) return null;

    const isLastSetOfExercise = state.currentSetIndex >= exercise.targetSets - 1;
    if (isLastSetOfExercise) {
      const nextExerciseIndex = state.currentExerciseIndex + 1;
      if (nextExerciseIndex >= state.exercises.length) return null;
      const nextExercise = state.exercises[nextExerciseIndex];
      return { 
        exerciseName: nextExercise.name, 
        setNumber: 1, 
        totalSets: nextExercise.targetSets, 
        isNewExercise: true,
        targetReps: nextExercise.targetReps,
        targetWeight: nextExercise.targetWeight,
      };
    }
    return { 
      exerciseName: exercise.name, 
      setNumber: state.currentSetIndex + 2, 
      totalSets: exercise.targetSets, 
      isNewExercise: false,
      targetReps: exercise.targetReps,
      targetWeight: exercise.targetWeight,
    };
  }, [state.currentExerciseIndex, state.currentSetIndex, state.exercises]);

  const getElapsedMinutes = useCallback(() => {
    const currentSessionMinutes = state.sessionStartTimestamp 
      ? Math.floor((Date.now() - state.sessionStartTimestamp) / 1000 / 60)
      : 0;
    return (state.accumulatedMinutes || 0) + currentSessionMinutes;
  }, [state.sessionStartTimestamp, state.accumulatedMinutes]);

  const clearWorkout = useCallback(() => {
    setState(getDefaultState());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setRestDuration = useCallback((seconds: number) => {
    setState(prev => ({ ...prev, restDurationSeconds: seconds }));
  }, []);

  return {
    state,
    startWorkout,
    getCurrentExercise,
    getTotalSets,
    getCompletedSetsCount,
    completeSet,
    skipSet,
    skipRest,
    getNextSetInfo,
    getElapsedMinutes,
    clearWorkout,
    setRestDuration,
    restSecondsElapsed,
    isActive: state.phase !== 'not_started' && state.phase !== 'completed',
    isCompleted: state.phase === 'completed',
  };
}
