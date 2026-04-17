import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'nutricore_active_workout';
const SAVE_INTERVAL_MS = 2000;

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  completed: boolean;
}

export interface PersistedWorkoutState {
  workoutName: string;
  activityType: string;
  exercises: WorkoutExercise[];
  notes: string;
  distance: number;
  manualDuration: number;
  sessionStartTimestamp: number | null;
  finalElapsedMinutes: number;
  lastSaveTimestamp: number;
}

const getDefaultState = (): PersistedWorkoutState => ({
  workoutName: '',
  activityType: '',
  exercises: [],
  notes: '',
  distance: 0,
  manualDuration: 0,
  sessionStartTimestamp: null,
  finalElapsedMinutes: 0,
  lastSaveTimestamp: Date.now(),
});

export function useWorkoutPersistence() {
  const [workoutState, setWorkoutState] = useState<PersistedWorkoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedWorkoutState;
        const hoursSinceSave = (Date.now() - parsed.lastSaveTimestamp) / (1000 * 60 * 60);
        if (hoursSinceSave < 12) {
          return parsed;
        }
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return getDefaultState();
  });

  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveToStorage = useCallback((state: PersistedWorkoutState) => {
    try {
      const stateToSave = {
        ...state,
        lastSaveTimestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save workout state:', e);
    }
  }, []);

  const debouncedSave = useCallback((state: PersistedWorkoutState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(state);
    }, 500);
  }, [saveToStorage]);

  useEffect(() => {
    if (workoutState.workoutName || workoutState.sessionStartTimestamp) {
      debouncedSave(workoutState);
    }
  }, [workoutState, debouncedSave]);

  // Save immediately on component unmount (covers in-app navigation)
  useEffect(() => {
    const currentState = workoutState;
    return () => {
      if (currentState.sessionStartTimestamp || currentState.workoutName) {
        const stateToSave = { ...currentState, lastSaveTimestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
    };
  }, [workoutState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (workoutState.workoutName || workoutState.sessionStartTimestamp) {
          saveToStorage(workoutState);
        }
      } else if (document.visibilityState === 'visible') {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as PersistedWorkoutState;
            const hoursSinceSave = (Date.now() - parsed.lastSaveTimestamp) / (1000 * 60 * 60);
            if (hoursSinceSave < 12 && parsed.sessionStartTimestamp) {
              setWorkoutState(parsed);
            }
          }
        } catch {
        }
      }
    };

    const handleBeforeUnload = () => {
      if (workoutState.workoutName || workoutState.sessionStartTimestamp) {
        const stateToSave = {
          ...workoutState,
          lastSaveTimestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const interval = setInterval(() => {
      if (workoutState.sessionStartTimestamp) {
        saveToStorage(workoutState);
      }
    }, SAVE_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [workoutState, saveToStorage]);

  useEffect(() => {
    if (workoutState.sessionStartTimestamp && !isRestored) {
      setIsRestored(true);
    }
  }, [workoutState.sessionStartTimestamp, isRestored]);

  const updateWorkout = useCallback((updates: Partial<Omit<PersistedWorkoutState, 'lastSaveTimestamp'>>) => {
    setWorkoutState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const startSession = useCallback(() => {
    setWorkoutState(prev => ({
      ...prev,
      sessionStartTimestamp: Date.now(),
      finalElapsedMinutes: 0,
    }));
  }, []);

  const endSession = useCallback(() => {
    setWorkoutState(prev => {
      const elapsed = prev.sessionStartTimestamp 
        ? Math.floor((Date.now() - prev.sessionStartTimestamp) / 1000 / 60)
        : 0;
      return {
        ...prev,
        sessionStartTimestamp: null,
        finalElapsedMinutes: elapsed,
      };
    });
  }, []);

  const getElapsedMinutes = useCallback(() => {
    if (!workoutState.sessionStartTimestamp) {
      return 0;
    }
    return Math.floor((Date.now() - workoutState.sessionStartTimestamp) / 1000 / 60);
  }, [workoutState.sessionStartTimestamp]);

  const getElapsedSeconds = useCallback(() => {
    if (!workoutState.sessionStartTimestamp) {
      return 0;
    }
    return Math.floor((Date.now() - workoutState.sessionStartTimestamp) / 1000);
  }, [workoutState.sessionStartTimestamp]);

  const clearWorkout = useCallback(() => {
    setWorkoutState(getDefaultState());
    localStorage.removeItem(STORAGE_KEY);
    setIsRestored(false);
  }, []);

  const hasActiveWorkout = workoutState.workoutName !== '' || workoutState.sessionStartTimestamp !== null;

  return {
    workoutState,
    updateWorkout,
    startSession,
    endSession,
    getElapsedMinutes,
    getElapsedSeconds,
    clearWorkout,
    hasActiveWorkout,
    isRestored,
    isSessionActive: workoutState.sessionStartTimestamp !== null,
  };
}
