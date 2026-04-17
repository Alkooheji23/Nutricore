import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Clock, 
  Flame, 
  Dumbbell, 
  CheckCircle2,
  MapPin,
  Timer,
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  X,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type SetData = {
  weight?: number;
  reps?: number;
  completed?: boolean;
  restTime?: number;
  restSeconds?: number;
  rest?: number;
  rir?: number;
  tempo?: string;
  notes?: string;
};

type ExerciseData = {
  name: string;
  sets: SetData[] | number;
  reps?: number | string;
  weight?: number;
  completed?: boolean;
  targetRir?: number;
  muscleGroup?: string;
  notes?: string;
};

type WorkoutLog = {
  id: string;
  workoutName: string;
  activityType?: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  distance?: number;
  exercises: ExerciseData[] | null;
  completed: boolean;
  notes?: string;
  source?: string;
  workoutMode?: string;
  linkedWearableActivityId?: string | null;
};

type EditableSet = {
  reps: number;
  weight: number;
  rest: number;
  rir?: number;
  tempo?: string;
  setNotes?: string;
  completed: boolean;
};

type EditableExercise = {
  name: string;
  muscleGroup?: string;
  sets: EditableSet[];
  notes: string;
};

function normalizeExercises(exercises: ExerciseData[] | null): EditableExercise[] {
  if (!exercises) return [];
  
  return exercises.map(ex => {
    let setsArray: EditableSet[] = [];
    
    if (Array.isArray(ex.sets)) {
      setsArray = ex.sets.map(set => ({
        reps: set.reps ?? 0,
        weight: set.weight ?? 0,
        rest: set.restTime ?? set.restSeconds ?? set.rest ?? 0,
        rir: set.rir,
        tempo: set.tempo,
        setNotes: set.notes,
        completed: set.completed ?? true,
      }));
    } else if (ex.sets && typeof ex.sets === 'object' && !Array.isArray(ex.sets)) {
      setsArray = Object.values(ex.sets as Record<string, SetData>).map(set => ({
        reps: set.reps ?? 0,
        weight: set.weight ?? 0,
        rest: set.restTime ?? set.restSeconds ?? set.rest ?? 0,
        rir: set.rir,
        tempo: set.tempo,
        setNotes: set.notes,
        completed: set.completed ?? true,
      }));
    } else if (typeof ex.sets === 'number' && ex.sets > 0) {
      for (let i = 0; i < ex.sets; i++) {
        setsArray.push({
          reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || 0 : (ex.reps ?? 0),
          weight: ex.weight ?? 0,
          rest: 0,
          completed: ex.completed ?? true,
        });
      }
    }
    
    if (setsArray.length === 0) {
      setsArray.push({ reps: 0, weight: 0, rest: 0, completed: true });
    }
    
    return {
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: setsArray,
      notes: ex.notes ?? '',
    };
  });
}

function serializeExercises(exercises: EditableExercise[]): ExerciseData[] {
  return exercises.map(ex => ({
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    sets: ex.sets.map(set => ({
      reps: set.reps,
      weight: set.weight,
      restSeconds: set.rest,
      rir: set.rir,
      tempo: set.tempo,
      notes: set.setNotes,
      completed: set.completed,
    })),
    notes: ex.notes || undefined,
  }));
}

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editableExercises, setEditableExercises] = useState<EditableExercise[]>([]);
  const [editableNotes, setEditableNotes] = useState('');
  const [editableDuration, setEditableDuration] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workout, isLoading, error } = useQuery<WorkoutLog>({
    queryKey: ["/api/workout-logs", id],
    queryFn: async () => {
      const res = await fetch(`/api/workout-logs/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workout");
      return res.json();
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { exercises: ExerciseData[]; notes?: string; duration: number }) => {
      const res = await fetch(`/api/workout-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update workout");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Workout updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs", id] });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update workout", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (workout?.exercises && workout.exercises.length > 0) {
      setExpandedExercises(new Set(workout.exercises.map((_, i) => i)));
    }
  }, [workout]);

  const startEditing = () => {
    if (workout) {
      setEditableExercises(normalizeExercises(workout.exercises));
      setEditableNotes(workout.notes || '');
      setEditableDuration(workout.duration);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    if (workout) {
      setExpandedExercises(new Set(workout.exercises?.map((_, i) => i) || []));
    }
    setIsEditing(false);
    setEditableExercises([]);
    setEditableNotes('');
    setEditableDuration(0);
  };

  const saveChanges = () => {
    updateMutation.mutate({
      exercises: serializeExercises(editableExercises),
      notes: editableNotes || undefined,
      duration: editableDuration,
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: keyof EditableSet, value: number | boolean) => {
    setEditableExercises(prev => {
      const next = [...prev];
      next[exIdx] = {
        ...next[exIdx],
        sets: next[exIdx].sets.map((set, i) => 
          i === setIdx ? { ...set, [field]: value } : set
        ),
      };
      return next;
    });
  };

  const addSet = (exIdx: number) => {
    setEditableExercises(prev => {
      const next = [...prev];
      const lastSet = next[exIdx].sets[next[exIdx].sets.length - 1];
      next[exIdx] = {
        ...next[exIdx],
        sets: [...next[exIdx].sets, { ...lastSet }],
      };
      return next;
    });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setEditableExercises(prev => {
      const next = [...prev];
      if (next[exIdx].sets.length > 1) {
        next[exIdx] = {
          ...next[exIdx],
          sets: next[exIdx].sets.filter((_, i) => i !== setIdx),
        };
      }
      return next;
    });
  };

  const addExercise = () => {
    setEditableExercises(prev => [
      ...prev,
      { name: 'New Exercise', sets: [{ reps: 10, weight: 0, rest: 60, completed: true }], notes: '' },
    ]);
  };

  const removeExercise = (exIdx: number) => {
    setEditableExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    setEditableExercises(prev => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], name };
      return next;
    });
  };

  const toggleExercise = (idx: number) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const expandAll = () => {
    const count = isEditing ? editableExercises.length : (workout?.exercises?.length || 0);
    setExpandedExercises(new Set(Array.from({ length: count }, (_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedExercises(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="p-4 space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/plans")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Activities
        </Button>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Workout not found</p>
        </div>
      </div>
    );
  }

  const canEdit = !workout.linkedWearableActivityId && workout.source !== 'garmin' && workout.source !== 'fitbit';

  const exercisesToShow = isEditing ? editableExercises : workout.exercises;
  const totalSets = exercisesToShow?.reduce((sum, ex) => {
    if (isEditing) {
      return sum + (ex as EditableExercise).sets.length;
    }
    const exData = ex as ExerciseData;
    if (Array.isArray(exData.sets)) {
      return sum + exData.sets.length;
    } else if (exData.sets && typeof exData.sets === 'object') {
      return sum + Object.keys(exData.sets).length;
    }
    return sum + (typeof exData.sets === 'number' ? exData.sets : 0);
  }, 0) || 0;

  const allExpanded = exercisesToShow && expandedExercises.size === exercisesToShow.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => isEditing ? cancelEditing() : setLocation("/plans")}
            data-testid="button-back"
          >
            {isEditing ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{workout.workoutName}</h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(workout.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          {canEdit && !isEditing && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={startEditing}
              className="gap-2"
              data-testid="button-edit"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          )}
          {isEditing && (
            <Button 
              size="sm"
              onClick={saveChanges}
              disabled={updateMutation.isPending}
              className="gap-2 gradient-primary"
              data-testid="button-save"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-green-500/20 text-green-400 border-0 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
          {workout.activityType && (
            <Badge variant="outline" className="border-white/10 capitalize">
              {workout.activityType.replace(/_/g, ' ')}
            </Badge>
          )}
          {workout.source && (
            <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
              {workout.source}
            </Badge>
          )}
          {workout.workoutMode && (
            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs capitalize">
              {workout.workoutMode.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isEditing ? (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <Input
                  type="number"
                  value={editableDuration}
                  onChange={(e) => setEditableDuration(parseInt(e.target.value) || 0)}
                  className="text-center text-lg font-bold h-8 bg-transparent border-white/10"
                />
                <div className="text-xs text-muted-foreground">minutes</div>
              </CardContent>
            </Card>
          ) : workout.duration > 0 && (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{workout.duration}</div>
                <div className="text-xs text-muted-foreground">minutes</div>
              </CardContent>
            </Card>
          )}
          {workout.caloriesBurned > 0 && (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 text-center">
                <Flame className="w-5 h-5 mx-auto mb-1 text-orange-400" />
                <div className="text-2xl font-bold text-orange-400">{workout.caloriesBurned}</div>
                <div className="text-xs text-muted-foreground">calories</div>
              </CardContent>
            </Card>
          )}
          {workout.distance && workout.distance > 0 && (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 text-center">
                <MapPin className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                <div className="text-2xl font-bold text-blue-400">{workout.distance.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">km</div>
              </CardContent>
            </Card>
          )}
          {totalSets > 0 && (
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 text-center">
                <Dumbbell className="w-5 h-5 mx-auto mb-1 text-primary" />
                <div className="text-2xl font-bold">{totalSets}</div>
                <div className="text-xs text-muted-foreground">total sets</div>
              </CardContent>
            </Card>
          )}
        </div>

        {exercisesToShow && exercisesToShow.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-primary" />
                Exercises ({exercisesToShow.length})
              </h2>
              <div className="flex items-center gap-2">
                {isEditing && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={addExercise}
                    className="text-xs gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Exercise
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={allExpanded ? collapseAll : expandAll}
                  className="text-xs"
                >
                  {allExpanded ? "Collapse All" : "Expand All"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {isEditing ? (
                editableExercises.map((exercise, idx) => {
                  const isExpanded = expandedExercises.has(idx);
                  return (
                    <Card 
                      key={idx} 
                      className="bg-card/50 border-white/10 overflow-hidden"
                      data-testid={`exercise-card-${idx}`}
                    >
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={exercise.name}
                            onChange={(e) => updateExerciseName(idx, e.target.value)}
                            className="font-medium bg-transparent border-white/10 max-w-[200px]"
                          />
                          <span className="text-sm text-muted-foreground">
                            {exercise.sets.length} sets
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeExercise(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExercise(idx)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5">
                          <div className="pt-3 space-y-2">
                            <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium pb-2 border-b border-white/5">
                              <div>Set</div>
                              <div>Reps</div>
                              <div>Weight (kg)</div>
                              <div>Rest (s)</div>
                              <div></div>
                            </div>
                            {exercise.sets.map((set, setIdx) => (
                              <div 
                                key={setIdx} 
                                className="grid grid-cols-5 gap-2 py-2 border-b border-white/5 last:border-0 items-center"
                                data-testid={`set-row-${idx}-${setIdx}`}
                              >
                                <div className="text-sm font-medium">{setIdx + 1}</div>
                                <Input
                                  type="number"
                                  value={set.reps}
                                  onChange={(e) => updateSet(idx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm bg-transparent border-white/10"
                                />
                                <Input
                                  type="number"
                                  value={set.weight}
                                  onChange={(e) => updateSet(idx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm bg-transparent border-white/10"
                                />
                                <Input
                                  type="number"
                                  value={set.rest}
                                  onChange={(e) => updateSet(idx, setIdx, 'rest', parseInt(e.target.value) || 0)}
                                  className="h-8 text-sm bg-transparent border-white/10"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeSet(idx, setIdx)}
                                  className="h-8 w-8 text-red-400 hover:text-red-300"
                                  disabled={exercise.sets.length <= 1}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addSet(idx)}
                              className="w-full mt-2 text-xs gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Set
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              ) : (
                workout.exercises?.map((exercise, idx) => {
                  let setsArray: SetData[] = [];
                  if (Array.isArray(exercise.sets)) {
                    setsArray = exercise.sets;
                  } else if (exercise.sets && typeof exercise.sets === 'object' && !Array.isArray(exercise.sets)) {
                    setsArray = Object.values(exercise.sets as Record<string, SetData>);
                  } else if (typeof exercise.sets === 'number' && exercise.sets > 0) {
                    for (let i = 0; i < exercise.sets; i++) {
                      setsArray.push({
                        reps: typeof exercise.reps === 'string' ? parseInt(exercise.reps) || undefined : exercise.reps,
                        weight: exercise.weight,
                        completed: exercise.completed,
                      });
                    }
                  }
                  const hasDetailedSets = setsArray.length > 0;
                  const isExpanded = expandedExercises.has(idx);
                  const setCount = setsArray.length;

                  return (
                    <Card 
                      key={idx} 
                      className="bg-card/50 border-white/10 overflow-hidden"
                      data-testid={`exercise-card-${idx}`}
                    >
                      <button
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                        onClick={() => hasDetailedSets && toggleExercise(idx)}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{exercise.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {setCount > 0 && `${setCount} sets`}
                            {exercise.muscleGroup && (
                              <span className="ml-2 text-xs text-primary/70">• {exercise.muscleGroup}</span>
                            )}
                          </div>
                        </div>
                        {hasDetailedSets && (
                          <div className="ml-2">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </button>

                      {hasDetailedSets && isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5">
                          <div className="pt-3 space-y-2">
                            <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium pb-2 border-b border-white/5">
                              <div>Set</div>
                              <div>Reps</div>
                              <div>Weight</div>
                              <div>RIR</div>
                              <div>Rest</div>
                            </div>
                            {setsArray.map((set, setIdx) => {
                              const restValue = set.restTime ?? set.restSeconds ?? set.rest;
                              return (
                                <div 
                                  key={setIdx} 
                                  className="space-y-1 py-2 border-b border-white/5 last:border-0"
                                  data-testid={`set-row-${idx}-${setIdx}`}
                                >
                                  <div className="grid grid-cols-5 gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{setIdx + 1}</span>
                                      {set.completed && (
                                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                                      )}
                                    </div>
                                    <div className="text-sm">
                                      {set.reps ?? '-'}
                                    </div>
                                    <div className="text-sm">
                                      {set.weight && set.weight > 0 ? `${set.weight}kg` : '-'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {set.rir !== undefined ? set.rir : '-'}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                      {restValue ? (
                                        <>
                                          <Timer className="w-3 h-3" />
                                          {restValue}s
                                        </>
                                      ) : '-'}
                                    </div>
                                  </div>
                                  {(set.tempo || set.notes) && (
                                    <div className="text-xs text-muted-foreground pl-0 flex gap-3">
                                      {set.tempo && <span>Tempo: {set.tempo}</span>}
                                      {set.notes && <span className="italic">{set.notes}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {exercise.notes && (
                        <div className="px-4 pb-3 text-xs text-muted-foreground italic">
                          {exercise.notes}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {isEditing ? (
          <Card className="bg-card/50 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
              <Textarea
                value={editableNotes}
                onChange={(e) => setEditableNotes(e.target.value)}
                placeholder="Add notes about this workout..."
                className="bg-transparent border-white/10 min-h-[80px]"
              />
            </CardContent>
          </Card>
        ) : workout.notes && (
          <Card className="bg-card/50 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
              <p className="text-sm">{workout.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
