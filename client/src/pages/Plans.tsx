import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { analytics } from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Calendar,
  CalendarDays,
  Trophy, 
  Plus, 
  Trash2, 
  Check, 
  CheckCircle2,
  Clock, 
  Flame, 
  ChevronLeft, 
  ChevronRight,
  Dumbbell,
  Activity,
  Battery,
  TrendingUp,
  Edit2,
  MapPin,
  MoreVertical,
  RotateCcw,
  Play,
  FileText,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RefreshCw,
  Moon,
  Loader2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  useFitnessProfile, 
  useUpdateFitnessProfile, 
  useUpdateFatigue,
  useMilestones, 
  useCreateMilestone, 
  useUpdateMilestone,
  useCompleteMilestone,
  useDeleteMilestone,
  useScheduledWorkouts,
  useCreateScheduledWorkout,
  useUpdateScheduledWorkout,
  useCompleteScheduledWorkout,
  useDeleteScheduledWorkout,
  useGenerateWeekPlan,
  useWearableActivities,
  useWeeklyReport,
  useGenerateWeeklyReport,
  useAcknowledgeWeeklyReport,
  type Milestone,
  type ScheduledWorkout,
  type WearableActivity,
  type WeeklyReviewReport
} from "@/lib/api";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from "date-fns";

const SPORT_OPTIONS = [
  "Strength Training", "Running"
];

const TRAINING_ENVIRONMENTS = [
  { value: "home", label: "Home" },
  { value: "gym", label: "Gym" },
  { value: "outdoor", label: "Outdoor" },
  { value: "mixed", label: "Mixed" },
];

const INTENSITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "variable", label: "Variable" },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

import { useToast } from "@/hooks/use-toast";
import { useGuidedWorkout, type GuidedExercise } from "@/hooks/use-guided-workout";
import { 
  ACTIVITY_TYPES, 
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_OPTIONS,
  getActivityConfig, 
  getScheduledWorkoutDefaults,
  shouldAllowManualInput,
  shouldUseWearableAsPrimary,
  type ActivityTypeConfig 
} from "@shared/activityTypes";

export default function Plans() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [completingWorkout, setCompletingWorkout] = useState<ScheduledWorkout | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleWorkout, setRescheduleWorkout] = useState<ScheduledWorkout | null>(null);
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [completingExerciseData, setCompletingExerciseData] = useState<Array<{ name: string; sets: number; reps: number; weight?: number }>>([]);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [selectedWearableActivity, setSelectedWearableActivity] = useState<WearableActivity | null>(null);
  const [viewingWorkout, setViewingWorkout] = useState<ScheduledWorkout | null>(null);
  
  const { startWorkout: startGuidedWorkout } = useGuidedWorkout();
  
  // Track page view
  useEffect(() => {
    analytics.trackPageView('plan');
  }, []);

  const { data: fitnessProfile, isLoading: profileLoading } = useFitnessProfile();
  const updateProfile = useUpdateFitnessProfile();
  const updateFatigue = useUpdateFatigue();

  const { data: fitbitStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/fitbit/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/fitbit/status", { credentials: "include" });
        if (!res.ok) return { connected: false };
        return res.json();
      } catch {
        return { connected: false };
      }
    },
  });

  const { data: garminStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/garmin/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/garmin/status", { credentials: "include" });
        if (!res.ok) return { connected: false };
        return res.json();
      } catch {
        return { connected: false };
      }
    },
  });

  const hasWearableConnected = fitbitStatus?.connected || garminStatus?.connected || false;
  
  // Weekly review report hooks
  const { data: weeklyReport } = useWeeklyReport();
  const generateWeeklyReport = useGenerateWeeklyReport();
  const acknowledgeWeeklyReport = useAcknowledgeWeeklyReport();
  
  const { data: milestones = [], isLoading: milestonesLoading } = useMilestones();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const completeMilestone = useCompleteMilestone();
  const deleteMilestone = useDeleteMilestone();
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const { data: scheduledWorkouts = [], isLoading: workoutsLoading } = useScheduledWorkouts(weekStart, weekEnd);
  const createScheduledWorkout = useCreateScheduledWorkout();
  const updateScheduledWorkout = useUpdateScheduledWorkout();
  const completeScheduledWorkout = useCompleteScheduledWorkout();
  const deleteScheduledWorkout = useDeleteScheduledWorkout();
  const generateWeekPlan = useGenerateWeekPlan();
  
  // Fetch wearable activities for the current week (to support linked activities in workout details)
  const { data: wearableActivities = [] } = useWearableActivities(weekStart, weekEnd);
  
  // Fetch workout logs for the current day (completed workouts logged via Trainer or Tracker)
  type WorkoutLogCard = {
    id: string;
    workoutName: string;
    activityType?: string;
    date: string;
    duration: number;
    caloriesBurned: number;
    distance?: number;
    exercises: Array<any> | null;
    completed: boolean;
    notes?: string;
    source?: string;
  };
  const { data: workoutLogs = [] } = useQuery<WorkoutLogCard[]>({
    queryKey: ["/api/workout-logs", format(currentDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(currentDate);
      endDate.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeWearable: 'false',
      });
      const res = await fetch(`/api/workout-logs?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const logs = await res.json();
      return logs.filter((log: any) => isSameDay(new Date(log.date), currentDate));
    },
  });
  
  // Day boundaries for filtering
  const dayStart = new Date(currentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(currentDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Filter wearable activities for current day
  const wearableActivitiesForDay = wearableActivities.filter(wa => {
    const activityDate = new Date(wa.date);
    return isSameDay(activityDate, currentDate);
  });

  const { toast } = useToast();
  const hasAttemptedAutoGenerate = useRef(false);
  const lastWeekKey = useRef('');
  
  const currentWeekKey = format(weekStart, 'yyyy-MM-dd');
  if (currentWeekKey !== lastWeekKey.current) {
    lastWeekKey.current = currentWeekKey;
    hasAttemptedAutoGenerate.current = false;
  }
  
  const hasUpcomingWorkouts = scheduledWorkouts.some(w => w.status === 'scheduled');
  
  useEffect(() => {
    if (
      !workoutsLoading && 
      !hasUpcomingWorkouts && 
      !hasAttemptedAutoGenerate.current && 
      !generateWeekPlan.isPending
    ) {
      hasAttemptedAutoGenerate.current = true;
      generateWeekPlan.mutate(undefined, {
        onError: () => {
          toast({
            title: "Couldn't generate your plan",
            description: "You can try again using the button below, or schedule workouts manually.",
            variant: "destructive",
          });
        },
      });
    }
  }, [workoutsLoading, hasUpcomingWorkouts, currentWeekKey]);

  const navigateDay = (direction: number) => {
    setCurrentDate(prev => addDays(prev, direction));
  };

  const getWorkoutsForDay = (date: Date) => {
    return scheduledWorkouts.filter(w => {
      // Extract just the date portion (YYYY-MM-DD) to avoid timezone issues
      // scheduledDate from server is in UTC, so we compare date strings only
      const scheduledDateValue = w.scheduledDate as string | Date;
      const workoutDateStr = typeof scheduledDateValue === 'string' 
        ? scheduledDateValue.split('T')[0] 
        : new Date(scheduledDateValue).toISOString().split('T')[0];
      const targetDateStr = format(date, 'yyyy-MM-dd');
      return workoutDateStr === targetDateStr;
    });
  };

  const activeMilestones = milestones.filter(m => m.status === 'in_progress');
  const completedMilestones = milestones.filter(m => m.status === 'completed');

  const fatigueColor = (level: number) => {
    if (level <= 3) return "text-green-400";
    if (level <= 6) return "text-yellow-400";
    return "text-red-400";
  };

  const fatigueLabel = (level: number) => {
    if (level <= 3) return "Fresh";
    if (level <= 6) return "Moderate";
    return "Fatigued";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-white">Today's Activities</h1>
          <p className="text-muted-foreground">Your daily training schedule</p>
        </div>
        <Button 
          onClick={() => setShowProfileModal(true)}
          variant="outline" 
          className="border-primary text-primary hover:bg-primary/10"
          data-testid="button-edit-profile"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Weekly Review Report Card */}
      {weeklyReport && !weeklyReport.acknowledgedByUser && (
        <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{weeklyReport.reportTitle || 'Weekly Review'}</CardTitle>
              </div>
              <Badge className="bg-primary/20 text-primary border-0">Week {weeklyReport.weekNumber}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{weeklyReport.reportSummary}</p>
            
            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-3" data-testid="weekly-report-stats">
              <div className="bg-black/20 rounded-lg p-2 text-center" data-testid="stat-workouts">
                <div className="text-xs text-muted-foreground">Workouts</div>
                <div className="text-lg font-bold">{weeklyReport.workoutsCompleted ?? 0}/{weeklyReport.workoutsPlanned ?? 0}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center" data-testid="stat-rpe">
                <div className="text-xs text-muted-foreground">Avg RPE</div>
                <div className="text-lg font-bold">{weeklyReport.avgRpe != null ? weeklyReport.avgRpe.toFixed(1) : '-'}</div>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center" data-testid="stat-sleep">
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Moon className="w-3 h-3" /> Sleep
                </div>
                <div className="text-lg font-bold">{weeklyReport.avgSleepMinutes != null ? Math.round(weeklyReport.avgSleepMinutes / 60) : '-'}h</div>
              </div>
            </div>

            {/* Calorie Adjustment */}
            {weeklyReport.calorieAdjustmentPercent != null && weeklyReport.calorieAdjustmentPercent !== 0 && (
              <div className="bg-black/20 rounded-lg p-3" data-testid="calorie-adjustment">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium">Calorie Target Updated</span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${weeklyReport.calorieAdjustmentPercent > 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="text-calorie-change">
                    {weeklyReport.calorieAdjustmentPercent > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {Math.abs(weeklyReport.calorieAdjustmentPercent).toFixed(0)}%
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-calorie-values">
                  {weeklyReport.previousCalorieTarget ?? '-'} → {weeklyReport.newCalorieTarget ?? '-'} kcal
                </p>
              </div>
            )}

            {/* Workout Adjustments */}
            {weeklyReport.workoutAdjustments && weeklyReport.workoutAdjustments.volumeChange !== 'maintain' && (
              <div className="bg-black/20 rounded-lg p-3" data-testid="workout-adjustment">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium">Training Adjustment</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${
                    weeklyReport.workoutAdjustments.volumeChange === 'increase' ? 'border-green-500 text-green-400' :
                    weeklyReport.workoutAdjustments.volumeChange === 'deload' ? 'border-orange-500 text-orange-400' :
                    'border-yellow-500 text-yellow-400'
                  }`} data-testid="badge-volume-change">
                    {weeklyReport.workoutAdjustments.volumeChange === 'deload' ? 'Deload Week' :
                     `Volume ${weeklyReport.workoutAdjustments.volumeChangePercent > 0 ? '+' : ''}${weeklyReport.workoutAdjustments.volumeChangePercent}%`}
                  </Badge>
                </div>
                {weeklyReport.workoutAdjustments.specificChanges && weeklyReport.workoutAdjustments.specificChanges.length > 0 && (
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1" data-testid="list-workout-changes">
                    {weeklyReport.workoutAdjustments.specificChanges.slice(0, 2).map((change, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary">•</span> {change}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Key Insights */}
            {weeklyReport.keyInsights && weeklyReport.keyInsights.length > 0 && (
              <div className="space-y-1" data-testid="key-insights">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="w-3 h-3" /> Key Insights
                </div>
                <ul className="text-sm space-y-1" data-testid="list-insights">
                  {weeklyReport.keyInsights.slice(0, 3).map((insight, i) => (
                    <li key={i} className="flex items-start gap-2" data-testid={`text-insight-${i}`}>
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button 
              className="w-full gradient-primary"
              onClick={() => weeklyReport.id && acknowledgeWeeklyReport.mutate(weeklyReport.id)}
              disabled={acknowledgeWeeklyReport.isPending}
              data-testid="button-acknowledge-weekly-report"
            >
              <Check className="w-4 h-4 mr-2" />
              Got it, thanks!
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate Weekly Report Button (if no recent report) */}
      {!weeklyReport && (
        <Card className="bg-card border-white/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Weekly Review</p>
                <p className="text-xs text-muted-foreground">Get your trainer's analysis of last week</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateWeeklyReport.mutate()}
              disabled={generateWeeklyReport.isPending}
              data-testid="button-generate-weekly-report"
            >
              {generateWeeklyReport.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generate
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDay(-1)}
            className="h-12 w-12"
            data-testid="button-prev-day"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <button 
            className="flex-1 text-center py-2"
            onClick={() => setCurrentDate(new Date())}
            data-testid="button-today"
          >
            <h2 className="text-2xl font-bold text-white">
              {format(currentDate, "EEEE")}
            </h2>
            <p className="text-base text-muted-foreground">
              {format(currentDate, "MMMM d, yyyy")}
            </p>
          </button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowWorkoutModal(true)}
              className="h-10 w-10 text-primary hover:bg-primary/10"
              data-testid="button-add-activity-header"
            >
              <Plus className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDay(1)}
              className="h-12 w-12"
              data-testid="button-next-day"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {(() => {
          const dayWorkouts = getWorkoutsForDay(currentDate);
          const isToday = isSameDay(currentDate, new Date());
          const hasAnyActivities = dayWorkouts.length > 0 || wearableActivitiesForDay.length > 0 || workoutLogs.length > 0;
          
          return !hasAnyActivities ? (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 text-center">
                {generateWeekPlan.isPending ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
                    <p className="text-muted-foreground mb-2">Your trainer is building your workout plan...</p>
                    <p className="text-xs text-muted-foreground/60">This may take a few moments</p>
                  </>
                ) : (
                  <>
                    <Dumbbell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No activities scheduled for {isToday ? 'today' : 'this day'}</p>
                    <div className="flex flex-col gap-3 items-center">
                      <Button
                        onClick={() => setShowWorkoutModal(true)}
                        className="gradient-primary"
                        data-testid="button-add-workout-empty"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Schedule an Activity
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateWeekPlan.mutate()}
                        disabled={generateWeekPlan.isPending}
                        className="border-primary/30 hover:bg-primary/10"
                        data-testid="button-generate-week-plan"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Week Plan with AI
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {wearableActivitiesForDay.map((activity) => (
                <Card 
                  key={`wearable-${activity.id}`}
                  className="bg-card border-white/5 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedWearableActivity(activity)}
                  data-testid={`wearable-activity-${activity.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{activity.activityName}</h3>
                        <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                          {activity.sourceDevice === 'garmin' ? 'Garmin' : activity.sourceDevice === 'fitbit' ? 'Fitbit' : activity.sourceDevice}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="border-white/10 capitalize">
                        {activity.activityType?.replace(/_/g, ' ') || 'Activity'}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-4 text-sm text-muted-foreground mb-1">
                      {activity.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {activity.duration} min
                        </span>
                      )}
                      {activity.caloriesBurned && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-orange-400" />
                          {activity.caloriesBurned} cal
                        </span>
                      )}
                      {activity.distance && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {activity.distance.toFixed(2)} km
                        </span>
                      )}
                    </div>
                    
                    {activity.averageHeartRate && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Activity className="w-4 h-4 text-red-400" />
                        {activity.averageHeartRate} bpm
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {/* Workout logs (completed via Trainer or Tracker) */}
              {workoutLogs.map((log) => (
                <Card 
                  key={`log-${log.id}`}
                  className="bg-card border-white/5 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setLocation(`/workout/${log.id}`)}
                  data-testid={`workout-log-${log.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{log.workoutName}</h3>
                        {log.source && (
                          <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                            {log.source}
                          </Badge>
                        )}
                        <Badge className="bg-green-500/20 text-green-400 border-0 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </Badge>
                      </div>
                      <Badge variant="outline" className="border-white/10 capitalize">
                        {log.activityType?.replace(/_/g, ' ') || 'Activity'}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-4 text-sm text-muted-foreground mb-1">
                      {log.duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {log.duration} min
                        </span>
                      )}
                      {log.caloriesBurned > 0 && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-orange-400" />
                          {log.caloriesBurned} cal
                        </span>
                      )}
                      {log.distance && log.distance > 0 && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {log.distance.toFixed(2)} km
                        </span>
                      )}
                      {log.exercises && log.exercises.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-4 h-4 text-amber-400" />
                          {log.exercises.length} exercises
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {dayWorkouts.filter(w => w.status !== 'completed').map((workout) => (
                <Card 
                  key={workout.id}
                  className="bg-card border-white/5 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setViewingWorkout(workout)}
                  data-testid={`workout-${workout.id}`}
                >
                  <CardContent className="p-4">
                    {/* Row 1: Title + Source Badge (left) | Activity Type Badge (right) */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{workout.title}</h3>
                        {workout.dataSource?.startsWith('detected_') && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                            {workout.dataSource === 'detected_garmin' ? 'Garmin' : 
                             workout.dataSource === 'detected_fitbit' ? 'Fitbit' : 
                             'Synced'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {workout.workoutType && (
                          <Badge variant="outline" className="border-white/10 capitalize">
                            {workout.workoutType.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompletingWorkout(workout);
                                setShowFeedbackModal(true);
                              }}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Mark as Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setRescheduleWorkout(workout);
                                setNewScheduledDate(format(new Date(workout.scheduledDate), 'yyyy-MM-dd'));
                                setShowRescheduleModal(true);
                              }}
                            >
                              <CalendarDays className="w-4 h-4 mr-2" />
                              Reschedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-800" />
                            <DropdownMenuItem 
                              className="text-red-400 focus:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this activity?')) {
                                  deleteScheduledWorkout.mutate(workout.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Activity
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    {/* Row 2: Exercises summary for strength workouts (PRIMARY) */}
                    {(() => {
                      const exercises = (workout as any).exercises;
                      const workoutType = (workout.workoutType || '').toLowerCase();
                      const activityType = ((workout as any).activityType || '').toLowerCase();
                      const isStrength = workoutType.includes('strength') || activityType.includes('strength');
                      
                      if (isStrength && Array.isArray(exercises) && exercises.length > 0) {
                        const totalSets = exercises.reduce((sum: number, ex: any) => sum + (ex.sets || 0), 0);
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Dumbbell className="w-4 h-4 text-amber-400" />
                            <span>{exercises.length} exercises</span>
                            <span className="text-xs">•</span>
                            <span>{totalSets} sets</span>
                            {workout.duration && (
                              <>
                                <span className="text-xs">•</span>
                                <span className="text-xs opacity-70">~{workout.duration} min</span>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Row 2b: Metrics for non-strength or fallback */}
                    {(() => {
                      const exercises = (workout as any).exercises;
                      const workoutType = (workout.workoutType || '').toLowerCase();
                      const activityType = ((workout as any).activityType || '').toLowerCase();
                      const isStrength = workoutType.includes('strength') || activityType.includes('strength');
                      const hasExercises = Array.isArray(exercises) && exercises.length > 0;
                      
                      // Skip if strength workout with exercises (already shown above)
                      if (isStrength && hasExercises) return null;
                      
                      return (
                        <div className="flex gap-4 text-sm text-muted-foreground mb-1">
                          {workout.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {workout.duration} min
                            </span>
                          )}
                          {(workout as any).caloriesBurned && (
                            <span className="flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-400" />
                              {(workout as any).caloriesBurned} cal
                            </span>
                          )}
                          {(workout as any).distance && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {(workout as any).distance.toFixed(2)} km
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Row 3: Heart Rate (dedicated row) */}
                    {(workout as any).averageHeartRate && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Activity className="w-4 h-4 text-red-400" />
                        {(workout as any).averageHeartRate} bpm
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })()}
        
      </div>

      <FitnessProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        profile={fitnessProfile}
        onSave={(data) => {
          updateProfile.mutate(data);
          setShowProfileModal(false);
        }}
      />

      <MilestoneModal
        open={showMilestoneModal}
        onOpenChange={setShowMilestoneModal}
        milestone={editingMilestone}
        onSave={(data) => {
          if (editingMilestone) {
            updateMilestone.mutate({ id: editingMilestone.id, ...data });
          } else {
            createMilestone.mutate(data);
          }
          setShowMilestoneModal(false);
          setEditingMilestone(null);
        }}
      />

      <ScheduleWorkoutModal
        open={showWorkoutModal}
        onOpenChange={setShowWorkoutModal}
        selectedDate={currentDate}
        hasWearableConnected={hasWearableConnected}
        onSave={(data) => {
          createScheduledWorkout.mutate(data);
          setShowWorkoutModal(false);
        }}
      />

      <WorkoutFeedbackModal
        open={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        workout={completingWorkout}
        onSubmit={(feedback) => {
          if (completingWorkout) {
            completeScheduledWorkout.mutate({ 
              id: completingWorkout.id, 
              feedback,
              exerciseData: completingExerciseData.length > 0 ? completingExerciseData : undefined
            });
          }
          setShowFeedbackModal(false);
          setCompletingWorkout(null);
          setCompletingExerciseData([]);
        }}
      />

      {/* Reschedule Workout Modal */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Reschedule Workout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400 text-sm mb-4">
              Move "{rescheduleWorkout?.title}" to a new day
            </p>
            <Label className="text-gray-300 text-sm">New Date</Label>
            <Input
              type="date"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-700 text-white"
              data-testid="input-reschedule-date"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRescheduleModal(false);
                setRescheduleWorkout(null);
              }}
              className="border-gray-700 text-gray-300"
              data-testid="button-cancel-reschedule"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rescheduleWorkout && newScheduledDate) {
                  updateScheduledWorkout.mutate({
                    id: rescheduleWorkout.id,
                    scheduledDate: new Date(newScheduledDate + 'T12:00:00'),
                  });
                  setShowRescheduleModal(false);
                  setRescheduleWorkout(null);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-black"
              data-testid="button-confirm-reschedule"
            >
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkoutDetailModal
        workout={viewingWorkout}
        linkedWearableActivity={wearableActivities.find(wa => wa.id === viewingWorkout?.linkedWearableActivityId) || null}
        onClose={() => setViewingWorkout(null)}
        onComplete={(workout, exerciseData) => {
          setCompletingWorkout(workout);
          setCompletingExerciseData(exerciseData);
          setShowFeedbackModal(true);
          setViewingWorkout(null);
        }}
        onDelete={(id) => {
          deleteScheduledWorkout.mutate(id);
          setViewingWorkout(null);
        }}
        onStartGuidedFlow={(workout) => {
          const exercises = workout.exercises as Array<{name: string; sets?: number | string; reps?: number | string; weight?: number | string}> || [];
          const guidedExercises: GuidedExercise[] = exercises.map(ex => ({
            name: ex.name,
            targetSets: typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets) || '3'),
            targetReps: typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps) || '10'),
            targetWeight: ex.weight ? (typeof ex.weight === 'number' ? ex.weight : parseFloat(String(ex.weight))) : null,
          }));
          startGuidedWorkout(workout.title, guidedExercises, 90, workout.id);
          setViewingWorkout(null);
          setLocation('/tracker/flow');
        }}
        onStartGuidedFlowWithWarmup={(workout) => {
          const exercises = workout.exercises as Array<{name: string; sets?: number | string; reps?: number | string; weight?: number | string}> || [];
          const guidedExercises: GuidedExercise[] = exercises.map((ex, index) => ({
            name: ex.name,
            // Add 2 warmup sets to the FIRST exercise only
            targetSets: (typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets) || '3')) + (index === 0 ? 2 : 0),
            targetReps: typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps) || '10'),
            targetWeight: ex.weight ? (typeof ex.weight === 'number' ? ex.weight : parseFloat(String(ex.weight))) : null,
            // Mark first exercise as having 2 warmup sets
            warmupSets: index === 0 ? 2 : 0,
          }));
          startGuidedWorkout(workout.title, guidedExercises, 90, workout.id);
          setViewingWorkout(null);
          setLocation('/tracker/flow');
        }}
      />

      <WearableActivityDetailModal
        activity={selectedWearableActivity}
        onClose={() => setSelectedWearableActivity(null)}
      />
    </div>
  );
}

function WearableActivityDetailModal({ 
  activity, 
  onClose 
}: { 
  activity: WearableActivity | null; 
  onClose: () => void;
}) {
  if (!activity) return null;

  const formatPace = (paceInMinPerKm: number | null) => {
    if (!paceInMinPerKm) return null;
    const mins = Math.floor(paceInMinPerKm);
    const secs = Math.round((paceInMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  };

  return (
    <Dialog open={!!activity} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            {activity.activityName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400 border-0">
              {activity.sourceDevice === 'garmin' ? 'Garmin' : 'Fitbit'}
            </Badge>
            <Badge variant="outline" className="border-white/10 capitalize">
              {activity.activityType}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(activity.date), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {activity.duration && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-lg font-semibold text-white flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {activity.duration} min
                </div>
              </div>
            )}
            {activity.caloriesBurned && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Calories</div>
                <div className="text-lg font-semibold text-orange-400 flex items-center gap-1">
                  <Flame className="w-4 h-4" />
                  {activity.caloriesBurned}
                </div>
              </div>
            )}
            {activity.distance && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Distance</div>
                <div className="text-lg font-semibold text-white flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {activity.distance.toFixed(2)} km
                </div>
              </div>
            )}
            {activity.avgPace && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Avg Pace</div>
                <div className="text-lg font-semibold text-white">
                  {formatPace(activity.avgPace)}
                </div>
              </div>
            )}
            {activity.averageHeartRate && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Avg Heart Rate</div>
                <div className="text-lg font-semibold text-red-400 flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  {activity.averageHeartRate} bpm
                </div>
              </div>
            )}
            {activity.maxHeartRate && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Max Heart Rate</div>
                <div className="text-lg font-semibold text-red-400">
                  {activity.maxHeartRate} bpm
                </div>
              </div>
            )}
            {activity.elevationGain && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Elevation Gain</div>
                <div className="text-lg font-semibold text-green-400">
                  {activity.elevationGain.toFixed(0)} m
                </div>
              </div>
            )}
            {activity.avgPower && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Avg Power</div>
                <div className="text-lg font-semibold text-purple-400">
                  {activity.avgPower} W
                </div>
              </div>
            )}
            {activity.trainingLoad && (
              <div className="bg-gray-900 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Training Load</div>
                <div className="text-lg font-semibold text-yellow-400">
                  {activity.trainingLoad}
                </div>
              </div>
            )}
          </div>

          {activity.notes && (
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Notes</div>
              <p className="text-sm text-white">{activity.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FitnessProfileModal({ 
  open, 
  onOpenChange, 
  profile, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  profile: any;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    primarySport: profile?.primarySport || "",
    trainingEnvironment: profile?.trainingEnvironment || "",
    shortTermGoal: profile?.shortTermGoal || "",
    longTermGoal: profile?.longTermGoal || "",
    workoutDuration: profile?.workoutDuration || 60,
    intensityPreference: profile?.intensityPreference || "moderate",
    preferredWorkoutDays: profile?.preferredWorkoutDays || [],
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Fitness Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Primary Sport/Activity</Label>
            <Select
              value={formData.primarySport}
              onValueChange={(v) => setFormData(p => ({ ...p, primarySport: v }))}
            >
              <SelectTrigger data-testid="select-primary-sport">
                <SelectValue placeholder="Select your main activity" />
              </SelectTrigger>
              <SelectContent>
                {SPORT_OPTIONS.map((sport) => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Training Environment</Label>
            <Select
              value={formData.trainingEnvironment}
              onValueChange={(v) => setFormData(p => ({ ...p, trainingEnvironment: v }))}
            >
              <SelectTrigger data-testid="select-environment">
                <SelectValue placeholder="Where do you train?" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_ENVIRONMENTS.map((env) => (
                  <SelectItem key={env.value} value={env.value}>{env.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Intensity Preference</Label>
            <Select
              value={formData.intensityPreference}
              onValueChange={(v) => setFormData(p => ({ ...p, intensityPreference: v }))}
            >
              <SelectTrigger data-testid="select-intensity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTENSITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Preferred Workout Duration (minutes)</Label>
            <Input
              type="number"
              value={formData.workoutDuration}
              onChange={(e) => setFormData(p => ({ ...p, workoutDuration: parseInt(e.target.value) }))}
              min={10}
              max={300}
              data-testid="input-duration"
            />
          </div>

          <div>
            <Label>Short-term Goal</Label>
            <Input
              value={formData.shortTermGoal}
              onChange={(e) => setFormData(p => ({ ...p, shortTermGoal: e.target.value }))}
              placeholder="e.g., Run 5K without stopping"
              data-testid="input-short-goal"
            />
          </div>

          <div>
            <Label>Long-term Goal</Label>
            <Input
              value={formData.longTermGoal}
              onChange={(e) => setFormData(p => ({ ...p, longTermGoal: e.target.value }))}
              placeholder="e.g., Complete a marathon"
              data-testid="input-long-goal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="gradient-primary" onClick={() => onSave(formData)} data-testid="button-save-profile">
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneModal({ 
  open, 
  onOpenChange, 
  milestone, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  milestone: Milestone | null;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    title: milestone?.title || "",
    description: milestone?.description || "",
    targetValue: milestone?.targetValue || "",
    currentValue: milestone?.currentValue || "",
    unit: milestone?.unit || "",
    category: milestone?.category || "custom",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit Milestone" : "Create Milestone"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g., Bench Press 100kg"
              data-testid="input-milestone-title"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              data-testid="input-milestone-description"
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData(p => ({ ...p, category: v }))}
            >
              <SelectTrigger data-testid="select-milestone-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="endurance">Endurance</SelectItem>
                <SelectItem value="nutrition">Nutrition</SelectItem>
                <SelectItem value="habit">Habit</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Target Value</Label>
              <Input
                type="number"
                value={formData.targetValue}
                onChange={(e) => setFormData(p => ({ ...p, targetValue: e.target.value }))}
                placeholder="100"
                data-testid="input-milestone-target"
              />
            </div>
            <div>
              <Label>Current Value</Label>
              <Input
                type="number"
                value={formData.currentValue}
                onChange={(e) => setFormData(p => ({ ...p, currentValue: e.target.value }))}
                placeholder="80"
                data-testid="input-milestone-current"
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={formData.unit}
                onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))}
                placeholder="kg"
                data-testid="input-milestone-unit"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            className="gradient-primary" 
            onClick={() => onSave({
              ...formData,
              targetValue: formData.targetValue ? parseFloat(formData.targetValue as string) : null,
              currentValue: formData.currentValue ? parseFloat(formData.currentValue as string) : null,
            })}
            disabled={!formData.title}
            data-testid="button-save-milestone"
          >
            {milestone ? "Update" : "Create"} Milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultFormDataForActivity(activityType: string, selectedDate: Date) {
  const defaults = getScheduledWorkoutDefaults(activityType);
  return {
    title: "",
    activityType,
    scheduledDate: format(selectedDate, "yyyy-MM-dd"),
    description: "",
    duration: defaults.duration,
    distance: defaults.distance,
    intensity: defaults.intensity,
    exercises: [] as Array<{name: string; muscleGroup: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; targetRir: number}>,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  [ACTIVITY_CATEGORIES.STRENGTH]: 'Strength',
  [ACTIVITY_CATEGORIES.ENDURANCE]: 'Cardio',
};

const CATEGORY_ORDER = [
  ACTIVITY_CATEGORIES.STRENGTH,
  ACTIVITY_CATEGORIES.ENDURANCE,
];

function ScheduleWorkoutModal({ 
  open, 
  onOpenChange, 
  selectedDate,
  onSave,
  hasWearableConnected = false
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  selectedDate: Date;
  onSave: (data: any) => void;
  hasWearableConnected?: boolean;
}) {
  const [formData, setFormData] = useState(() => getDefaultFormDataForActivity("strength_training", selectedDate));

  const activityConfig = getActivityConfig(formData.activityType);
  const useWearableData = hasWearableConnected && shouldUseWearableAsPrimary(formData.activityType);

  useEffect(() => {
    if (open) {
      setFormData(getDefaultFormDataForActivity("strength_training", selectedDate));
    }
  }, [open, selectedDate]);

  const handleActivityTypeChange = (newActivityType: string) => {
    const defaults = getScheduledWorkoutDefaults(newActivityType);
    setFormData(prev => ({
      ...prev,
      activityType: newActivityType,
      duration: defaults.duration,
      distance: defaults.distance,
      exercises: [],
    }));
  };

  const groupedActivities = CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = ACTIVITY_TYPE_OPTIONS.filter(a => a.category === category);
    return acc;
  }, {} as Record<string, typeof ACTIVITY_TYPE_OPTIONS>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Activity Type *</Label>
            <Select
              value={formData.activityType}
              onValueChange={handleActivityTypeChange}
            >
              <SelectTrigger data-testid="select-activity-type">
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {CATEGORY_ORDER.map((category, idx) => {
                  const activities = groupedActivities[category];
                  if (!activities || activities.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className={`px-2 py-1.5 text-xs font-semibold text-muted-foreground ${idx > 0 ? 'mt-2' : ''}`}>
                        {CATEGORY_LABELS[category]}
                      </div>
                      {activities.map((activity) => (
                        <SelectItem key={activity.key} value={activity.key}>{activity.name}</SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            {activityConfig && (
              <p className="text-xs text-muted-foreground mt-1">{activityConfig.description}</p>
            )}
          </div>

          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder={activityConfig?.name ? `e.g., Morning ${activityConfig.name}` : "e.g., Morning Run"}
              data-testid="input-workout-title"
            />
          </div>

          {activityConfig?.category === ACTIVITY_CATEGORIES.ENDURANCE && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-sm text-blue-400">
                {useWearableData 
                  ? "Wearable connected - duration, distance, and heart rate will be auto-imported when you complete this activity."
                  : "Duration and distance will be captured when you complete this activity. Just schedule for now!"}
              </p>
            </div>
          )}

          {activityConfig?.category === ACTIVITY_CATEGORIES.STRENGTH && (
            <div>
              <Label>Estimated Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))}
                placeholder="60"
                data-testid="input-workout-duration"
              />
            </div>
          )}

          {activityConfig?.showRPE && (
            <div>
              <Label>Target Intensity</Label>
              <Select
                value={formData.intensity}
                onValueChange={(v) => setFormData(p => ({ ...p, intensity: v }))}
              >
                <SelectTrigger data-testid="select-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Recovery pace)</SelectItem>
                  <SelectItem value="moderate">Moderate (Comfortable)</SelectItem>
                  <SelectItem value="high">High (Challenging)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Any additional notes..."
              data-testid="input-workout-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            className="gradient-primary" 
            onClick={() => onSave({
              title: formData.title,
              workoutType: formData.activityType,
              scheduledDate: formData.scheduledDate,
              description: formData.description,
              duration: formData.duration,
              intensity: formData.intensity,
              dayOfWeek: format(new Date(formData.scheduledDate), "EEEE"),
              sportCategory: activityConfig?.category,
              exercises: formData.exercises,
            })}
            disabled={!formData.title}
            data-testid="button-schedule-workout"
          >
            Schedule Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkoutFeedbackModal({
  open,
  onOpenChange,
  workout,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: ScheduledWorkout | null;
  onSubmit: (feedback: 'easy' | 'moderate' | 'hard') => void;
}) {
  if (!workout) return null;

  const feedbackOptions = [
    { 
      value: 'easy' as const, 
      label: 'Too Easy', 
      description: 'I could have done more',
      color: 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30',
      icon: '😊'
    },
    { 
      value: 'moderate' as const, 
      label: 'Just Right', 
      description: 'Challenging but manageable',
      color: 'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30',
      icon: '💪'
    },
    { 
      value: 'hard' as const, 
      label: 'Too Hard', 
      description: 'I struggled to complete it',
      color: 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30',
      icon: '😓'
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="text-2xl">🎉</span>
            <br />
            Workout Complete!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">
            How did <span className="text-white font-medium">{workout.title}</span> feel?
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Your feedback helps your AI trainer adjust your next week's plan.
          </p>
          
          <div className="space-y-3">
            {feedbackOptions.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                className={`w-full h-auto py-4 px-4 flex items-center gap-4 border ${option.color}`}
                onClick={() => onSubmit(option.value)}
                data-testid={`button-feedback-${option.value}`}
              >
                <span className="text-2xl">{option.icon}</span>
                <div className="text-left">
                  <div className="font-medium text-white">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SetData {
  exerciseIndex: number;
  setIndex: number;
  exerciseName: string;
  plannedReps: string;
  plannedWeight: number;
  actualReps: string;
  actualWeight: string;
  completed: boolean;
}

function WorkoutDetailModal({ 
  workout, 
  linkedWearableActivity,
  onClose,
  onComplete,
  onDelete,
  onStartGuidedFlow,
  onStartGuidedFlowWithWarmup
}: { 
  workout: ScheduledWorkout | null; 
  linkedWearableActivity: WearableActivity | null;
  onClose: () => void;
  onComplete: (workout: ScheduledWorkout, exerciseData: Array<{ name: string; sets: number; reps: number; weight?: number; setsData?: Array<{ reps: number; weight: number }> }>) => void;
  onDelete: (id: string) => void;
  onStartGuidedFlow: (workout: ScheduledWorkout) => void;
  onStartGuidedFlowWithWarmup: (workout: ScheduledWorkout) => void;
}) {
  const [sets, setSets] = useState<SetData[]>([]);
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [restStartTimestamp, setRestStartTimestamp] = useState<number | null>(null);
  const [restSecondsElapsed, setRestSecondsElapsed] = useState(0);
  const [lastCompletedSetIndex, setLastCompletedSetIndex] = useState<number | null>(null);

  // Ascending rest timer - counts how long user has been resting
  useEffect(() => {
    if (restStartTimestamp) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - restStartTimestamp) / 1000);
        setRestSecondsElapsed(elapsed);
        // No auto-stop - user manually skips when ready
      }, 100);
      return () => clearInterval(interval);
    } else {
      setRestSecondsElapsed(0);
    }
  }, [restStartTimestamp]);

  useEffect(() => {
    if (workout?.exercises && Array.isArray(workout.exercises)) {
      const expandedSets: SetData[] = [];
      (workout.exercises as Array<{name: string; sets?: number | string; reps?: number | string; weight?: number | string}>).forEach((exercise, exIdx) => {
        const numSets = typeof exercise.sets === 'number' ? exercise.sets : parseInt(String(exercise.sets) || '3');
        for (let s = 0; s < numSets; s++) {
          expandedSets.push({
            exerciseIndex: exIdx,
            setIndex: s,
            exerciseName: exercise.name,
            plannedReps: String(exercise.reps || '10'),
            plannedWeight: typeof exercise.weight === 'number' ? exercise.weight : parseFloat(String(exercise.weight) || '0'),
            actualReps: String(exercise.reps || '10'),
            actualWeight: String(exercise.weight || ''),
            completed: false,
          });
        }
      });
      setSets(expandedSets);
      setRestStartTimestamp(null);
      setLastCompletedSetIndex(null);
    }
  }, [workout]);

  if (!workout) return null;

  const duration = linkedWearableActivity?.duration || workout.duration;
  const caloriesBurned = linkedWearableActivity?.caloriesBurned;
  const hasExercises = workout.exercises && Array.isArray(workout.exercises) && workout.exercises.length > 0;
  
  const completedSets = sets.filter(s => s.completed).length;
  const totalSets = sets.length;
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const updateSet = (index: number, field: 'actualReps' | 'actualWeight', value: string) => {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const completeSet = (index: number) => {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, completed: true } : s));
    const nextIncompleteIndex = sets.findIndex((s, i) => i > index && !s.completed);
    if (nextIncompleteIndex !== -1) {
      setRestStartTimestamp(Date.now()); // Start ascending timer
      setLastCompletedSetIndex(index);
    }
  };

  const skipRest = () => {
    setRestStartTimestamp(null);
    setLastCompletedSetIndex(null);
  };

  const undoSet = (index: number) => {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, completed: false } : s));
  };

  const allSetsCompleted = sets.length > 0 && sets.every(s => s.completed);

  const handleFinishWorkout = () => {
    const exerciseMap = new Map<string, { name: string; setsData: Array<{ reps: number; weight: number }> }>();
    
    sets.forEach(s => {
      const weight = parseFloat(s.actualWeight) || 0;
      const reps = parseInt(s.actualReps) || 0;
      
      if (!exerciseMap.has(s.exerciseName)) {
        exerciseMap.set(s.exerciseName, {
          name: s.exerciseName,
          setsData: []
        });
      }
      
      const exercise = exerciseMap.get(s.exerciseName)!;
      exercise.setsData.push({ reps, weight });
    });
    
    const exerciseData = Array.from(exerciseMap.values()).map(e => ({
      name: e.name,
      sets: e.setsData.length,
      reps: e.setsData.length > 0 ? Math.round(e.setsData.reduce((sum, s) => sum + s.reps, 0) / e.setsData.length) : 0,
      weight: e.setsData.length > 0 ? Math.max(...e.setsData.map(s => s.weight)) : undefined,
      setsData: e.setsData
    }));
    
    onComplete(workout, exerciseData);
  };

  return (
    <Dialog open={!!workout} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-white/10 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            {workout.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {workout.dataSource?.startsWith('detected_') && (
              <Badge className="bg-blue-500/20 text-blue-400 border-0">
                {workout.dataSource === 'detected_garmin' ? 'Garmin' : 
                 workout.dataSource === 'detected_fitbit' ? 'Fitbit' : 'Synced'}
              </Badge>
            )}
            {workout.workoutType && (
              <Badge variant="outline" className="border-white/10 capitalize">
                {workout.workoutType.replace(/_/g, ' ')}
              </Badge>
            )}
            <Badge className={`${workout.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'} border-0`}>
              {workout.status === 'completed' ? 'Completed' : isExecutionMode ? 'In Progress' : 'Scheduled'}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            {format(new Date(workout.scheduledDate), "EEEE, MMMM d, yyyy")}
          </div>

          {isExecutionMode && totalSets > 0 && (
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-primary">{completedSets} / {totalSets} sets</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isExecutionMode && restStartTimestamp && (
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-6 rounded-xl text-center">
              <div className="text-sm text-muted-foreground mb-2">Resting...</div>
              <div className={`text-5xl font-bold mb-3 ${restSecondsElapsed < 60 ? 'text-green-500' : restSecondsElapsed < 120 ? 'text-primary' : 'text-amber-500'}`}>
                {Math.floor(restSecondsElapsed / 60)}:{(restSecondsElapsed % 60).toString().padStart(2, '0')}
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                <div 
                  className={`h-2 rounded-full transition-all duration-100 ${restSecondsElapsed < 60 ? 'bg-green-500' : restSecondsElapsed < 120 ? 'bg-primary' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, (restSecondsElapsed / 180) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mb-3">Tap when ready for next set</p>
              <Button
                variant="outline"
                size="sm"
                onClick={skipRest}
                className="border-primary/50 text-primary hover:bg-primary/10"
                data-testid="button-skip-rest"
              >
                Continue
              </Button>
            </div>
          )}

          {!isExecutionMode && (
            <div className="grid grid-cols-2 gap-4">
              {duration && (
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    Duration
                  </div>
                  <div className="font-semibold">{duration} min</div>
                </div>
              )}
              {caloriesBurned && (
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Flame className="w-3 h-3" />
                    Calories
                  </div>
                  <div className="font-semibold">{caloriesBurned} kcal</div>
                </div>
              )}
            </div>
          )}

          {hasExercises && !isExecutionMode && (
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="text-muted-foreground text-xs mb-2 flex items-center gap-2">
                <Dumbbell className="w-3 h-3" />
                Exercises
              </div>
              <div className="space-y-2">
                {(workout.exercises as Array<{name: string; sets?: number | string; reps?: number | string; weight?: number | string}>).map((exercise, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="font-medium">{exercise.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {exercise.sets && `${exercise.sets} sets`}
                      {exercise.reps && ` × ${exercise.reps}`}
                      {exercise.weight && ` @ ${exercise.weight}kg`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isExecutionMode && sets.length > 0 && (
            <div className="space-y-3">
              {sets.map((set, idx) => {
                const isNewExercise = idx === 0 || sets[idx - 1].exerciseName !== set.exerciseName;
                return (
                  <div key={idx}>
                    {isNewExercise && (
                      <div className="text-sm font-semibold text-primary mt-4 mb-2 first:mt-0">
                        {set.exerciseName}
                      </div>
                    )}
                    <div className={`bg-gray-900 p-3 rounded-lg ${set.completed ? 'opacity-60 border border-green-500/30' : 'border border-white/5'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Set {set.setIndex + 1}</span>
                        {set.completed && (
                          <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Done
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
                          <input
                            type="number"
                            value={set.actualWeight}
                            onChange={(e) => updateSet(idx, 'actualWeight', e.target.value)}
                            disabled={set.completed}
                            className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white disabled:opacity-50"
                            placeholder="0"
                            data-testid={`input-weight-${idx}`}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
                          <input
                            type="text"
                            value={set.actualReps}
                            onChange={(e) => updateSet(idx, 'actualReps', e.target.value)}
                            disabled={set.completed}
                            className="w-full bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white disabled:opacity-50"
                            placeholder="10"
                            data-testid={`input-reps-${idx}`}
                          />
                        </div>
                        <div className="pt-5">
                          {set.completed ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => undoSet(idx)}
                              className="text-muted-foreground hover:text-white"
                              data-testid={`button-undo-set-${idx}`}
                            >
                              Undo
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90"
                              onClick={() => completeSet(idx)}
                              data-testid={`button-complete-set-${idx}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {workout.notes && (
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="text-muted-foreground text-xs mb-1">Notes</div>
              <div className="text-sm">{workout.notes}</div>
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {!isExecutionMode && workout.status !== 'completed' && hasExercises && (
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => onStartGuidedFlowWithWarmup(workout)}
                data-testid="button-start-workout-warmup"
              >
                <Play className="w-4 h-4 mr-2" />
                Start with Warmup Sets
              </Button>
              <Button
                className="w-full sm:w-auto gradient-primary"
                onClick={() => onStartGuidedFlow(workout)}
                data-testid="button-start-workout"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Workout
              </Button>
            </div>
          )}
          {isExecutionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExecutionMode(false)}
                data-testid="button-back-to-view"
              >
                Back
              </Button>
              <Button
                className={`gradient-primary ${!allSetsCompleted ? 'opacity-50' : ''}`}
                onClick={handleFinishWorkout}
                disabled={!allSetsCompleted}
                data-testid="button-finish-workout"
              >
                <Check className="w-4 h-4 mr-2" />
                Finish Workout
              </Button>
            </>
          )}
          {!isExecutionMode && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(workout.id)}
                data-testid="button-delete-workout"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              {workout.status !== 'completed' && !hasExercises && (
                <Button
                  className="gradient-primary"
                  onClick={() => onComplete(workout, [])}
                  data-testid="button-complete-workout"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

