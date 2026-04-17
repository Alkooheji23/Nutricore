import { useState } from 'react';
import { Watch, Dumbbell, Zap, ChevronDown, Check, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type WorkoutMode = 'auto_tracked' | 'structured_strength' | 'hybrid';

interface WorkoutModeOption {
  id: WorkoutMode;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

const WORKOUT_MODES: WorkoutModeOption[] = [
  {
    id: 'auto_tracked',
    name: 'Auto-Tracked',
    description: 'Smartwatch-first logging',
    icon: <Watch className="h-5 w-5" />,
    features: [
      'Duration, calories, HR imported from device',
      'No manual sets/reps required',
      'Add optional notes only',
    ],
  },
  {
    id: 'structured_strength',
    name: 'Structured Strength',
    description: 'Manual sets, reps, weight logging',
    icon: <Dumbbell className="h-5 w-5" />,
    features: [
      'Log exercises, sets, reps, weight, RIR',
      'Smartwatch data used as background metrics',
      'Full control over workout structure',
    ],
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Auto-import + optional structure',
    icon: <Zap className="h-5 w-5" />,
    features: [
      'Auto-import smartwatch workout first',
      'Choose to add structure if needed',
      'Best of both worlds',
    ],
  },
];

interface WorkoutModeSelectorProps {
  value: WorkoutMode;
  onChange: (mode: WorkoutMode) => void;
  showDescription?: boolean;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
}

export function WorkoutModeSelector({
  value,
  onChange,
  showDescription = true,
  compact = false,
  disabled = false,
  label = 'Workout Mode',
}: WorkoutModeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedMode = WORKOUT_MODES.find((m) => m.id === value) || WORKOUT_MODES[2];

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50"
          data-testid="button-workout-mode-compact"
        >
          <span className="text-amber-500">{selectedMode.icon}</span>
          <span className="text-sm text-white">{selectedMode.name}</span>
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50"
            >
              {WORKOUT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    onChange(mode.id);
                    setIsExpanded(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    value === mode.id ? 'bg-zinc-700/50' : ''
                  }`}
                  data-testid={`button-select-mode-${mode.id}`}
                >
                  <span className={value === mode.id ? 'text-amber-500' : 'text-zinc-400'}>{mode.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{mode.name}</p>
                    <p className="text-xs text-zinc-400">{mode.description}</p>
                  </div>
                  {value === mode.id && <Check className="h-4 w-4 text-amber-500" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-white">{label}</label>
          <div className="group relative">
            <Info className="h-4 w-4 text-zinc-500 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <p className="text-xs text-zinc-300">
                Choose how you want to log workouts. This affects what data is collected and displayed.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {WORKOUT_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => !disabled && onChange(mode.id)}
            disabled={disabled}
            className={`p-4 rounded-xl border transition-all text-left ${
              value === mode.id
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            data-testid={`card-workout-mode-${mode.id}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg ${
                  value === mode.id ? 'bg-amber-500/20 text-amber-500' : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">{mode.name}</h3>
                  {value === mode.id && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-black" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-zinc-400 mt-0.5">{mode.description}</p>
                {showDescription && (
                  <ul className="mt-2 space-y-1">
                    {mode.features.map((feature, i) => (
                      <li key={i} className="text-xs text-zinc-500 flex items-start gap-2">
                        <span className="text-zinc-600 mt-0.5">-</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function getWorkoutModeConfig(mode: WorkoutMode) {
  return WORKOUT_MODES.find((m) => m.id === mode) || WORKOUT_MODES[2];
}

export function shouldShowStrengthUI(mode: WorkoutMode): boolean {
  return mode === 'structured_strength' || mode === 'hybrid';
}

export function shouldAutoImportWearable(mode: WorkoutMode): boolean {
  return mode === 'auto_tracked' || mode === 'hybrid';
}

export function shouldShowHybridPrompt(mode: WorkoutMode): boolean {
  return mode === 'hybrid';
}

export { WORKOUT_MODES };
