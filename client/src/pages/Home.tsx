import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, startOfWeek, endOfWeek, isToday, subDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  ChevronRight,
  ChevronLeft,
  Calendar,
  BarChart3,
  Plus,
  Footprints,
  Flame,
  Timer,
  MapPin,
  Sparkles,
  BedDouble,
  Watch,
  Pencil,
  MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";
import { useUser, fetchWithRetry } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";


interface ScheduledWorkout {
  id: string;
  date: string;
  scheduledDate: string;
  workoutName: string;
  title: string;
  intensity: string | null;
  status: 'scheduled' | 'completed' | 'skipped';
  duration?: number;
}

interface DailyActivity {
  id: string;
  date: string;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance?: number;
  sleepMinutes?: number | null;
  sleepEfficiency?: number | null;
  sleepStages?: { deep?: number; light?: number; rem?: number; awake?: number } | null;
  sleepSource?: 'wearable' | 'manual' | null;
  hrvScore?: number;
  restingHeartRate?: number;
}

function formatSleepDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "--";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function SleepCard({ 
  sleepMinutes, 
  sleepSource, 
  sleepEfficiency,
  date,
  onManualSave 
}: { 
  sleepMinutes: number | null | undefined; 
  sleepSource: 'wearable' | 'manual' | null | undefined;
  sleepEfficiency: number | null | undefined;
  date: string;
  onManualSave: (hours: number, minutes: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputHours, setInputHours] = useState("");
  const [inputMinutes, setInputMinutes] = useState("");
  
  const hasSleep = sleepMinutes && sleepMinutes > 0;
  const displayValue = formatSleepDuration(sleepMinutes);
  
  const handleSubmit = () => {
    const hours = parseInt(inputHours) || 0;
    const mins = parseInt(inputMinutes) || 0;
    if (hours > 0 || mins > 0) {
      onManualSave(hours, mins);
      setIsOpen(false);
      setInputHours("");
      setInputMinutes("");
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
        <div className="relative">
          <div className="p-2 rounded-lg bg-muted/30">
            <BedDouble className="w-5 h-5 text-foreground" />
          </div>
          {sleepSource === 'wearable' && (
            <Watch className="w-3 h-3 absolute -top-1 -right-1 text-blue-400" />
          )}
          {sleepSource === 'manual' && (
            <Pencil className="w-3 h-3 absolute -top-1 -right-1 text-green-400" />
          )}
          {!sleepSource && (
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-foreground leading-tight" data-testid="text-sleep-value">
              {displayValue}
            </p>
            {hasSleep && sleepEfficiency && sleepEfficiency > 0 && (
              <span className="text-xs text-muted-foreground">({sleepEfficiency}%)</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sleep
            {sleepSource && <span className="ml-1 opacity-70">• {sleepSource === 'wearable' ? 'Watch' : 'Manual'}</span>}
          </p>
        </div>
        <DialogTrigger asChild>
          <button 
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            data-testid="button-edit-sleep"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        </DialogTrigger>
      </div>
      
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>Log Sleep</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="sleep-hours" className="text-xs text-muted-foreground">Hours</Label>
              <Input
                id="sleep-hours"
                type="number"
                min="0"
                max="24"
                placeholder="0"
                value={inputHours}
                onChange={(e) => setInputHours(e.target.value)}
                data-testid="input-sleep-hours"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="sleep-minutes" className="text-xs text-muted-foreground">Minutes</Label>
              <Input
                id="sleep-minutes"
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={inputMinutes}
                onChange={(e) => setInputMinutes(e.target.value)}
                data-testid="input-sleep-minutes"
              />
            </div>
          </div>
          {hasSleep && sleepSource === 'wearable' && (
            <p className="text-xs text-muted-foreground">
              This will override smartwatch data ({displayValue}).
            </p>
          )}
          <Button 
            onClick={handleSubmit} 
            className="w-full"
            data-testid="button-save-sleep"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotMetric({ 
  icon: Icon, 
  value, 
  label,
  accentColor = "text-amber-400"
}: { 
  icon: React.ElementType; 
  value: string | number; 
  label: string;
  accentColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
      <div className="relative">
        <div className="p-2 rounded-lg bg-muted/30">
          <Icon className="w-5 h-5 text-foreground" />
        </div>
        <Sparkles className={cn("w-3 h-3 absolute -top-1 -right-1", accentColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DayNavigator({ 
  selectedDate, 
  onDateChange 
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
}) {
  const dayName = format(selectedDate, "EEEE");
  const fullDate = format(selectedDate, "d MMMM yyyy");
  const isTodaySelected = isToday(selectedDate);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onDateChange(subDays(selectedDate, 1))}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors"
          data-testid="button-prev-day"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="text-center min-w-[140px]">
          <p className="text-lg font-semibold text-foreground" data-testid="text-selected-day">
            {isTodaySelected ? "Today" : dayName}
          </p>
        </div>
        <button
          onClick={() => onDateChange(addDays(selectedDate, 1))}
          className="p-2 rounded-full hover:bg-muted/50 transition-colors"
          data-testid="button-next-day"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="text-selected-date">
        {fullDate}
      </p>
      {!isTodaySelected && (
        <button
          onClick={() => onDateChange(new Date())}
          className="text-xs text-primary hover:underline mt-1"
          data-testid="button-back-to-today"
        >
          Back to today
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const { data: user } = useUser();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd");
  
  useEffect(() => {
    analytics.trackPageView('home');
  }, []);

  const { data: scheduledWorkouts } = useQuery<ScheduledWorkout[]>({
    queryKey: ['/api/scheduled-workouts/week', weekStart, weekEnd],
    queryFn: async () => {
      try {
        return await fetchWithRetry<ScheduledWorkout[]>(`/api/scheduled-workouts?start=${weekStart}&end=${weekEnd}`);
      } catch (error) {
        return [];
      }
    },
  });

  const { data: selectedDayActivity } = useQuery<DailyActivity>({
    queryKey: ['/api/activity/date', selectedDateStr],
    queryFn: async () => {
      try {
        return await fetchWithRetry<DailyActivity>(`/api/activity/${selectedDateStr}`);
      } catch (error) {
        return null as any;
      }
    },
  });
  
  const queryClient = useQueryClient();
  
  const saveSleepMutation = useMutation({
    mutationFn: async ({ date, sleepMinutes }: { date: string; sleepMinutes: number }) => {
      const response = await fetch('/api/activity/sleep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, sleepMinutes }),
      });
      if (!response.ok) throw new Error('Failed to save sleep');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/date', selectedDateStr] });
    },
  });
  
  const handleSaveSleep = (hours: number, minutes: number) => {
    const totalMinutes = hours * 60 + minutes;
    saveSleepMutation.mutate({ date: selectedDateStr, sleepMinutes: totalMinutes });
  };

  const isTodaySelected = isToday(selectedDate);
  
  const nextScheduledWorkout = scheduledWorkouts
    ?.filter(w => {
      const workoutDate = w.scheduledDate ? new Date(w.scheduledDate) : new Date(w.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return workoutDate >= today && w.status !== 'completed';
    })
    .sort((a, b) => {
      const dateA = a.scheduledDate ? new Date(a.scheduledDate) : new Date(a.date);
      const dateB = b.scheduledDate ? new Date(b.scheduledDate) : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    })[0];
  
  const firstName = user?.firstName || user?.username || "there";
  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';

  return (
    <div className="min-h-screen p-4 md:p-8 pb-28">
      <div className="max-w-lg mx-auto space-y-6">
        
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-sm text-muted-foreground">Good {greeting},</p>
          <h1 className="text-2xl font-display font-bold text-foreground capitalize" data-testid="greeting-name">
            {firstName}
          </h1>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <DayNavigator 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate} 
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isTodaySelected ? "Today's Snapshot" : `${format(selectedDate, "EEEE")}'s Snapshot`}
          </h2>
          
          <div className="grid grid-cols-2 gap-2">
            <SnapshotMetric
              icon={Footprints}
              value={(selectedDayActivity?.steps ?? 0).toLocaleString()}
              label="Steps"
              accentColor="text-amber-400"
            />
            <SnapshotMetric
              icon={Timer}
              value={selectedDayActivity?.activeMinutes ?? 0}
              label="Active mins"
              accentColor="text-amber-400"
            />
            <SnapshotMetric
              icon={Flame}
              value={(selectedDayActivity?.caloriesBurned ?? 0).toLocaleString()}
              label="Calories"
              accentColor="text-amber-400"
            />
            {(selectedDayActivity?.distance ?? 0) > 0 ? (
              <SnapshotMetric
                icon={MapPin}
                value={`${(selectedDayActivity?.distance ?? 0).toFixed(1)} km`}
                label="Distance"
                accentColor="text-amber-400"
              />
            ) : (
              <SnapshotMetric
                icon={MapPin}
                value="--"
                label="Distance"
                accentColor="text-amber-400"
              />
            )}
          </div>
          
          <div className="pt-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recovery</h3>
            <SleepCard
              sleepMinutes={selectedDayActivity?.sleepMinutes}
              sleepSource={selectedDayActivity?.sleepSource}
              sleepEfficiency={selectedDayActivity?.sleepEfficiency}
              date={selectedDateStr}
              onManualSave={handleSaveSleep}
            />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Trainer</h2>
          
          <Link href="/chat" data-testid="link-trainer">
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1">Ready when you are</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      Ask me about your workouts, nutrition, recovery, or anything fitness related.
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.section>

        {nextScheduledWorkout && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="space-y-3"
          >
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Scheduled Workout</h2>
            
            <Link href="/calendar">
              <Card className="border hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {nextScheduledWorkout.title || nextScheduledWorkout.workoutName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isToday(new Date(nextScheduledWorkout.scheduledDate || nextScheduledWorkout.date)) 
                            ? "Today" 
                            : format(new Date(nextScheduledWorkout.scheduledDate || nextScheduledWorkout.date), "EEEE, MMM d")}
                          {nextScheduledWorkout.duration && ` • ${nextScheduledWorkout.duration} min`}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          
          <div className="grid grid-cols-3 gap-2">
            <Link href="/calendar">
              <Card className="border hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Calendar className="w-5 h-5 text-muted-foreground mb-2" />
                  <span className="text-xs font-medium text-foreground">Calendar</span>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/tracker">
              <Card className="border hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Plus className="w-5 h-5 text-muted-foreground mb-2" />
                  <span className="text-xs font-medium text-foreground">Log Workout</span>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/progress">
              <Card className="border hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <BarChart3 className="w-5 h-5 text-muted-foreground mb-2" />
                  <span className="text-xs font-medium text-foreground">Progress</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
