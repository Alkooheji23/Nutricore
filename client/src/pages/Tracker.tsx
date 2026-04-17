import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { useWorkoutPersistence } from "@/hooks/use-workout-persistence";
import { useGuidedWorkout, type GuidedExercise } from "@/hooks/use-guided-workout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Trash2,
  Plus,
  Check,
  Loader2,
  CheckCircle2,
  Calendar,
  Sparkles,
  Flame,
  Target,
  Dumbbell,
  Footprints,
  Bike,
  Waves,
  Heart,
  Zap,
  Trophy,
  Play,
  Square,
  Timer,
  Watch,
  Activity,
  Link2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ChevronRight,
  Clock,
  MapPin
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useUser, fetchWithRetry } from "@/lib/api";
import { AdBanner } from "@/components/AdBanner";
import { RequiresPermission } from "@/components/RequiresPermission";
import { hasFullAccess } from "@shared/permissions";
import { RadialGauge, InsightBanner } from "@/components/ui/radial-gauge";
import { motion } from "framer-motion";
import { getActivityConfig, inferActivityType } from "@shared/activityTypes";

const getActivityIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    dumbbell: Dumbbell,
    footprints: Footprints,
    bike: Bike,
    waves: Waves,
    heart: Heart,
    zap: Zap,
    flame: Flame,
    trophy: Trophy,
    user: Target,
    shield: Target,
  };
  return icons[iconName] || Dumbbell;
};

type ActivityTemplate = {
  activityType: string;
  name: string;
  exercises?: Array<{ name: string; sets?: number; reps?: number; weight?: number; completed: boolean }>;
};

const activityTemplates: ActivityTemplate[] = [
  {
    activityType: "strength_training",
    name: "Strength Training",
    exercises: [
      { name: "Squats", sets: 4, reps: 10, weight: 0, completed: false },
      { name: "Bench Press", sets: 4, reps: 8, weight: 0, completed: false },
      { name: "Rows", sets: 3, reps: 12, weight: 0, completed: false },
      { name: "Shoulder Press", sets: 3, reps: 10, weight: 0, completed: false },
      { name: "Deadlift", sets: 3, reps: 8, weight: 0, completed: false },
    ],
  },
  {
    activityType: "running",
    name: "Running",
  },
];

type WorkoutExercise = {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  completed: boolean;
};

type WorkoutLog = {
  id: string;
  workoutName: string;
  activityType?: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  distance?: number;
  exercises: WorkoutExercise[];
  completed: boolean;
  notes?: string;
  source?: string;
  // Fields from manual logs with wearable background metrics
  wearableHeartRateAvg?: number;
  wearableHeartRateMax?: number;
  // Legacy heart rate fields (for backwards compatibility)
  averageHeartRate?: number;
  maxHeartRate?: number;
  // Fields from wearable activities (prefixed with _ in API response)
  _avgPace?: number;
  _elevationGain?: number;
  _isWearableActivity?: boolean;
};

const getHeartRateAvg = (log: WorkoutLog): number | undefined => {
  return log.wearableHeartRateAvg || log.averageHeartRate;
};

const getHeartRateMax = (log: WorkoutLog): number | undefined => {
  return log.wearableHeartRateMax || log.maxHeartRate;
};

const formatDuration = (minutes: number): string => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}:00`;
};

const formatPace = (paceMinPerKm: number): string => {
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
};

const getActivityColor = (activityType?: string): string => {
  const colors: Record<string, string> = {
    running: 'bg-emerald-500',
    walking: 'bg-emerald-500',
    cycling: 'bg-blue-500',
    swimming: 'bg-cyan-500',
    strength_training: 'bg-amber-500',
    yoga: 'bg-purple-500',
    hiit: 'bg-red-500',
    sports: 'bg-orange-500',
  };
  return colors[activityType || ''] || 'bg-primary';
};

export default function Tracker() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useUser();
  
  // Track page view
  useEffect(() => {
    analytics.trackPageView('tracker');
  }, []);

  const {
    workoutState,
    updateWorkout,
    startSession,
    endSession,
    getElapsedMinutes,
    clearWorkout,
    hasActiveWorkout,
    isRestored,
    isSessionActive,
  } = useWorkoutPersistence();

  const { startWorkout: startGuidedWorkout, isActive: hasActiveGuidedWorkout } = useGuidedWorkout();

  const [newExercise, setNewExercise] = useState({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
  const [displayedElapsedTime, setDisplayedElapsedTime] = useState(0);
  
  useEffect(() => {
    if (isSessionActive) {
      const interval = setInterval(() => {
        setDisplayedElapsedTime(getElapsedMinutes());
      }, 1000);
      setDisplayedElapsedTime(getElapsedMinutes());
      return () => clearInterval(interval);
    } else if (workoutState.finalElapsedMinutes > 0) {
      setDisplayedElapsedTime(workoutState.finalElapsedMinutes);
    }
  }, [isSessionActive, getElapsedMinutes, workoutState.finalElapsedMinutes]);

  useEffect(() => {
    if (isRestored && hasActiveWorkout) {
      toast({ 
        title: "Workout Restored", 
        description: `Your ${workoutState.workoutName || 'workout'} has been restored.` 
      });
    }
  }, [isRestored]);
  
  const activeActivityConfig = workoutState.activityType ? getActivityConfig(workoutState.activityType) : null;

  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [activityView, setActivityView] = useState<'daily' | 'weekly' | 'yearly'>('daily');

  const getDateRange = (view: 'daily' | 'weekly' | 'yearly') => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (view) {
      case 'daily':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        break;
      case 'weekly':
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
    }
    return { startDate, endDate };
  };

  const { data: workoutLogs = [] } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs", activityView],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(activityView);
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeWearable: 'true',
      });
      return fetchWithRetry<WorkoutLog[]>(`/api/workout-logs?${params}`);
    },
  });

  // Device activity data (Fitbit/Garmin) - trusted source of truth
  const { data: deviceActivity } = useQuery<{
    steps: number;
    caloriesBurned: number;
    activeMinutes: number;
    distance: number;
    restingHeartRate?: number;
    averageHeartRate?: number;
    maxHeartRate?: number;
    source?: string;
  } | null>({
    queryKey: ["/api/activity/today"],
    queryFn: async () => {
      try {
        const data = await fetchWithRetry<any>("/api/activity/today");
        // Return null only if no data at all, not based on metric values
        return data && Object.keys(data).length > 0 ? data : null;
      } catch (error) {
        return null;
      }
    },
  });

  // Device data is the source of truth when synced from a device (Fitbit)
  // Check source field, not metric values - zero values on early mornings are still authoritative
  const hasDeviceData = deviceActivity?.source === 'fitbit' || deviceActivity?.source === 'garmin' || (deviceActivity && deviceActivity.source !== undefined);

  // Device integration state
  const [showDeviceSection, setShowDeviceSection] = useState(false);

  // Fitbit status query
  const { data: fitbitStatus, isLoading: fitbitLoading } = useQuery<{ connected: boolean; lastSyncAt?: string }>({
    queryKey: ['/api/fitbit/status'],
    queryFn: async () => {
      try {
        return await fetchWithRetry<{ connected: boolean; lastSyncAt?: string }>('/api/fitbit/status');
      } catch (error) {
        return { connected: false };
      }
    },
  });

  // Garmin status query
  const { data: garminStatus, isLoading: garminLoading } = useQuery<{ connected: boolean; lastSyncAt?: string }>({
    queryKey: ['/api/garmin/status'],
    queryFn: async () => {
      try {
        return await fetchWithRetry<{ connected: boolean; lastSyncAt?: string }>('/api/garmin/status');
      } catch (error) {
        return { connected: false };
      }
    },
  });

  // Connect Fitbit mutation
  const connectFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fitbit/auth-url', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get authorization URL');
      const { url } = await res.json();
      window.location.href = url;
    },
    onError: () => {
      toast({ title: "Connection failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Connect Garmin mutation with retry for PWA session timing
  const connectGarminMutation = useMutation({
    mutationFn: async () => {
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const res = await fetch('/api/garmin/auth-url', { credentials: 'include' });
        if (res.ok) {
          const { url } = await res.json();
          window.location.href = url;
          return;
        }
        
        if (res.status === 503) {
          throw new Error('Garmin integration is being configured. Please try again later.');
        }
        
        if (res.status === 401 && attempt < maxRetries - 1) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          continue;
        }
        
        try {
          const data = await res.json();
          lastError = new Error(data.message || 'Failed to connect');
        } catch {
          lastError = new Error('Failed to connect to Garmin');
        }
      }
      
      throw lastError || new Error('Failed to connect to Garmin');
    },
    onError: (error: any) => {
      toast({ title: "Garmin Connection Issue", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  // Sync Fitbit mutation
  const syncFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fitbit/sync', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fitbit/status'] });
      toast({ title: "Synced successfully!" });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Sync Garmin mutation
  const syncGarminMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/garmin/sync', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/garmin/status'] });
      toast({ title: "Synced successfully!" });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const resetWorkoutForm = useCallback(() => {
    clearWorkout();
    setNewExercise({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
    setDisplayedElapsedTime(0);
  }, [clearWorkout]);
  
  const handleStartSession = useCallback(() => {
    startSession();
    toast({ title: "Session started!", description: "Timer is running..." });
  }, [startSession, toast]);
  
  const handleEndSession = useCallback(() => {
    const elapsed = getElapsedMinutes();
    endSession();
    setDisplayedElapsedTime(elapsed);
    toast({ title: "Session ended!", description: `Duration: ${elapsed} minutes` });
  }, [endSession, getElapsedMinutes, toast]);
  
  const loadActivityTemplate = useCallback((template: ActivityTemplate) => {
    const config = getActivityConfig(template.activityType);
    updateWorkout({
      workoutName: template.name,
      activityType: template.activityType,
      exercises: template.exercises?.map(ex => ({ 
        name: ex.name, 
        sets: ex.sets || 0, 
        reps: ex.reps || 0, 
        weight: ex.weight, 
        completed: false 
      })) || [],
      notes: "",
      distance: 0,
      manualDuration: 0,
    });
    toast({ title: "Activity selected!", description: `${template.name} ready to log` });
  }, [updateWorkout, toast]);

  const createWorkoutLog = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workout-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Activity logged!", description: "Great work on your training!" });
      resetWorkoutForm();
    },
  });

  const deleteWorkoutLog = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workout-logs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Activity deleted" });
    },
  });

  const hasAccess = hasFullAccess(user);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">Full Access Required</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          The Daily Tracker is available with an active account. Sign up to get started.
        </p>
        <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={() => window.location.href = '/profile'}
          >
            Get Started
          </Button>
      </div>
    );
  }

  const addExercise = () => {
    if (!newExercise.name) return;
    updateWorkout({
      exercises: [...workoutState.exercises, { ...newExercise }],
    });
    setNewExercise({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
  };

  const toggleExerciseComplete = (index: number) => {
    updateWorkout({
      exercises: workoutState.exercises.map((ex, i) => 
        i === index ? { ...ex, completed: !ex.completed } : ex
      ),
    });
  };

  const removeExercise = (index: number) => {
    updateWorkout({
      exercises: workoutState.exercises.filter((_, i) => i !== index),
    });
  };

  const handleLogWorkout = () => {
    if (!workoutState.workoutName) {
      toast({ title: "Please select an activity type", variant: "destructive" });
      return;
    }
    // Priority: manual duration > displayed elapsed > final elapsed (from ended session) > live calculation
    const timerDuration = displayedElapsedTime || workoutState.finalElapsedMinutes || getElapsedMinutes();
    const duration = workoutState.manualDuration > 0 ? workoutState.manualDuration : timerDuration;
    createWorkoutLog.mutate({
      workoutName: workoutState.workoutName,
      activityType: workoutState.activityType,
      duration: duration,
      caloriesBurned: 0,
      exercises: workoutState.exercises,
      notes: workoutState.notes,
      distance: workoutState.distance,
      completed: workoutState.exercises.length === 0 || workoutState.exercises.every(ex => ex.completed),
    });
  };

  // workoutLogs now includes both manual logs and wearable activities from Garmin/Fitbit
  const todayWorkouts = workoutLogs;
  
  // Device data is the trusted source of truth for calories burned
  // Fall back to manual workout logs only if no device data
  const manualCaloriesBurned = todayWorkouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
  const totalCaloriesBurned = hasDeviceData ? deviceActivity.caloriesBurned : manualCaloriesBurned;
  const totalSteps = hasDeviceData ? deviceActivity.steps : 0;
  const totalActiveMinutes = hasDeviceData ? deviceActivity.activeMinutes : 0;
  const totalDistance = hasDeviceData ? deviceActivity.distance : 0;

  return (
    <RequiresPermission user={user} feature="canAccessTracking">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Daily Tracker</h1>
            <p className="text-sm text-muted-foreground">Log your workouts and track activity</p>
          </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-white/5">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-xs md:text-sm font-medium">{format(new Date(), "EEE, MMM dd")}</span>
        </div>
      </motion.div>

      {/* Activity Summary Gauges */}
      <motion.div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border border-white/5 p-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative grid grid-cols-3 gap-4 md:gap-8">
          <RadialGauge
            value={totalCaloriesBurned}
            max={Math.max(500, totalCaloriesBurned)}
            label="Burned"
            sublabel="kcal"
            size="md"
            colorScheme="auto"
          />
          <RadialGauge
            value={totalActiveMinutes}
            max={Math.max(60, totalActiveMinutes)}
            label="Active"
            sublabel="min"
            size="md"
            colorScheme="primary"
          />
          <RadialGauge
            value={todayWorkouts.length}
            max={Math.max(2, todayWorkouts.length)}
            label="Activities"
            sublabel="Today"
            size="md"
            showPercentage={false}
            colorScheme={todayWorkouts.length > 0 ? "green" : "red"}
          />
        </div>
        
        {/* Insight Banner */}
        {todayWorkouts.length === 0 && !hasDeviceData && (
          <motion.div 
            className="mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <InsightBanner
              icon={<Target className="w-4 h-4" />}
              title="Get Moving"
              description="No workouts logged yet. Start your first workout or connect a device!"
              variant="warning"
            />
          </motion.div>
        )}
        {todayWorkouts.length > 0 && (
          <motion.div 
            className="mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <InsightBanner
              icon={<CheckCircle2 className="w-4 h-4" />}
              title="Great Progress!"
              description={`You've completed ${todayWorkouts.length} workout${todayWorkouts.length > 1 ? 's' : ''} today. Keep it up!`}
              variant="success"
            />
          </motion.div>
        )}
      </motion.div>

      {/* Device Integration Section */}
      <motion.div 
        className="rounded-xl border border-white/10 bg-card/50 overflow-hidden"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => setShowDeviceSection(!showDeviceSection)}
          className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          data-testid="button-toggle-devices"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${hasDeviceData ? 'bg-emerald-500/20' : 'bg-primary/20'}`}>
              <Smartphone className={`w-4 h-4 ${hasDeviceData ? 'text-emerald-400' : 'text-primary'}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">
                {hasDeviceData ? `Synced from ${deviceActivity?.source === 'garmin' ? 'Garmin' : 'Fitbit'}` : 'Connect a Device'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasDeviceData ? 'Device data is source of truth' : 'Sync steps, calories & more'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasDeviceData && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Connected</Badge>
            )}
            {showDeviceSection ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {showDeviceSection && (
          <div className="p-3 pt-0 space-y-3 border-t border-white/5">
            {/* Fitbit */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Watch className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Fitbit</p>
                  <p className="text-xs text-muted-foreground">
                    {fitbitStatus?.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {fitbitLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : fitbitStatus?.connected ? (
                <Button
                  size="sm"
                  onClick={() => syncFitbitMutation.mutate()}
                  disabled={syncFitbitMutation.isPending}
                  className="bg-cyan-600 hover:bg-cyan-700 h-8"
                  data-testid="button-sync-fitbit"
                >
                  {syncFitbitMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span className="ml-1 text-xs">Sync</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectFitbitMutation.mutate()}
                  disabled={connectFitbitMutation.isPending}
                  className="bg-cyan-600 hover:bg-cyan-700 h-8"
                  data-testid="button-connect-fitbit"
                >
                  {connectFitbitMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  <span className="ml-1 text-xs">Connect</span>
                </Button>
              )}
            </div>

            {/* Garmin */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Watch className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Garmin</p>
                  <p className="text-xs text-muted-foreground">
                    {garminStatus?.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {garminLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-green-400" />
              ) : garminStatus?.connected ? (
                <Button
                  size="sm"
                  onClick={() => syncGarminMutation.mutate()}
                  disabled={syncGarminMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 h-8"
                  data-testid="button-sync-garmin"
                >
                  {syncGarminMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span className="ml-1 text-xs">Sync</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectGarminMutation.mutate()}
                  disabled={connectGarminMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 h-8"
                  data-testid="button-connect-garmin"
                >
                  {connectGarminMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  <span className="ml-1 text-xs">Connect</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <motion.div 
          className={`flex flex-col items-center p-3 rounded-xl border ${hasDeviceData ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card/50 border-white/5'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Flame className="w-4 h-4 text-orange-400" />
            {hasDeviceData && <Watch className="w-3 h-3 text-orange-400/60" />}
          </div>
          <span className="text-lg font-bold">{totalCaloriesBurned}</span>
          <span className="text-[10px] text-muted-foreground">Burned</span>
        </motion.div>
        <motion.div 
          className={`flex flex-col items-center p-3 rounded-xl border ${hasDeviceData ? 'bg-blue-500/5 border-blue-500/20' : 'bg-card/50 border-white/5'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Footprints className="w-4 h-4 text-blue-400" />
            {hasDeviceData && <Watch className="w-3 h-3 text-blue-400/60" />}
          </div>
          <span className="text-lg font-bold">{totalSteps.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">Steps</span>
        </motion.div>
        <motion.div 
          className={`flex flex-col items-center p-3 rounded-xl border ${hasDeviceData ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card/50 border-white/5'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Activity className="w-4 h-4 text-amber-400" />
            {hasDeviceData && <Watch className="w-3 h-3 text-amber-400/60" />}
          </div>
          <span className="text-lg font-bold">{totalActiveMinutes}</span>
          <span className="text-[10px] text-muted-foreground">Active Min</span>
        </motion.div>
        <motion.div 
          className="flex flex-col items-center p-3 rounded-xl bg-card/50 border border-white/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Dumbbell className="w-4 h-4 text-primary mb-1" />
          <span className="text-lg font-bold">{todayWorkouts.length}</span>
          <span className="text-[10px] text-muted-foreground">Activities</span>
        </motion.div>
      </div>

      {/* Additional Device Metrics - Distance & Heart Rate */}
      {hasDeviceData && (
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <motion.div 
            className="flex flex-col items-center p-3 rounded-xl bg-purple-500/5 border border-purple-500/20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-1 mb-1">
              <Footprints className="w-4 h-4 text-purple-400" />
              <Watch className="w-3 h-3 text-purple-400/60" />
            </div>
            <span className="text-lg font-bold">{totalDistance?.toFixed(1) || '0'}</span>
            <span className="text-[10px] text-muted-foreground">Distance (km)</span>
          </motion.div>
          <motion.div 
            className="flex flex-col items-center p-3 rounded-xl bg-red-500/5 border border-red-500/20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="flex items-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-red-400" />
              <Watch className="w-3 h-3 text-red-400/60" />
            </div>
            <span className="text-lg font-bold">{deviceActivity?.restingHeartRate || '--'}</span>
            <span className="text-[10px] text-muted-foreground">Resting HR</span>
          </motion.div>
          <motion.div 
            className="flex flex-col items-center p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-rose-400" />
              <Watch className="w-3 h-3 text-rose-400/60" />
            </div>
            <span className="text-lg font-bold">{deviceActivity?.maxHeartRate || '--'}</span>
            <span className="text-[10px] text-muted-foreground">Max HR</span>
          </motion.div>
        </div>
      )}

      {/* Ad Banner / Pro Tips */}
      <AdBanner variant="inline" user={user} />

      {/* Main Content */}
      <div className="space-y-6">
        {/* Activities Section */}
        <Card className="card-premium bg-card/50 border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Log Activity
            </CardTitle>
            <CardDescription>Track your exercise sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="log">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 mb-4">
                <TabsTrigger value="log">Log New</TabsTrigger>
                <TabsTrigger value="history">Today's Log</TabsTrigger>
              </TabsList>

              <TabsContent value="log" className="space-y-4">
                {/* Activity Type Selection */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Choose Activity Type</p>
                  <div className="flex flex-wrap gap-2">
                    {activityTemplates.map((template) => {
                      const config = getActivityConfig(template.activityType);
                      const IconComponent = config ? getActivityIcon(config.icon) : Dumbbell;
                      const isSelected = workoutState.activityType === template.activityType;
                      return (
                        <Button
                          key={template.activityType}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => loadActivityTemplate(template)}
                          className={`text-xs h-8 ${isSelected ? "gradient-primary" : ""}`}
                          data-testid={`activity-${template.activityType}`}
                        >
                          <IconComponent className="w-3 h-3 mr-1" />
                          {template.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Session Timer */}
                {workoutState.activityType && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Session Timer</span>
                      </div>
                      <div className="text-lg font-mono font-bold text-primary">
                        {isSessionActive ? (
                          <span className="animate-pulse">{displayedElapsedTime} min</span>
                        ) : displayedElapsedTime > 0 ? (
                          `${displayedElapsedTime} min`
                        ) : (
                          "0 min"
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isSessionActive ? (
                        <Button 
                          onClick={handleStartSession} 
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          data-testid="button-start-session"
                        >
                          <Play className="w-4 h-4 mr-1" /> Start Session
                        </Button>
                      ) : (
                        <Button 
                          onClick={handleEndSession} 
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          data-testid="button-end-session"
                        >
                          <Square className="w-4 h-4 mr-1" /> End Session
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Duration and Distance for Endurance Activities */}
                {activeActivityConfig?.showDuration && !activeActivityConfig?.showSets && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Duration (min)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 30"
                        value={workoutState.manualDuration || ""}
                        onChange={(e) => updateWorkout({ manualDuration: parseInt(e.target.value) || 0 })}
                        className="bg-white/5 border-white/10"
                        data-testid="input-duration"
                      />
                    </div>
                    {activeActivityConfig?.showDistance && (
                      <div className="space-y-2">
                        <Label>Distance (km)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 5.0"
                          value={workoutState.distance || ""}
                          onChange={(e) => updateWorkout({ distance: parseFloat(e.target.value) || 0 })}
                          className="bg-white/5 border-white/10"
                          data-testid="input-distance"
                        />
                      </div>
                    )}
                  </div>
                )}
                {activeActivityConfig?.showDistance && activeActivityConfig?.showSets && (
                  <div className="space-y-2">
                    <Label>Distance (km)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g., 5.0"
                      value={workoutState.distance || ""}
                      onChange={(e) => updateWorkout({ distance: parseFloat(e.target.value) || 0 })}
                      className="bg-white/5 border-white/10"
                      data-testid="input-distance"
                    />
                  </div>
                )}

                {/* Add Exercise - Only for activities with sets/reps */}
                {activeActivityConfig?.showSets && (
                  <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                    <p className="text-sm font-medium">Add Exercise</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Exercise name"
                        value={newExercise.name}
                        onChange={(e) => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white/5 border-white/10 text-sm"
                        data-testid="input-exercise-name"
                      />
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="Sets"
                          value={newExercise.sets}
                          onChange={(e) => setNewExercise(prev => ({ ...prev, sets: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10 text-sm w-14"
                          data-testid="input-sets"
                        />
                        <Input
                          type="number"
                          placeholder="Reps"
                          value={newExercise.reps}
                          onChange={(e) => setNewExercise(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                          className="bg-white/5 border-white/10 text-sm w-14"
                          data-testid="input-reps"
                        />
                        {activeActivityConfig?.showWeight && (
                          <Input
                            type="number"
                            placeholder="lbs"
                            value={newExercise.weight || ""}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                            className="bg-white/5 border-white/10 text-sm w-14"
                            data-testid="input-weight"
                          />
                        )}
                      </div>
                    </div>
                    <Button onClick={addExercise} size="sm" variant="outline" className="w-full" data-testid="button-add-exercise">
                      <Plus className="w-4 h-4 mr-1" /> Add Exercise
                    </Button>
                  </div>
                )}

                {/* Exercise List - Only for activities with sets/reps */}
                {activeActivityConfig?.showSets && workoutState.exercises.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Exercises ({workoutState.exercises.filter(e => e.completed).length}/{workoutState.exercises.length} done)</p>
                    {workoutState.exercises.map((ex, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          ex.completed ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleExerciseComplete(index)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                              ex.completed ? "bg-emerald-500 text-white" : "bg-white/10"
                            }`}
                            data-testid={`button-toggle-exercise-${index}`}
                          >
                            {ex.completed && <Check className="w-4 h-4" />}
                          </button>
                          <div>
                            <p className={`font-medium text-sm ${ex.completed ? "line-through text-muted-foreground" : ""}`}>
                              {ex.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ex.sets > 0 && `${ex.sets} sets`}
                              {ex.reps > 0 && ` x ${ex.reps} reps`}
                              {ex.weight ? ` @ ${ex.weight} lbs` : ""}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => removeExercise(index)} className="text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <Button
                      onClick={() => {
                        const guidedExercises: GuidedExercise[] = workoutState.exercises.map(ex => ({
                          name: ex.name,
                          targetSets: ex.sets,
                          targetReps: ex.reps,
                          targetWeight: ex.weight || null,
                        }));
                        startGuidedWorkout(workoutState.workoutName, guidedExercises);
                        setLocation('/tracker/flow');
                      }}
                      className="w-full mt-3 bg-primary hover:bg-primary/90"
                      data-testid="button-start-guided-workout"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Guided Workout
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="How did the workout feel?"
                    value={workoutState.notes}
                    onChange={(e) => updateWorkout({ notes: e.target.value })}
                    className="bg-white/5 border-white/10 min-h-[60px]"
                    data-testid="input-workout-notes"
                  />
                </div>

                <Button
                  onClick={handleLogWorkout}
                  className="w-full gradient-primary text-white"
                  disabled={createWorkoutLog.isPending || !workoutState.activityType}
                  data-testid="button-save-workout"
                >
                  {createWorkoutLog.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Log {workoutState.workoutName || "Workout"}
                </Button>
              </TabsContent>

              <TabsContent value="history">
                {/* View Toggle */}
                <div className="flex items-center justify-center gap-1 p-1 mb-4 rounded-xl bg-white/5 border border-white/10">
                  <button
                    onClick={() => setActivityView('daily')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activityView === 'daily' 
                        ? 'bg-primary text-white' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="button-view-daily"
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setActivityView('weekly')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activityView === 'weekly' 
                        ? 'bg-primary text-white' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="button-view-weekly"
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setActivityView('yearly')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activityView === 'yearly' 
                        ? 'bg-primary text-white' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="button-view-yearly"
                  >
                    Yearly
                  </button>
                </div>
                
                {/* Date Range Indicator */}
                <div className="text-center text-sm text-muted-foreground mb-4" data-testid="text-date-range">
                  {activityView === 'daily' && format(new Date(), "EEEE, MMMM d, yyyy")}
                  {activityView === 'weekly' && (() => {
                    const { startDate, endDate } = getDateRange('weekly');
                    return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
                  })()}
                  {activityView === 'yearly' && format(new Date(), "yyyy")}
                </div>

                {/* Daily Activity Summary Card - Shows Garmin/Fitbit data even when no specific workouts */}
                {activityView === 'daily' && hasDeviceData && (totalSteps > 0 || totalCaloriesBurned > 0 || totalActiveMinutes > 0) && (
                  <div className="mb-4 p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Daily Activity</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Watch className="w-3 h-3" />
                          From {deviceActivity?.source || 'Device'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className="text-lg font-bold">{totalSteps.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Steps</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{totalCaloriesBurned}</p>
                        <p className="text-xs text-muted-foreground">Calories</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{totalDistance?.toFixed(1) || '0'}</p>
                        <p className="text-xs text-muted-foreground">km</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{totalActiveMinutes}</p>
                        <p className="text-xs text-muted-foreground">Active min</p>
                      </div>
                    </div>
                  </div>
                )}

                {todayWorkouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No workouts logged {activityView === 'daily' ? 'today' : activityView === 'weekly' ? 'this week' : 'this year'}</p>
                    <p className="text-sm">{hasDeviceData ? "Workouts from your device will appear here when synced" : "Start by logging your first workout!"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayWorkouts.map((log) => {
                      const effectiveActivityType = log.activityType || inferActivityType(log.workoutName);
                      const config = getActivityConfig(effectiveActivityType);
                      const isWearable = log.id.startsWith('wearable_');
                      const heartRateAvg = getHeartRateAvg(log);
                      
                      const getActivityLabel = (type: string) => {
                        const labels: Record<string, string> = {
                          running: 'Running',
                          walking: 'Walking',
                          cycling: 'Cycling',
                          swimming: 'Swimming',
                          strength_training: 'Strength',
                          yoga: 'Yoga',
                          hiit: 'HIIT',
                          sports: 'Sports',
                        };
                        return labels[type] || 'Activity';
                      };
                      
                      return (
                        <div 
                          key={log.id} 
                          className="p-4 rounded-2xl border border-white/10 bg-[#1A1A1A] hover:bg-[#222] transition-colors cursor-pointer group" 
                          data-testid={`workout-log-${log.id}`}
                          onClick={() => setSelectedWorkout(log)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground text-lg">{log.workoutName}</h3>
                              {log.source && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-600 text-white">
                                  {log.source}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 text-sm font-medium rounded-full border border-white/20 text-foreground">
                                {getActivityLabel(effectiveActivityType)}
                              </span>
                              {!isWearable && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWorkoutLog.mutate(log.id);
                                  }}
                                  className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Show exercises first for strength workouts */}
                          {(() => {
                            const activityTypeLower = (effectiveActivityType || '').toLowerCase();
                            const isStrength = activityTypeLower.includes('strength');
                            const exercises = log.exercises;
                            
                            if (isStrength && Array.isArray(exercises) && exercises.length > 0) {
                              const totalSets = exercises.reduce((sum: number, ex: any) => sum + (ex.sets || 0), 0);
                              return (
                                <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <Dumbbell className="w-4 h-4 text-amber-400" />
                                    <span className="text-sm">{exercises.length} exercises</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{totalSets} sets</span>
                                  </div>
                                  {log.duration > 0 && (
                                    <div className="flex items-center gap-1.5 opacity-70">
                                      <Clock className="w-4 h-4" />
                                      <span className="text-sm">{log.duration} min</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Non-strength or no exercises: show normal metrics
                            return (
                              <div className="flex items-center gap-4 text-muted-foreground mb-2">
                                {log.duration > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm">{log.duration} min</span>
                                  </div>
                                )}
                                {log.caloriesBurned > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm">{log.caloriesBurned} cal</span>
                                  </div>
                                )}
                                {log.distance && log.distance > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-sm">{log.distance.toFixed(2)} km</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {heartRateAvg && heartRateAvg > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Heart className="w-4 h-4 text-red-400" />
                              <span className="text-sm">{heartRateAvg} bpm</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>

      {/* My Trainer CTA */}
      <Card className="card-premium bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Need help with your fitness plan?</h3>
              <p className="text-sm text-muted-foreground">Chat with your trainer for personalized advice and guidance.</p>
            </div>
            <Button 
              className="gradient-primary text-white premium-glow" 
              data-testid="button-chat-with-trainer"
              onClick={() => window.location.href = '/chat'}
            >
              Chat with Trainer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workout Detail Modal */}
      <Dialog open={!!selectedWorkout} onOpenChange={(open) => !open && setSelectedWorkout(null)}>
        <DialogContent className="bg-[#0D0D0D] border-white/10 max-w-md">
          {selectedWorkout && (() => {
            const effectiveActivityType = selectedWorkout.activityType || inferActivityType(selectedWorkout.workoutName);
            const config = getActivityConfig(effectiveActivityType);
            const IconComponent = config ? getActivityIcon(config.icon) : Dumbbell;
            const activityColor = getActivityColor(effectiveActivityType);
            const isEndurance = config?.showDistance;
            const totalSets = selectedWorkout.exercises?.reduce((sum, ex) => sum + (ex.sets || 0), 0) || 0;
            const workoutDate = new Date(selectedWorkout.date);
            
            return (
              <>
                <DialogHeader className="border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg font-semibold">{config?.name || selectedWorkout.workoutName}</DialogTitle>
                    {selectedWorkout.source && (
                      <Badge variant="outline" className="text-xs">
                        <Watch className="w-3 h-3 mr-1" />
                        {selectedWorkout.source}
                      </Badge>
                    )}
                  </div>
                </DialogHeader>
                
                <div className="space-y-6 py-2">
                  {/* Activity header with icon */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${activityColor} flex items-center justify-center`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {format(workoutDate, 'd MMM')} @ {format(workoutDate, 'HH:mm')}
                      </p>
                      <p className="font-semibold text-lg">{selectedWorkout.workoutName}</p>
                    </div>
                  </div>
                  
                  {/* Primary Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5">
                      <p className="text-3xl font-bold">{formatDuration(selectedWorkout.duration)}</p>
                      <p className="text-sm text-muted-foreground">Total Time</p>
                    </div>
                    
                    {isEndurance && selectedWorkout.distance && selectedWorkout.distance > 0 ? (
                      <div className="p-4 rounded-xl bg-white/5">
                        <p className="text-3xl font-bold">{selectedWorkout.distance.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Distance (km)</p>
                      </div>
                    ) : selectedWorkout.caloriesBurned > 0 ? (
                      <div className="p-4 rounded-xl bg-white/5">
                        <p className="text-3xl font-bold">{selectedWorkout.caloriesBurned}</p>
                        <p className="text-sm text-muted-foreground">Total Calories</p>
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Heart rate info if available */}
                  {(getHeartRateAvg(selectedWorkout) || getHeartRateMax(selectedWorkout)) && (
                    <div className="grid grid-cols-2 gap-4">
                      {getHeartRateAvg(selectedWorkout) && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                          <Heart className="w-5 h-5 text-red-400" />
                          <div>
                            <p className="text-xl font-bold">{getHeartRateAvg(selectedWorkout)} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
                            <p className="text-xs text-muted-foreground">Avg Heart Rate</p>
                          </div>
                        </div>
                      )}
                      {getHeartRateMax(selectedWorkout) && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                          <Heart className="w-5 h-5 text-orange-400" />
                          <div>
                            <p className="text-xl font-bold">{getHeartRateMax(selectedWorkout)} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
                            <p className="text-xs text-muted-foreground">Max Heart Rate</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Pace for endurance activities */}
                  {isEndurance && selectedWorkout._avgPace && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Timer className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-xl font-bold">{formatPace(selectedWorkout._avgPace)}</p>
                        <p className="text-xs text-muted-foreground">Average Pace</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Exercise breakdown for strength training */}
                  {selectedWorkout.exercises && selectedWorkout.exercises.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Exercises</p>
                        <p className="text-sm text-muted-foreground">{selectedWorkout.exercises.length} exercises • {totalSets} sets</p>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedWorkout.exercises.map((exercise, index) => (
                          <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                              <p className="font-medium">{exercise.name}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {exercise.sets > 0 && `${exercise.sets} x `}
                              {exercise.reps > 0 && `${exercise.reps}`}
                              {exercise.weight && exercise.weight > 0 && ` @ ${exercise.weight} kg`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Notes if available */}
                  {selectedWorkout.notes && (
                    <div className="p-3 rounded-xl bg-white/5">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{selectedWorkout.notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </RequiresPermission>
  );
}
