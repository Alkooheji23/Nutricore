import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  useGuidedWorkout, 
  type GuidedExercise 
} from '@/hooks/use-guided-workout';
import { useWorkoutPersistence } from '@/hooks/use-workout-persistence';
import { useUser } from '@/lib/api';
import {
  X,
  Check,
  Timer,
  SkipForward,
  Dumbbell,
  Trophy,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Loader2,
} from 'lucide-react';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ActiveSetView({
  exerciseName,
  setNumber,
  totalSets,
  targetReps,
  targetWeight,
  weightUnit,
  warmupSets = 0,
  onComplete,
  onSkip,
}: {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  targetReps: number;
  targetWeight: number | null;
  weightUnit: 'kg' | 'lb';
  warmupSets?: number;
  onComplete: (reps: number | null, weight: number | null, rir: number | null) => void;
  onSkip: () => void;
}) {
  // Determine if this is a warmup set
  const isWarmupSet = warmupSets > 0 && setNumber <= warmupSets;
  const workingSetNumber = warmupSets > 0 ? setNumber - warmupSets : setNumber;
  const totalWorkingSets = totalSets - warmupSets;
  
  const [reps, setReps] = useState<string>(targetReps.toString());
  // Warmup sets start with empty weight field
  const [weight, setWeight] = useState<string>(isWarmupSet ? '' : (targetWeight?.toString() || ''));
  const [rir, setRir] = useState<string>('');

  const handleComplete = () => {
    onComplete(
      reps ? parseInt(reps) : null,
      weight ? parseFloat(weight) : null,
      rir ? parseInt(rir) : null
    );
    // For next set, decide if it's warmup
    const nextIsWarmup = warmupSets > 0 && (setNumber + 1) <= warmupSets;
    setReps(targetReps.toString());
    setWeight(nextIsWarmup ? '' : (targetWeight?.toString() || ''));
    setRir('');
  };

  const unitLabel = weightUnit === 'lb' ? 'lbs' : 'kg';

  // Build set label
  const setLabel = isWarmupSet 
    ? `Warmup ${setNumber} of ${warmupSets}` 
    : `Set ${workingSetNumber} of ${totalWorkingSets}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-6"
    >
      <div className="text-center mb-8">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${isWarmupSet ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'}`}>
          <Dumbbell className="w-4 h-4" />
          <span className="text-sm font-medium">{setLabel}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-display text-white mb-2">
          {exerciseName}
        </h1>
        <p className="text-xl text-muted-foreground">
          {isWarmupSet 
            ? 'Light weight warmup - enter your values'
            : `Target: ${targetReps} reps ${targetWeight ? `@ ${targetWeight} ${unitLabel}` : ''}`
          }
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Reps</label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="text-center text-xl h-14 bg-white/5 border-white/10"
              data-testid="input-actual-reps"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Weight</label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="text-center text-xl h-14 bg-white/5 border-white/10"
              placeholder="0"
              data-testid="input-actual-weight"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">RIR</label>
            <Input
              type="number"
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              className="text-center text-xl h-14 bg-white/5 border-white/10"
              placeholder="0-4"
              min="0"
              max="10"
              data-testid="input-rir"
            />
          </div>
        </div>

        <Button
          onClick={handleComplete}
          className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700"
          data-testid="button-complete-set"
        >
          <Check className="w-6 h-6 mr-2" />
          Done
        </Button>

        <Button
          onClick={onSkip}
          variant="ghost"
          className="w-full text-muted-foreground hover:text-white"
          data-testid="button-skip-set"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip this set
        </Button>
      </div>
    </motion.div>
  );
}

function RestTimerView({
  secondsElapsed,
  nextSetInfo,
  onSkip,
}: {
  secondsElapsed: number;
  nextSetInfo: { exerciseName: string; setNumber: number; totalSets: number; isNewExercise: boolean; targetReps: number; targetWeight: number | null } | null;
  onSkip: () => void;
}) {
  // Ascending timer - show how long user has been resting
  // Animate progress based on common rest ranges (90s = half, 180s = full)
  const progress = Math.min(100, (secondsElapsed / 180) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 mb-6">
          <Timer className="w-4 h-4" />
          <span className="text-sm font-medium">Resting...</span>
        </div>
        
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-white/10"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className={secondsElapsed < 60 ? "text-green-500" : secondsElapsed < 120 ? "text-blue-500" : "text-amber-500"}
              strokeDasharray={553}
              strokeDashoffset={553 - (553 * progress) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-mono font-bold text-white">
              {formatTime(secondsElapsed)}
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Tap "Continue" when you're ready
        </p>
      </div>

      {nextSetInfo && (
        <div className="text-center mb-8 p-4 rounded-xl bg-white/5 border border-white/10 w-full max-w-sm">
          <p className="text-sm text-muted-foreground mb-1">
            {nextSetInfo.isNewExercise ? 'Next exercise' : 'Next set'}
          </p>
          <p className="text-lg font-semibold text-white">
            {nextSetInfo.exerciseName}
          </p>
          <p className="text-sm text-muted-foreground">
            Set {nextSetInfo.setNumber} of {nextSetInfo.totalSets}
            {nextSetInfo.targetWeight ? ` · ${nextSetInfo.targetReps} reps @ ${nextSetInfo.targetWeight} kg` : ` · ${nextSetInfo.targetReps} reps`}
          </p>
        </div>
      )}

      <Button
        onClick={onSkip}
        className="w-full max-w-sm h-14 text-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        data-testid="button-skip-rest"
      >
        <Play className="w-5 h-5 mr-2" />
        Continue
      </Button>
    </motion.div>
  );
}

function WorkoutSummaryView({
  workoutName,
  completedSets,
  elapsedMinutes,
  onFinish,
  onDiscard,
  isSaving,
}: {
  workoutName: string;
  completedSets: number;
  totalSets: number;
  elapsedMinutes: number;
  onFinish: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-6"
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-display text-white mb-2">
          Workout Complete!
        </h1>
        <p className="text-xl text-muted-foreground">
          {workoutName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-sm mb-8">
        <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-3xl font-bold text-primary">{completedSets}</p>
          <p className="text-sm text-muted-foreground">Sets Done</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-3xl font-bold text-primary">{elapsedMinutes}</p>
          <p className="text-sm text-muted-foreground">Minutes</p>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onFinish}
          disabled={isSaving}
          className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          data-testid="button-finish-workout"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Save Workout
            </>
          )}
        </Button>
        <Button
          onClick={onDiscard}
          disabled={isSaving}
          variant="ghost"
          className="w-full text-muted-foreground hover:text-white"
          data-testid="button-discard-workout"
        >
          Discard
        </Button>
      </div>
    </motion.div>
  );
}

export default function GuidedWorkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  
  const weightUnit = ((user as any)?.weightUnit || 'kg') as 'kg' | 'lb';
  
  const {
    state,
    getCurrentExercise,
    getTotalSets,
    getCompletedSetsCount,
    completeSet,
    skipSet,
    skipRest,
    getNextSetInfo,
    getElapsedMinutes,
    clearWorkout,
    restSecondsElapsed,
  } = useGuidedWorkout();

  const { clearWorkout: clearPersistence } = useWorkoutPersistence();

  const createWorkoutLog = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[GuidedWorkout] Save failed:', res.status, errorBody);
        throw new Error(errorBody.message || `Failed to save (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workout-logs'] });
      toast({ title: 'Workout saved!', description: 'Great work on your training!' });
      clearWorkout();
      clearPersistence();
      setLocation('/tracker');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save workout', description: error.message, variant: 'destructive' });
    },
    retry: 2,
    retryDelay: 1000,
  });

  const handleFinish = () => {
    const exercises = state.exercises.map((ex, exIndex) => {
      const setsForExercise = state.completedSets.filter(s => s.exerciseIndex === exIndex);
      const setsArray = setsForExercise
        .filter(s => !s.skipped)
        .map(s => ({
          reps: s.actualReps || 0,
          weight: s.actualWeight || 0,
          completed: s.completed,
        }));
      return {
        name: ex.name,
        sets: setsArray,
        muscleGroup: ex.muscleGroup,
        completed: true,
      };
    });

    createWorkoutLog.mutate({
      workoutName: state.workoutName,
      activityType: 'strength_training',
      duration: getElapsedMinutes(),
      caloriesBurned: 0,
      exercises,
      notes: '',
      completed: true,
      scheduledWorkoutId: state.scheduledWorkoutId,
    });
  };

  const handleDiscard = () => {
    clearWorkout();
    clearPersistence();
    setLocation('/tracker');
  };

  const handleClose = () => {
    if (state.phase === 'active_set' || state.phase === 'resting') {
      if (confirm('Leave workout? Your progress will be saved and you can resume later.')) {
        setLocation('/tracker');
      }
    } else {
      setLocation('/tracker');
    }
  };

  if (state.phase === 'not_started') {
    setLocation('/tracker');
    return null;
  }

  const currentExercise = getCurrentExercise();
  const totalSets = getTotalSets();
  const completedSetsCount = getCompletedSetsCount();
  const progressPercent = (completedSetsCount / totalSets) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          data-testid="button-close-flow"
        >
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
        
        <div className="text-center flex-1 px-4">
          <p className="text-sm font-medium text-white truncate">{state.workoutName}</p>
          <p className="text-xs text-muted-foreground">
            {completedSetsCount} / {totalSets} sets
          </p>
        </div>

        <div className="w-10" />
      </header>

      <div className="px-4 py-2">
        <Progress value={progressPercent} className="h-2" />
      </div>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {state.phase === 'active_set' && currentExercise && (
            <ActiveSetView
              key={`set-${state.currentExerciseIndex}-${state.currentSetIndex}`}
              exerciseName={currentExercise.name}
              setNumber={state.currentSetIndex + 1}
              totalSets={currentExercise.targetSets}
              targetReps={currentExercise.targetReps}
              targetWeight={currentExercise.targetWeight}
              weightUnit={weightUnit}
              warmupSets={currentExercise.warmupSets || 0}
              onComplete={completeSet}
              onSkip={skipSet}
            />
          )}

          {state.phase === 'resting' && (
            <RestTimerView
              key="rest"
              secondsElapsed={restSecondsElapsed}
              nextSetInfo={getNextSetInfo()}
              onSkip={skipRest}
            />
          )}

          {state.phase === 'completed' && (
            <WorkoutSummaryView
              key="summary"
              workoutName={state.workoutName}
              completedSets={completedSetsCount}
              totalSets={totalSets}
              elapsedMinutes={getElapsedMinutes()}
              onFinish={handleFinish}
              onDiscard={handleDiscard}
              isSaving={createWorkoutLog.isPending}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
