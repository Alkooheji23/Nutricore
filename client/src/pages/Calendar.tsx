import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Dumbbell, Utensils, Moon, Activity, Heart, Footprints, Clock, Flame, MapPin } from "lucide-react";
import { analytics } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";

interface WorkoutLog {
  id: string;
  date: string;
  workoutName: string;
  duration: number | null;
  caloriesBurned: number | null;
  exercises: any;
  completed: boolean;
  source?: string;
  distance?: number | null;
  activityType?: string;
  wearableHeartRateAvg?: number | null;
}

interface FoodEntry {
  id: string;
  date: string;
  mealType: string;
  foodName: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}

interface DailyActivityData {
  id: string;
  date: string;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number | null;
  floors: number | null;
  restingHeartRate: number | null;
  sleepMinutes: number | null;
  sleepEfficiency: number | null;
  activities: Array<{ type: string; duration: number; intensity: string; caloriesBurned: number }> | null;
}

interface ScheduledActivity {
  id: string;
  scheduledDate: string;
  title: string;
  workoutType: string;
  duration: number | null;
  intensity: string | null;
  status: string;
}

interface DayActivity {
  date: string;
  workouts: WorkoutLog[];
  scheduledActivities: ScheduledActivity[];
  meals: FoodEntry[];
  dailyActivity: DailyActivityData | null;
  hasActivity: boolean;
  hasScheduled: boolean;
  activityType: "training" | "nutrition" | "mixed" | "rest";
}

function useCalendarData(year: number, month: number) {
  const startDate = format(new Date(year, month, 1), "yyyy-MM-dd");
  const endDate = format(new Date(year, month + 1, 0), "yyyy-MM-dd");

  const workoutsQuery = useQuery<WorkoutLog[]>({
    queryKey: ["/api/calendar/workouts", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/workout-logs?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const mealsQuery = useQuery<FoodEntry[]>({
    queryKey: ["/api/calendar/meals", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/food-entries?start=${startDate}&end=${endDate}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activityQuery = useQuery<DailyActivityData[]>({
    queryKey: ["/api/calendar/activity", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/activity/range?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const scheduledQuery = useQuery<ScheduledActivity[]>({
    queryKey: ["/api/calendar/scheduled", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/scheduled-workouts?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  return {
    workouts: workoutsQuery.data || [],
    meals: mealsQuery.data || [],
    dailyActivities: activityQuery.data || [],
    scheduledActivities: scheduledQuery.data || [],
    isLoading: workoutsQuery.isLoading || mealsQuery.isLoading || activityQuery.isLoading || scheduledQuery.isLoading,
  };
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
  // Track page view
  useEffect(() => {
    analytics.trackPageView('calendar');
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { workouts, meals, dailyActivities, scheduledActivities, isLoading } = useCalendarData(year, month);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();

  const dayActivities = useMemo(() => {
    const activities: Record<string, DayActivity> = {};

    daysInMonth.forEach((day) => {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayWorkouts = workouts.filter((w) => w.date.startsWith(dateKey));
      const dayMeals = meals.filter((m) => m.date.startsWith(dateKey));
      const dayActivity = dailyActivities.find((a) => a.date === dateKey) || null;
      const dayScheduled = scheduledActivities.filter((s) => s.scheduledDate.startsWith(dateKey) && s.status === 'scheduled');

      // Combine logged activities with synced device activities
      const hasDeviceActivity = dayActivity && (dayActivity.steps > 0 || dayActivity.activeMinutes > 0);
      const hasWorkouts = dayWorkouts.length > 0 || (dayActivity?.activities && dayActivity.activities.length > 0);
      const hasMeals = dayMeals.length > 0;
      const hasScheduled = dayScheduled.length > 0;

      let activityType: DayActivity["activityType"] = "rest";
      if ((hasWorkouts || hasDeviceActivity) && hasMeals) {
        activityType = "mixed";
      } else if (hasWorkouts || hasDeviceActivity) {
        activityType = "training";
      } else if (hasMeals) {
        activityType = "nutrition";
      }

      activities[dateKey] = {
        date: dateKey,
        workouts: dayWorkouts,
        scheduledActivities: dayScheduled,
        meals: dayMeals,
        dailyActivity: dayActivity,
        hasActivity: !!(hasWorkouts || hasMeals || hasDeviceActivity),
        hasScheduled,
        activityType,
      };
    });

    return activities;
  }, [daysInMonth, workouts, meals, dailyActivities, scheduledActivities]);

  const selectedDayData = selectedDay
    ? dayActivities[format(selectedDay, "yyyy-MM-dd")]
    : null;

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground">Calendar</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevMonth}
              className="h-9 w-9 rounded-xl"
              data-testid="button-prev-month"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center" data-testid="text-current-month">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-9 w-9 rounded-xl"
              data-testid="button-next-month"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {daysInMonth.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const activity = dayActivities[dateKey];
              const dayNum = day.getDate();

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200",
                    "hover:bg-muted/50",
                    isToday(day) && "ring-1 ring-primary/50",
                    selectedDay && isSameDay(day, selectedDay) && "bg-primary/20"
                  )}
                  data-testid={`calendar-day-${dateKey}`}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isToday(day) ? "text-primary" : "text-foreground"
                    )}
                  >
                    {dayNum}
                  </span>

                  {(activity?.hasActivity || activity?.hasScheduled) && (
                    <div className="flex items-center gap-0.5">
                      {activity.hasScheduled && !activity.hasActivity && (
                        <div className="w-1.5 h-1.5 rounded-full border border-amber-400 bg-transparent" />
                      )}
                      {activity.hasActivity && activity.activityType === "training" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                      {activity.hasActivity && activity.activityType === "nutrition" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      )}
                      {activity.hasActivity && activity.activityType === "mixed" && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        </>
                      )}
                      {activity.hasScheduled && activity.hasActivity && (
                        <div className="w-1.5 h-1.5 rounded-full border border-amber-400 bg-transparent" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full border border-amber-400 bg-transparent" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span>Nutrition</span>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Loading activity data...
          </div>
        )}
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-display">
              {selectedDay && format(selectedDay, "EEEE, MMMM d")}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {selectedDayData && !selectedDayData.hasActivity && !selectedDayData.hasScheduled ? (
              <div className="py-8 text-center">
                <Moon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Rest day</p>
                <p className="text-xs text-muted-foreground/70 mt-1">No activities logged</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Daily Activity Summary (from synced device) */}
                {selectedDayData?.dailyActivity && (selectedDayData.dailyActivity.steps > 0 || selectedDayData.dailyActivity.activeMinutes > 0) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Daily Activity</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDayData.dailyActivity.steps > 0 && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Footprints className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Steps</span>
                          </div>
                          <span className="text-lg font-semibold text-foreground">
                            {selectedDayData.dailyActivity.steps.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedDayData.dailyActivity.activeMinutes > 0 && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Active</span>
                          </div>
                          <span className="text-lg font-semibold text-foreground">
                            {selectedDayData.dailyActivity.activeMinutes} min
                          </span>
                        </div>
                      )}
                      {selectedDayData.dailyActivity.restingHeartRate && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Heart className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs text-muted-foreground">Resting HR</span>
                          </div>
                          <span className="text-lg font-semibold text-foreground">
                            {selectedDayData.dailyActivity.restingHeartRate} bpm
                          </span>
                        </div>
                      )}
                      {selectedDayData.dailyActivity.sleepMinutes && selectedDayData.dailyActivity.sleepMinutes > 0 && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <Moon className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs text-muted-foreground">Sleep</span>
                          </div>
                          <span className="text-lg font-semibold text-foreground">
                            {Math.floor(selectedDayData.dailyActivity.sleepMinutes / 60)}h {selectedDayData.dailyActivity.sleepMinutes % 60}m
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Synced activities from device */}
                    {selectedDayData.dailyActivity.activities && selectedDayData.dailyActivity.activities.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedDayData.dailyActivity.activities.map((activity, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-muted/30 border border-border"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground">
                                {activity.type}
                              </span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full",
                                activity.intensity === 'high' ? "bg-red-500/10 text-red-400" :
                                activity.intensity === 'medium' ? "bg-yellow-500/10 text-yellow-400" :
                                "bg-green-500/10 text-green-400"
                              )}>
                                {activity.intensity}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {activity.duration > 0 && <span>{activity.duration} min</span>}
                              {activity.caloriesBurned > 0 && <span>{activity.caloriesBurned} kcal</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Scheduled Activities */}
                {selectedDayData?.scheduledActivities && selectedDayData.scheduledActivities.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-foreground">Scheduled</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedDayData.scheduledActivities.map((scheduled) => (
                        <div
                          key={scheduled.id}
                          className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
                          data-testid={`scheduled-item-${scheduled.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {scheduled.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                              Planned
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="capitalize">{scheduled.workoutType}</span>
                            {scheduled.duration && <span>{scheduled.duration} min</span>}
                            {scheduled.intensity && <span className="capitalize">{scheduled.intensity}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logged workouts */}
                {selectedDayData?.workouts && selectedDayData.workouts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Dumbbell className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Completed</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedDayData.workouts.map((workout) => {
                        const getActivityLabel = (type?: string) => {
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
                          return labels[type || ''] || 'Activity';
                        };
                        
                        return (
                          <div
                            key={workout.id}
                            className="p-4 rounded-2xl bg-muted/30 border border-border"
                            data-testid={`workout-item-${workout.id}`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">
                                  {workout.workoutName}
                                </span>
                                {workout.source && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-600 text-white">
                                    {workout.source}
                                  </span>
                                )}
                              </div>
                              <span className="px-3 py-1 text-xs font-medium rounded-full border border-border text-foreground">
                                {getActivityLabel(workout.activityType)}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-muted-foreground mb-2">
                              {workout.duration && workout.duration > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs">{workout.duration} min</span>
                                </div>
                              )}
                              {workout.caloriesBurned && workout.caloriesBurned > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Flame className="w-3 h-3 text-orange-400" />
                                  <span className="text-xs">{workout.caloriesBurned} cal</span>
                                </div>
                              )}
                              {workout.distance && workout.distance > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3" />
                                  <span className="text-xs">{workout.distance.toFixed(2)} km</span>
                                </div>
                              )}
                            </div>
                            
                            {workout.wearableHeartRateAvg && workout.wearableHeartRateAvg > 0 && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Heart className="w-3 h-3 text-red-400" />
                                <span className="text-xs">{workout.wearableHeartRateAvg} bpm</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDayData?.meals && selectedDayData.meals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Utensils className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Nutrition</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedDayData.meals.map((meal) => (
                        <div
                          key={meal.id}
                          className="p-3 rounded-xl bg-muted/30 border border-border"
                          data-testid={`meal-item-${meal.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {meal.foodName}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {meal.mealType}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{meal.calories} kcal</span>
                            {meal.protein && <span>P: {meal.protein}g</span>}
                            {meal.carbs && <span>C: {meal.carbs}g</span>}
                            {meal.fats && <span>F: {meal.fats}g</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="text-xs text-muted-foreground mb-1">Daily Total</div>
                      <div className="flex items-center gap-4 text-sm font-medium text-foreground">
                        <span>
                          {selectedDayData.meals.reduce((sum, m) => sum + m.calories, 0)} kcal
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span>
                          P: {Math.round(selectedDayData.meals.reduce((sum, m) => sum + (m.protein || 0), 0))}g
                        </span>
                        <span>
                          C: {Math.round(selectedDayData.meals.reduce((sum, m) => sum + (m.carbs || 0), 0))}g
                        </span>
                        <span>
                          F: {Math.round(selectedDayData.meals.reduce((sum, m) => sum + (m.fats || 0), 0))}g
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
