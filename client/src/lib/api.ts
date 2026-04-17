import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  subscriptionType: string;
  trialEndsAt: Date | null;
  currentWeight: number | null;
  targetWeight: number | null;
  height: number | null;
  age: number | null;
  gender: string | null;
  fitnessGoal: string | null;
  activityLevel: string | null;
  dailyCalorieGoal: number | null;
  dailyProteinGoal: number | null;
  dailyCarbsGoal: number | null;
  dailyFatsGoal: number | null;
  termsAccepted: boolean;
  termsAcceptedAt: Date | null;
  profileComplete: boolean;
  isActive: boolean;
  isAdmin: boolean | null;
  trainerPreference: string | null;
  userStatus: string | null;
  emailVerified: boolean | null;
  defaultWorkoutMode: string | null;
  primaryDevice: string | null;
  createdAt: Date | string | null;
  subscriptionEndDate: Date | string | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  conversationId?: string | null;
  role: string;
  content: string;
  createdAt: Date;
  actionButtons?: any | null;
  executedActions?: any | null;
}

export interface HealthMetric {
  id: string;
  userId: string;
  date: Date;
  weight: number | null;
  caloriesBurned: number | null;
  workoutsCompleted: number | null;
  sleepHours: number | null;
  waterIntakeMl: number | null;
}

export interface DashboardStats {
  currentWeight: number;
  targetWeight: number;
  weeklyProgress: number;
  caloriesBurnedToday: number;
  workoutsCompleted: number;
  weeklyData: Array<{
    date: Date;
    weight: number | null;
    calories: number | null;
  }>;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    const err = new Error(error.message || "An error occurred") as any;
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// Wrapper for API calls that automatically refreshes session on 401 and retries
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, { ...options, credentials: 'include' });
  
  if (response.status === 401) {
    // Try to refresh session
    try {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        // Retry the original request with same options
        const retryResponse = await fetch(url, { ...options, credentials: 'include' });
        return handleResponse<T>(retryResponse);
      }
    } catch (e) {
      // Refresh failed, continue to throw original error
    }
  }
  
  return handleResponse<T>(response);
}

export function useUser() {
  return useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      return handleResponse(response);
    },
    retry: false,
  });
}

export function useChatMessages(conversationId?: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", conversationId],
    queryFn: async () => {
      const url = conversationId 
        ? `/api/chat/messages?conversationId=${conversationId}`
        : "/api/chat/messages";
      const response = await fetch(url, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useSendMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (content: string) => {
      return fetchWithRetry<ChatMessage>("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId }),
      });
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/chat/messages", conversationId] });
      
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(["/api/chat/messages", conversationId]);
      
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        userId: 'current-user',
        conversationId: conversationId || null,
        role: 'user',
        content: content,
        createdAt: new Date(),
        actionButtons: null,
        executedActions: null,
      };
      
      queryClient.setQueryData<ChatMessage[]>(
        ["/api/chat/messages", conversationId],
        (old) => [...(old || []), optimisticMessage]
      );
      
      return { previousMessages, tempId };
    },
    onError: (_err, _content, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/chat/messages", conversationId], context.previousMessages);
      }
    },
    onSuccess: (_data, _content, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<ChatMessage[]>(
          ["/api/chat/messages", conversationId],
          (old) => old?.filter(msg => msg.id !== context.tempId) || []
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/remaining"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }, 500);
    },
  });
}

export interface MessageQuota {
  remaining: number | null;
  limit: number | null;
  used?: number;
  unlimited: boolean;
}

export function useMessageQuota() {
  return useQuery<MessageQuota>({
    queryKey: ["/api/chat/remaining"],
    queryFn: async () => {
      const response = await fetch("/api/chat/remaining", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useHealthMetrics() {
  return useQuery<HealthMetric[]>({
    queryKey: ["/api/metrics"],
    queryFn: async () => {
      const response = await fetch("/api/metrics", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useCreateMetric() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (metric: Partial<HealthMetric>) => {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(metric),
      });
      return handleResponse<HealthMetric>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useAcceptTerms() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accepted: true }),
      });
      return handleResponse<User>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}

// Fitness Profile types and hooks
export interface FitnessProfile {
  id: string;
  userId: string;
  primarySport: string | null;
  secondarySports: string[] | null;
  trainingEnvironment: string | null;
  shortTermGoal: string | null;
  longTermGoal: string | null;
  currentMilestone: string | null;
  targetDate: Date | null;
  preferredWorkoutDays: string[] | null;
  workoutDuration: number | null;
  intensityPreference: string | null;
  fatigueLevel: number | null;
  lastFatigueUpdate: Date | null;
}

export function useFitnessProfile() {
  return useQuery<FitnessProfile | null>({
    queryKey: ["/api/fitness-profile"],
    queryFn: async () => {
      const response = await fetch("/api/fitness-profile", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useUpdateFitnessProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profile: Partial<FitnessProfile>) => {
      const response = await fetch("/api/fitness-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });
      return handleResponse<FitnessProfile>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-profile"] });
    },
  });
}

export function useUpdateFatigue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (fatigueLevel: number) => {
      const response = await fetch("/api/fitness-profile/fatigue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fatigueLevel }),
      });
      return handleResponse<FitnessProfile>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-profile"] });
    },
  });
}

// Milestone types and hooks
export interface Milestone {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  category: string | null;
  targetDate: Date | null;
  completedAt: Date | null;
  status: string;
  createdAt: Date;
}

export function useMilestones() {
  return useQuery<Milestone[]>({
    queryKey: ["/api/milestones"],
    queryFn: async () => {
      const response = await fetch("/api/milestones", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (milestone: Partial<Milestone>) => {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(milestone),
      });
      return handleResponse<Milestone>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Milestone>) => {
      const response = await fetch(`/api/milestones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      return handleResponse<Milestone>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
  });
}

export function useCompleteMilestone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/milestones/${id}/complete`, {
        method: "POST",
        credentials: "include",
      });
      return handleResponse<Milestone>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/milestones/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
  });
}

// Scheduled Workout types and hooks
export interface ScheduledWorkout {
  id: string;
  userId: string;
  scheduledDate: Date;
  dayOfWeek: string | null;
  timeSlot: string | null;
  workoutType: string;
  activityType: string | null;
  title: string;
  description: string | null;
  duration: number | null;
  intensity: string | null;
  exercises: any[] | null;
  distance: number | null;
  intervals: number | null;
  workTime: number | null;
  restTime: number | null;
  perceivedEffort: number | null;
  mobilityType: string | null;
  sportCategory: string | null;
  location: string | null;
  equipment: string[] | null;
  dataSource: string | null;
  linkedWearableActivityId: string | null;
  status: string;
  completedAt: Date | null;
  performanceFeedback: string | null;
  notes: string | null;
  aiGenerated: boolean;
  weekNumber: number | null;
}

export function useScheduledWorkouts(startDate?: Date, endDate?: Date) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());
  
  return useQuery<ScheduledWorkout[]>({
    queryKey: ["/api/scheduled-workouts", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/scheduled-workouts?${params}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useUpcomingWorkouts(limit?: number) {
  return useQuery<ScheduledWorkout[]>({
    queryKey: ["/api/scheduled-workouts/upcoming", limit],
    queryFn: async () => {
      const response = await fetch(`/api/scheduled-workouts/upcoming${limit ? `?limit=${limit}` : ''}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

// Wearable Activity types and hooks
export interface WearableActivity {
  id: string;
  userId: string;
  date: Date;
  activityName: string;
  activityType: string;
  sourceDevice: 'fitbit' | 'garmin';
  deviceActivityId: string;
  duration: number | null;
  caloriesBurned: number | null;
  distance: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  heartRateZones: any | null;
  elevationGain: number | null;
  avgPace: number | null;
  avgPower: number | null;
  trainingLoad: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function useWearableActivities(startDate?: Date, endDate?: Date) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());
  
  return useQuery<WearableActivity[]>({
    queryKey: ["/api/wearable-activities", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/wearable-activities?${params}`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useCreateScheduledWorkout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (workout: Partial<ScheduledWorkout>) => {
      const response = await fetch("/api/scheduled-workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(workout),
      });
      return handleResponse<ScheduledWorkout>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useGenerateWeekPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scheduled-workouts/generate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      return handleResponse<{ success: boolean; message: string; workoutCount?: number }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useUpdateScheduledWorkout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ScheduledWorkout>) => {
      const response = await fetch(`/api/scheduled-workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      return handleResponse<ScheduledWorkout>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useCompleteScheduledWorkout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, feedback, exerciseData }: { 
      id: string; 
      feedback?: 'easy' | 'moderate' | 'hard';
      exerciseData?: Array<{ name: string; sets: number; reps: number; weight?: number; setsData?: Array<{ reps: number; weight: number }> }>;
    }) => {
      const response = await fetch(`/api/scheduled-workouts/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ feedback, exerciseData }),
      });
      return handleResponse<ScheduledWorkout>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
    },
  });
}

export function useDeleteScheduledWorkout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/scheduled-workouts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

// ============================
// ATHLETE GOALS HOOKS
// ============================

export interface AthleteGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  goalType: string;
  category: string;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  startDate: string;
  endDate: string;
  status: string;
  completedAt: string | null;
  aiAssigned: boolean;
  createdAt: string;
}

export interface GoalStats {
  completed: number;
  active: number;
  failed: number;
}

export function useAthleteGoals(status?: string) {
  return useQuery<AthleteGoal[]>({
    queryKey: ["/api/goals", status],
    queryFn: async () => {
      const url = status ? `/api/goals?status=${status}` : "/api/goals";
      const response = await fetch(url, {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useActiveGoals() {
  return useQuery<AthleteGoal[]>({
    queryKey: ["/api/goals/active"],
    queryFn: async () => {
      const response = await fetch("/api/goals/active", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useGoalStats() {
  return useQuery<GoalStats>({
    queryKey: ["/api/goals/stats"],
    queryFn: async () => {
      const response = await fetch("/api/goals/stats", {
        credentials: "include",
      });
      return handleResponse(response);
    },
  });
}

export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, currentValue }: { id: string; currentValue: number }) => {
      const response = await fetch(`/api/goals/${id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentValue }),
      });
      return handleResponse<AthleteGoal>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });
}

export function useCompleteGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/goals/${id}/complete`, {
        method: "POST",
        credentials: "include",
      });
      return handleResponse<AthleteGoal>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });
}

// ============================
// PLANNED EXERCISES HOOKS (RP Hypertrophy Style)
// ============================

export interface ExerciseSet {
  id: string;
  plannedExerciseId: string;
  userId: string;
  setNumber: number;
  setType: string;
  targetWeight: number | null;
  targetReps: number | null;
  targetRir: number | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  status: string;
  loggedAt: string | null;
  notes: string | null;
}

export interface PlannedExercise {
  id: string;
  scheduledWorkoutId: string;
  userId: string;
  exerciseName: string;
  muscleGroup: string;
  equipmentType: string | null;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRir: number | null;
  exerciseOrder: number | null;
  notes: string | null;
  supersetWith: string | null;
  sets?: ExerciseSet[];
}

export function usePlannedExercises(workoutId: string | null) {
  return useQuery<PlannedExercise[]>({
    queryKey: ["/api/scheduled-workouts", workoutId, "exercises"],
    queryFn: async () => {
      if (!workoutId) return [];
      const response = await fetch(`/api/scheduled-workouts/${workoutId}/exercises`, {
        credentials: "include",
      });
      return handleResponse(response);
    },
    enabled: !!workoutId,
  });
}

export function useCreatePlannedExercise() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workoutId, ...exercise }: { workoutId: string } & Partial<PlannedExercise>) => {
      const response = await fetch(`/api/scheduled-workouts/${workoutId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(exercise),
      });
      return handleResponse<PlannedExercise>(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts", variables.workoutId, "exercises"] });
    },
  });
}

export function useUpdatePlannedExercise() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PlannedExercise>) => {
      const response = await fetch(`/api/exercises/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      return handleResponse<PlannedExercise>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useDeletePlannedExercise() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/exercises/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useAddSet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ exerciseId, setType }: { exerciseId: string; setType?: string }) => {
      const response = await fetch(`/api/exercises/${exerciseId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ setType }),
      });
      return handleResponse<ExerciseSet>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useLogSet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, weight, reps, rir }: { id: string; weight: number; reps: number; rir?: number }) => {
      const response = await fetch(`/api/sets/${id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ weight, reps, rir }),
      });
      return handleResponse<ExerciseSet>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useSkipSet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sets/${id}/skip`, {
        method: "POST",
        credentials: "include",
      });
      return handleResponse<ExerciseSet>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return handleResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

export function useUpdateSet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ExerciseSet>) => {
      const response = await fetch(`/api/sets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      return handleResponse<ExerciseSet>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-workouts"] });
    },
  });
}

// =============================================================================
// WEEKLY REVIEW REPORTS
// =============================================================================

export interface WeeklyReviewReport {
  id: string;
  userId: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  weeklyClassification: string | null;
  avgSleepMinutes: number | null;
  avgSleepQuality: number | null;
  avgHrvScore: number | null;
  avgRpe: number | null;
  workoutsCompleted: number | null;
  workoutsPlanned: number | null;
  completionRate: number | null;
  previousCalorieTarget: number | null;
  newCalorieTarget: number | null;
  calorieAdjustmentPercent: number | null;
  calorieAdjustmentReason: string | null;
  workoutAdjustments: {
    volumeChange: 'increase' | 'maintain' | 'decrease' | 'deload';
    volumeChangePercent: number;
    intensityChange: 'increase' | 'maintain' | 'decrease';
    focusAreas: string[];
    deloadRecommended: boolean;
    specificChanges: string[];
  } | null;
  reportTitle: string | null;
  reportSummary: string | null;
  keyInsights: string[] | null;
  recommendations: string[] | null;
  primaryGoal: string | null;
  goalProgressStatus: string | null;
  acknowledgedByUser: boolean | null;
  createdAt: string;
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ["/api/coaching/weekly-report"],
    queryFn: async () => {
      const response = await fetch("/api/coaching/weekly-report", {
        credentials: "include",
      });
      const data = await handleResponse<{ report: WeeklyReviewReport | null }>(response);
      return data.report;
    },
  });
}

export function useGenerateWeeklyReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/coaching/weekly-report/generate", {
        method: "POST",
        credentials: "include",
      });
      return handleResponse<{ success: boolean; report: WeeklyReviewReport }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/weekly-report"] });
    },
  });
}

export function useAcknowledgeWeeklyReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/coaching/weekly-report/${reportId}/acknowledge`, {
        method: "POST",
        credentials: "include",
      });
      return handleResponse<{ success: boolean; report: WeeklyReviewReport }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/weekly-report"] });
    },
  });
}
