import {
  users,
  workoutPlans,
  workouts,
  dietPlans,
  meals,
  conversations,
  chatMessages,
  healthMetrics,
  healthDocuments,
  workoutLogs,
  smartwatchConnections,
  dailyActivity,
  deviceMetricsRaw,
  userFitnessProfiles,
  milestones,
  scheduledWorkouts,
  referrals,
  challenges,
  challengeParticipants,
  userFeedback,
  userStreaks,
  weeklyCheckIns,
  muscleVolumeTracking,
  userCoachingPreferences,
  exercisePerformanceLogs,
  bodyweightEntries,
  bodyMeasurements,
  wearableActivities,
  userWearableBaselines,
  wearablePhysiologicalFlags,
  type User,
  type UpsertUser,
  type WorkoutPlan,
  type InsertWorkoutPlan,
  type Workout,
  type InsertWorkout,
  type DietPlan,
  type InsertDietPlan,
  type Meal,
  type InsertMeal,
  type Conversation,
  type InsertConversation,
  type ChatMessage,
  type InsertChatMessage,
  type HealthMetric,
  type InsertHealthMetric,
  type HealthDocument,
  type InsertHealthDocument,
  type WorkoutLog,
  type InsertWorkoutLog,
  type SmartwatchConnection,
  type InsertSmartwatchConnection,
  type DailyActivity,
  type InsertDailyActivity,
  type UserFitnessProfile,
  type InsertUserFitnessProfile,
  type Milestone,
  type InsertMilestone,
  type ScheduledWorkout,
  type InsertScheduledWorkout,
  type AthleteGoal,
  type InsertAthleteGoal,
  type Referral,
  type InsertReferral,
  type Challenge,
  type InsertChallenge,
  type ChallengeParticipant,
  type InsertChallengeParticipant,
  type WeeklyCheckIn,
  type InsertWeeklyCheckIn,
  type MuscleVolumeTracking,
  type InsertMuscleVolumeTracking,
  type UserCoachingPreferences,
  type InsertUserCoachingPreferences,
  type ExercisePerformanceLog,
  type InsertExercisePerformanceLog,
  type BodyweightEntry,
  type InsertBodyweightEntry,
  type BodyMeasurement,
  type InsertBodyMeasurement,
  type DeviceMetricsRaw,
  type InsertDeviceMetricsRaw,
  type WearableActivity,
  type InsertWearableActivity,
  type WearableExerciseSet,
  type InsertWearableExerciseSet,
  type UserWearableBaseline,
  type InsertUserWearableBaseline,
  type WearablePhysiologicalFlag,
  type InsertWearablePhysiologicalFlag,
  wearableExerciseSets,
  type PlannedExercise,
  type InsertPlannedExercise,
  type ExerciseSet,
  type InsertExerciseSet,
  plannedExercises,
  exerciseSets,
  athleteGoals,
  coachingDecisions,
  type CoachingDecision,
  type InsertCoachingDecision,
  pushSubscriptions,
  notificationLogs,
  type PushSubscription,
  type InsertPushSubscription,
  type NotificationLog,
  type InsertNotificationLog,
  type NotificationType,
  activeWorkoutSessionsTable,
  liveSetLogs,
  cardioIntervals,
  weeklyCoachingReviews,
  type ActiveWorkoutSessionRow,
  type InsertActiveWorkoutSession,
  type LiveSetLog,
  type InsertLiveSetLog,
  type CardioInterval,
  type InsertCardioInterval,
  type WeeklyCoachingReview,
  type InsertWeeklyCoachingReview,
  SESSION_STATUS,
  goalEvaluations,
  type GoalEvaluation,
  type InsertGoalEvaluation,
  weeklyReviewReports,
  type WeeklyReviewReport,
  type InsertWeeklyReviewReport,
  foodLogs,
  type FoodLog,
  type InsertFoodLog,
  trainerKnowledge,
  type TrainerKnowledge,
  type InsertTrainerKnowledge,
  learningJobHistory,
  type LearningJobHistory,
  type InsertLearningJobHistory,
} from "@shared/schema";
import { resolveDeviceConflicts, type RawDeviceMetric } from "@shared/deviceConflictResolver";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte, lt, inArray, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Workout Plan operations
  getWorkoutPlans(userId: string): Promise<WorkoutPlan[]>;
  getWorkoutPlan(id: string): Promise<WorkoutPlan | undefined>;
  createWorkoutPlan(plan: InsertWorkoutPlan): Promise<WorkoutPlan>;
  
  // Workout operations
  getWorkouts(planId: string): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  updateWorkoutStatus(id: string, status: string): Promise<Workout | undefined>;
  
  // Diet Plan operations
  getDietPlans(userId: string): Promise<DietPlan[]>;
  getDietPlan(id: string): Promise<DietPlan | undefined>;
  createDietPlan(plan: InsertDietPlan): Promise<DietPlan>;
  getCurrentDietPlan(userId: string): Promise<DietPlan | undefined>;
  createConfirmedDietPlan(userId: string, data: {
    dailyCalories: number;
    macros: { protein: number; carbs: number; fats: number };
    contextLabel?: string;
    foodPlan?: { food: string; quantity: string }[];
  }): Promise<DietPlan>;
  
  // Meal operations
  getMeals(planId: string): Promise<Meal[]>;
  getMeal(id: string): Promise<Meal | undefined>;
  createMeal(meal: InsertMeal): Promise<Meal>;
  
  // Conversation operations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationTitle(id: string, title: string): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  
  // Chat operations
  getChatMessages(userId: string, limit?: number): Promise<ChatMessage[]>;
  getChatMessagesByConversation(conversationId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getUserMessageCountThisMonth(userId: string): Promise<number>;
  createChatMessageWithQuotaCheck(message: InsertChatMessage, monthlyLimit: number): Promise<{ message: ChatMessage | null; limitReached: boolean; remaining: number }>;
  clearConversationMessages(conversationId: string): Promise<boolean>;
  
  // Health Metrics operations
  getHealthMetrics(userId: string, limit?: number): Promise<HealthMetric[]>;
  createHealthMetric(metric: InsertHealthMetric): Promise<HealthMetric>;
  getLatestMetric(userId: string): Promise<HealthMetric | undefined>;
  
  // Health Documents operations
  getHealthDocuments(userId: string): Promise<HealthDocument[]>;
  createHealthDocument(doc: InsertHealthDocument): Promise<HealthDocument>;
  getDocumentCountForMonth(userId: string, month: string): Promise<number>;
  updateDocumentAnalysis(id: string, analysis: any, metrics: any): Promise<HealthDocument | undefined>;

  // Workout Log operations
  getWorkoutLogs(userId: string, startDate?: Date, endDate?: Date): Promise<WorkoutLog[]>;
  getWorkoutLog(id: string): Promise<WorkoutLog | undefined>;
  createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog>;
  updateWorkoutLog(id: string, updates: Partial<InsertWorkoutLog>): Promise<WorkoutLog | undefined>;
  deleteWorkoutLog(id: string): Promise<boolean>;


  // Smartwatch Connection operations
  getSmartwatchConnections(userId: string): Promise<SmartwatchConnection[]>;
  getAllActiveSmartwatchConnections(): Promise<SmartwatchConnection[]>;
  getSmartwatchConnectionByTerraUser(terraUserId: string): Promise<SmartwatchConnection | undefined>;
  getSmartwatchConnectionByGarminUserId(garminUserId: string): Promise<SmartwatchConnection | undefined>;
  getSmartwatchConnectionByProvider(userId: string, provider: string): Promise<SmartwatchConnection | undefined>;
  connectSmartwatch(connection: InsertSmartwatchConnection): Promise<SmartwatchConnection>;
  updateSmartwatchConnection(id: string, updates: Partial<SmartwatchConnection>): Promise<SmartwatchConnection | undefined>;
  disconnectSmartwatch(userId: string, provider: string): Promise<boolean>;
  
  // Daily Activity operations (from smartwatches)
  getDailyActivity(userId: string, date: string): Promise<DailyActivity | undefined>;
  getDailyActivityRange(userId: string, startDate: string, endDate: string): Promise<DailyActivity[]>;
  upsertDailyActivity(activity: InsertDailyActivity): Promise<DailyActivity>;
  updateSleepOnly(userId: string, date: string, sleepMinutes: number, sleepEfficiency?: number | null): Promise<DailyActivity>;

  // Device Metrics Raw operations (multi-device support)
  getDeviceMetricsRaw(userId: string, date: string): Promise<DeviceMetricsRaw[]>;
  upsertDeviceMetricsRaw(metrics: InsertDeviceMetricsRaw): Promise<DeviceMetricsRaw>;
  resolveAndSaveDailyActivity(userId: string, date: string): Promise<DailyActivity>;

  // Bodyweight Entry operations (for trend tracking)
  getBodyweightEntries(userId: string, startDate: string, endDate: string): Promise<BodyweightEntry[]>;
  getBodyweightEntry(id: string): Promise<BodyweightEntry | undefined>;
  createBodyweightEntry(entry: InsertBodyweightEntry): Promise<BodyweightEntry>;
  upsertBodyweightEntry(entry: InsertBodyweightEntry): Promise<BodyweightEntry>;
  deleteBodyweightEntry(id: string): Promise<boolean>;
  getLatestBodyweightEntry(userId: string): Promise<BodyweightEntry | undefined>;
  updateBodyweightEntryHidden(id: string, hidden: boolean): Promise<BodyweightEntry | undefined>;

  // Body Measurement operations (weekly body composition)
  getBodyMeasurements(userId: string, startDate: string, endDate: string): Promise<BodyMeasurement[]>;
  getBodyMeasurement(id: string): Promise<BodyMeasurement | undefined>;
  getLatestBodyMeasurement(userId: string): Promise<BodyMeasurement | undefined>;
  createBodyMeasurement(entry: InsertBodyMeasurement): Promise<BodyMeasurement>;
  updateBodyMeasurement(id: string, updates: Partial<InsertBodyMeasurement>): Promise<BodyMeasurement | undefined>;
  deleteBodyMeasurement(id: string): Promise<boolean>;

  // User goals operations
  updateUserGoals(userId: string, goals: { dailyCalorieGoal?: number; dailyProteinGoal?: number; dailyCarbsGoal?: number; dailyFatsGoal?: number }): Promise<User | undefined>;

  // Terms & Conditions
  acceptTerms(userId: string): Promise<User>;

  // Profile setup
  updateUserProfile(userId: string, profile: Partial<User>): Promise<User>;
  
  // Account deactivation
  deactivateUser(userId: string): Promise<void>;

  // User Fitness Profile operations
  getUserFitnessProfile(userId: string): Promise<UserFitnessProfile | undefined>;
  upsertUserFitnessProfile(profile: InsertUserFitnessProfile): Promise<UserFitnessProfile>;
  updateFatigueLevel(userId: string, fatigueLevel: number): Promise<UserFitnessProfile | undefined>;

  // Milestone operations
  getMilestones(userId: string): Promise<Milestone[]>;
  getMilestone(id: string): Promise<Milestone | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string): Promise<boolean>;
  completeMilestone(id: string): Promise<Milestone | undefined>;

  // Scheduled Workout operations
  getScheduledWorkouts(userId: string, startDate: Date, endDate: Date): Promise<ScheduledWorkout[]>;
  getScheduledWorkout(id: string): Promise<ScheduledWorkout | undefined>;
  getScheduledWorkoutsByWeek(userId: string, weekNumber: number): Promise<ScheduledWorkout[]>;
  createScheduledWorkout(workout: InsertScheduledWorkout): Promise<ScheduledWorkout>;
  updateScheduledWorkout(id: string, updates: Partial<InsertScheduledWorkout>): Promise<ScheduledWorkout | undefined>;
  deleteScheduledWorkout(id: string): Promise<boolean>;
  deleteScheduledWorkoutsInRange(userId: string, fromDate: Date, toDate: Date): Promise<number>;
  findScheduledWorkoutByDateAndTitle(userId: string, scheduledDate: Date, title: string): Promise<ScheduledWorkout | undefined>;
  completeScheduledWorkout(id: string, feedback?: 'easy' | 'moderate' | 'hard'): Promise<ScheduledWorkout | undefined>;
  completeMatchingScheduledWorkouts(userId: string, title: string, date: Date): Promise<number>;
  getUpcomingWorkouts(userId: string, limit?: number): Promise<ScheduledWorkout[]>;
  getRecentCompletedWorkouts(userId: string, limit?: number): Promise<ScheduledWorkout[]>;

  // Admin operations
  getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    signupsThisMonth: number;
    signupsThisWeek: number;
    usersWithCompleteProfiles: number;
    totalMessages: number;
    totalFoodEntries: number;
    totalWorkoutLogs: number;
    messagesThisWeek: number;
    totalGoalsAssigned: number;
    goalsCompletedThisWeek: number;
    goalsCompletedThisMonth: number;
    activeGoals: number;
  }>;
  getRecentUsers(limit: number): Promise<{
    id: string;
    firstName: string | null;
    email: string | null;
    createdAt: Date | null;
    subscriptionType: string | null;
    profileComplete: boolean | null;
  }[]>;
  
  // Email export for admin marketing
  getUserEmailsForExport(): Promise<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    subscriptionType: string | null;
    signupDate: Date | null;
  }[]>;

  // Athlete Goals operations
  getAthleteGoals(userId: string, status?: string): Promise<AthleteGoal[]>;
  getActiveGoals(userId: string): Promise<AthleteGoal[]>;
  getAthleteGoal(id: string): Promise<AthleteGoal | undefined>;
  createAthleteGoal(goal: InsertAthleteGoal): Promise<AthleteGoal>;
  updateAthleteGoal(id: string, updates: Partial<InsertAthleteGoal>): Promise<AthleteGoal | undefined>;
  updateGoalProgress(id: string, currentValue: number): Promise<AthleteGoal | undefined>;
  completeGoal(id: string): Promise<AthleteGoal | undefined>;
  deleteAthleteGoal(id: string): Promise<boolean>;
  getGoalStats(userId: string): Promise<{ completed: number; active: number; failed: number }>;

  // Referral operations
  getUserByReferralCode(code: string): Promise<User | undefined>;
  generateReferralCode(userId: string): Promise<string>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralsByReferrer(referrerId: string): Promise<Referral[]>;
  getPaidReferralCount(referrerId: string): Promise<number>;
  markReferralPaid(referredId: string): Promise<Referral | undefined>;
  rewardReferrer(referrerId: string): Promise<User | undefined>;

  // Challenge operations
  getChallenges(activeOnly?: boolean): Promise<Challenge[]>;
  getChallenge(id: string): Promise<Challenge | undefined>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  joinChallenge(participation: InsertChallengeParticipant): Promise<ChallengeParticipant>;
  getUserChallenges(userId: string): Promise<(ChallengeParticipant & { challenge: Challenge })[]>;
  getChallengeParticipant(challengeId: string, userId: string): Promise<ChallengeParticipant | undefined>;
  updateChallengeProgress(participantId: string, dayCompleted: number): Promise<ChallengeParticipant | undefined>;
  getChallengeLeaderboard(challengeId: string, limit?: number): Promise<(ChallengeParticipant & { user: Pick<User, 'id' | 'firstName' | 'profileImageUrl'> })[]>;
  
  // User progress stats for sharing
  getUserProgressStats(userId: string): Promise<{
    workoutsCompleted: number;
    totalCaloriesLogged: number;
    currentStreak: number;
    challengesCompleted: number;
  }>;

  // Filtered workout counts for Progress page
  getWorkoutCountsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<number>;

  // Feedback operations
  createFeedback(feedback: { userId?: string; rating: number; category?: string; comment?: string; userEmail?: string; pageUrl?: string }): Promise<{ id: string; rating: number }>;
  getFeedbackStats(): Promise<{ 
    totalFeedback: number; 
    averageRating: number; 
    feedbackByCategory: { category: string; count: number }[];
    recentFeedback: { id: string; rating: number; category: string | null; comment: string | null; userEmail: string | null; status: string | null; createdAt: Date | null }[];
    openFeedbackCount: number;
  }>;
  updateFeedbackStatus(id: string, status: string, adminNotes?: string): Promise<void>;

  // Streak operations
  getUserStreak(userId: string, streakType?: string): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: Date | null } | undefined>;
  updateStreak(userId: string, streakType?: string): Promise<{ currentStreak: number; longestStreak: number }>;

  // Coaching Engine operations
  getUserCoachingPreferences(userId: string): Promise<UserCoachingPreferences | undefined>;
  upsertUserCoachingPreferences(prefs: InsertUserCoachingPreferences): Promise<UserCoachingPreferences>;
  
  getWeeklyCheckIns(userId: string, limit?: number): Promise<WeeklyCheckIn[]>;
  getWeeklyCheckIn(userId: string, weekNumber: number, year: number): Promise<WeeklyCheckIn | undefined>;
  upsertWeeklyCheckIn(checkIn: InsertWeeklyCheckIn): Promise<WeeklyCheckIn>;
  
  getMuscleVolumeTracking(userId: string, weekNumber: number, year: number): Promise<MuscleVolumeTracking | undefined>;
  upsertMuscleVolumeTracking(volume: InsertMuscleVolumeTracking): Promise<MuscleVolumeTracking>;
  
  getExercisePerformanceLogs(userId: string, limit?: number): Promise<ExercisePerformanceLog[]>;
  getExerciseHistory(userId: string, exerciseName: string, limit?: number): Promise<ExercisePerformanceLog[]>;
  createExercisePerformanceLog(log: InsertExercisePerformanceLog): Promise<ExercisePerformanceLog>;
  
  // Focus Group operations
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createFocusGroupUser(email: string, firstName?: string): Promise<User>;
  setEmailVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  verifyEmail(userId: string): Promise<User>;
  activateUser(userId: string): Promise<User>;
  deactivateToWaitlist(userId: string): Promise<User>;
  getWaitlistUsers(): Promise<User[]>;
  getActiveUsers(): Promise<User[]>;
  markActivationEmailSent(userId: string): Promise<void>;
  getFocusGroupStats(): Promise<{
    guestMessageCount: number;
    totalSignups: number;
    waitlistUsers: number;
    activeUsers: number;
    avgMessagesPerUser: number;
  }>;

  // Wearable Activity operations (for workout mode system)
  getWearableActivities(userId: string, startDate: Date, endDate: Date): Promise<WearableActivity[]>;
  getWearableActivity(id: string): Promise<WearableActivity | undefined>;
  getWearableActivityByDeviceId(userId: string, sourceDevice: string, deviceActivityId: string): Promise<WearableActivity | undefined>;
  getWearableActivityByGarminSummaryId(userId: string, summaryId: string): Promise<WearableActivity | undefined>;
  createWearableActivity(activity: InsertWearableActivity): Promise<WearableActivity>;
  updateWearableActivity(id: string, updates: Partial<InsertWearableActivity>): Promise<WearableActivity | undefined>;
  linkWearableToWorkoutLog(wearableActivityId: string, workoutLogId: string): Promise<WearableActivity | undefined>;
  getUnstructuredWearableActivities(userId: string, limit?: number): Promise<WearableActivity[]>;
  reconcileDetectedActivity(wearableActivity: WearableActivity): Promise<ScheduledWorkout | null>;
  
  // Trainer confirmation flow
  getPendingWearableActivities(userId: string): Promise<WearableActivity[]>;
  confirmWearableActivity(id: string, workoutLogId?: string, confirmedBy?: string): Promise<WearableActivity | undefined>;
  skipWearableConfirmation(id: string): Promise<WearableActivity | undefined>;
  
  // Wearable Exercise Sets (Garmin FIT file parsed data)
  getWearableExerciseSets(wearableActivityId: string): Promise<WearableExerciseSet[]>;
  createWearableExerciseSets(sets: InsertWearableExerciseSet[]): Promise<WearableExerciseSet[]>;
  deleteWearableExerciseSets(wearableActivityId: string): Promise<number>;
  updateWearableActivityStructure(id: string, status: string, error?: string): Promise<WearableActivity | undefined>;

  // Planned Exercise operations (RP Hypertrophy style)
  getPlannedExercises(scheduledWorkoutId: string): Promise<PlannedExercise[]>;
  getPlannedExercise(id: string): Promise<PlannedExercise | undefined>;
  createPlannedExercise(exercise: InsertPlannedExercise): Promise<PlannedExercise>;
  updatePlannedExercise(id: string, updates: Partial<InsertPlannedExercise>): Promise<PlannedExercise | undefined>;
  deletePlannedExercise(id: string): Promise<boolean>;
  reorderExercises(scheduledWorkoutId: string, exerciseIds: string[]): Promise<void>;

  // Exercise Set operations
  getExerciseSets(plannedExerciseId: string): Promise<ExerciseSet[]>;
  getExerciseSet(id: string): Promise<ExerciseSet | undefined>;
  createExerciseSet(set: InsertExerciseSet): Promise<ExerciseSet>;
  updateExerciseSet(id: string, updates: Partial<InsertExerciseSet>): Promise<ExerciseSet | undefined>;
  deleteExerciseSet(id: string): Promise<boolean>;
  logSet(id: string, weight: number, reps: number, rir?: number): Promise<ExerciseSet | undefined>;
  skipSet(id: string): Promise<ExerciseSet | undefined>;
  addSetToExercise(plannedExerciseId: string, setType?: string): Promise<ExerciseSet>;

  // Coaching Decision operations
  getLatestCoachingDecision(userId: string): Promise<CoachingDecision | undefined>;
  getCoachingDecisionHistory(userId: string, limit?: number): Promise<CoachingDecision[]>;
  createCoachingDecision(decision: InsertCoachingDecision): Promise<CoachingDecision>;
  markDecisionSurfaced(id: string): Promise<CoachingDecision | undefined>;
  
  // Push Subscription operations
  getPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  updatePushSubscriptionLastUsed(id: string): Promise<PushSubscription | undefined>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  getAllUserIdsWithPushSubscriptions(): Promise<string[]>;
  
  // Notification Log operations (for rate limiting)
  getNotificationCountToday(userId: string): Promise<number>;
  getCoachingNotificationCountToday(userId: string): Promise<number>;
  getLastNotificationOfType(userId: string, notificationType: NotificationType): Promise<NotificationLog | undefined>;
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  markNotificationClicked(id: string): Promise<NotificationLog | undefined>;
  
  // Admin export operations
  getAdminUserExportData(): Promise<AdminUserExportRow[]>;
  
  // Wearable Data Contract operations
  getUserWearableBaseline(userId: string): Promise<UserWearableBaseline | undefined>;
  upsertUserWearableBaseline(userId: string, data: Partial<InsertUserWearableBaseline>): Promise<UserWearableBaseline>;
  getWearablePhysiologicalFlags(userId: string, date: string): Promise<WearablePhysiologicalFlag | undefined>;
  getRecentWearableFlags(userId: string, days: number): Promise<WearablePhysiologicalFlag[]>;
  upsertWearablePhysiologicalFlag(data: InsertWearablePhysiologicalFlag): Promise<WearablePhysiologicalFlag>;

  // Workout Execution Model operations
  getActiveWorkoutSession(userId: string): Promise<ActiveWorkoutSessionRow | undefined>;
  getWorkoutSession(id: string): Promise<ActiveWorkoutSessionRow | undefined>;
  createWorkoutSession(session: InsertActiveWorkoutSession): Promise<ActiveWorkoutSessionRow>;
  updateWorkoutSession(id: string, updates: Partial<InsertActiveWorkoutSession>): Promise<ActiveWorkoutSessionRow | undefined>;
  endWorkoutSession(id: string, status: string): Promise<ActiveWorkoutSessionRow | undefined>;
  
  // Live Set Log operations
  getLiveSetLogs(sessionId: string): Promise<LiveSetLog[]>;
  createLiveSetLog(log: InsertLiveSetLog): Promise<LiveSetLog>;
  
  // Cardio Interval operations
  getCardioIntervals(sessionId: string): Promise<CardioInterval[]>;
  createCardioInterval(interval: InsertCardioInterval): Promise<CardioInterval>;
  completeCardioInterval(id: string, actualDuration: number, heartRate?: number, perceivedExertion?: number): Promise<CardioInterval | undefined>;
  
  // Weekly Coaching Review operations
  getWeeklyReview(userId: string, weekStart: Date): Promise<WeeklyCoachingReview | undefined>;
  getLatestWeeklyReview(userId: string): Promise<WeeklyCoachingReview | undefined>;
  getWeeklyReviewHistory(userId: string, limit?: number): Promise<WeeklyCoachingReview[]>;
  createWeeklyReview(review: InsertWeeklyCoachingReview): Promise<WeeklyCoachingReview>;
  
  // Goal Evaluation operations
  getGoalEvaluation(userId: string, weekStart: Date): Promise<GoalEvaluation | undefined>;
  getLatestGoalEvaluation(userId: string): Promise<GoalEvaluation | undefined>;
  getGoalEvaluationHistory(userId: string, limit?: number): Promise<GoalEvaluation[]>;
  createGoalEvaluation(evaluation: InsertGoalEvaluation): Promise<GoalEvaluation>;
  
  // Weekly Review Report operations
  getWeeklyReviewReport(userId: string, weekStart: Date): Promise<WeeklyReviewReport | undefined>;
  getLatestWeeklyReviewReport(userId: string): Promise<WeeklyReviewReport | undefined>;
  getWeeklyReviewReportHistory(userId: string, limit?: number): Promise<WeeklyReviewReport[]>;
  createWeeklyReviewReport(report: InsertWeeklyReviewReport): Promise<WeeklyReviewReport>;
  acknowledgeWeeklyReviewReport(reportId: string): Promise<WeeklyReviewReport | undefined>;
  
  // Food Log operations
  getFoodLogs(userId: string, date: string): Promise<FoodLog[]>;
  getFoodLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<FoodLog[]>;
  createFoodLog(log: InsertFoodLog): Promise<FoodLog>;
  updateFoodLog(id: string, updates: Partial<InsertFoodLog>): Promise<FoodLog | undefined>;
  deleteFoodLog(id: string): Promise<boolean>;
  getDailyNutritionSummary(userId: string, date: string): Promise<{ calories: number; protein: number; carbs: number; fats: number }>;
}

// Type for admin user export (not stored in DB, computed on export)
export interface AdminUserExportRow {
  userId: string;
  email: string | null;
  accountCreatedAt: Date | null;
  emailVerified: boolean;
  planName: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  autoRenew: boolean;
  lastActiveAt: Date | null;
  totalWorkoutsLogged: number;
  deviceConnected: string;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Workout Plan operations
  async getWorkoutPlans(userId: string): Promise<WorkoutPlan[]> {
    return await db.select().from(workoutPlans).where(eq(workoutPlans.userId, userId));
  }

  async getWorkoutPlan(id: string): Promise<WorkoutPlan | undefined> {
    const [plan] = await db.select().from(workoutPlans).where(eq(workoutPlans.id, id));
    return plan;
  }

  async createWorkoutPlan(plan: InsertWorkoutPlan): Promise<WorkoutPlan> {
    const [newPlan] = await db.insert(workoutPlans).values(plan).returning();
    return newPlan;
  }

  // Workout operations
  async getWorkouts(planId: string): Promise<Workout[]> {
    return await db.select().from(workouts).where(eq(workouts.planId, planId));
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    const [workout] = await db.select().from(workouts).where(eq(workouts.id, id));
    return workout;
  }

  async createWorkout(workout: InsertWorkout): Promise<Workout> {
    const [newWorkout] = await db.insert(workouts).values(workout).returning();
    return newWorkout;
  }

  async updateWorkoutStatus(id: string, status: string): Promise<Workout | undefined> {
    const [updated] = await db
      .update(workouts)
      .set({ status })
      .where(eq(workouts.id, id))
      .returning();
    return updated;
  }

  // Diet Plan operations
  async getDietPlans(userId: string): Promise<DietPlan[]> {
    return await db.select().from(dietPlans).where(eq(dietPlans.userId, userId));
  }

  async getDietPlan(id: string): Promise<DietPlan | undefined> {
    const [plan] = await db.select().from(dietPlans).where(eq(dietPlans.id, id));
    return plan;
  }

  async createDietPlan(plan: InsertDietPlan): Promise<DietPlan> {
    const [newPlan] = await db.insert(dietPlans).values(plan).returning();
    return newPlan;
  }

  async getCurrentDietPlan(userId: string): Promise<DietPlan | undefined> {
    const [plan] = await db
      .select()
      .from(dietPlans)
      .where(
        and(
          eq(dietPlans.userId, userId),
          isNotNull(dietPlans.confirmedAt)
        )
      )
      .orderBy(desc(dietPlans.confirmedAt))
      .limit(1);
    return plan;
  }

  async createConfirmedDietPlan(userId: string, data: {
    dailyCalories: number;
    macros: { protein: number; carbs: number; fats: number };
    contextLabel?: string;
    foodPlan?: { food: string; quantity: string }[];
  }): Promise<DietPlan> {
    const [newPlan] = await db
      .insert(dietPlans)
      .values({
        userId,
        weekNumber: 1,
        dailyCalories: data.dailyCalories,
        macros: data.macros,
        contextLabel: data.contextLabel || null,
        foodPlan: data.foodPlan || null,
        confirmedAt: new Date(),
      })
      .returning();
    return newPlan;
  }

  // Meal operations
  async getMeals(planId: string): Promise<Meal[]> {
    return await db.select().from(meals).where(eq(meals.planId, planId));
  }

  async getMeal(id: string): Promise<Meal | undefined> {
    const [meal] = await db.select().from(meals).where(eq(meals.id, id));
    return meal;
  }

  async createMeal(meal: InsertMeal): Promise<Meal> {
    const [newMeal] = await db.insert(meals).values(meal).returning();
    return newMeal;
  }

  // Conversation operations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations).values(conversation).returning();
    return newConversation;
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db.delete(conversations).where(eq(conversations.id, id));
    return true;
  }

  // Chat operations
  async getChatMessages(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async getChatMessagesByConversation(conversationId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async clearConversationMessages(conversationId: string): Promise<boolean> {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));
    return true;
  }

  async getUserMessageCountThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.role, 'user'),
          gte(chatMessages.createdAt, startOfMonth)
        )
      );
    
    return Number(result[0]?.count || 0);
  }

  async createChatMessageWithQuotaCheck(
    message: InsertChatMessage, 
    monthlyLimit: number
  ): Promise<{ message: ChatMessage | null; limitReached: boolean; remaining: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return await db.transaction(async (tx) => {
      const lockKey = `chat_quota_${message.userId}`.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      
      const countResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.userId, message.userId),
            eq(chatMessages.role, 'user'),
            gte(chatMessages.createdAt, startOfMonth)
          )
        );
      
      const currentCount = Number(countResult[0]?.count || 0);
      
      if (currentCount >= monthlyLimit) {
        return {
          message: null,
          limitReached: true,
          remaining: 0
        };
      }
      
      const [newMessage] = await tx.insert(chatMessages).values(message).returning();
      
      return {
        message: newMessage,
        limitReached: false,
        remaining: monthlyLimit - currentCount - 1
      };
    });
  }

  // Health Metrics operations
  async getHealthMetrics(userId: string, limit: number = 30): Promise<HealthMetric[]> {
    return await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.userId, userId))
      .orderBy(desc(healthMetrics.date))
      .limit(limit);
  }

  async createHealthMetric(metric: InsertHealthMetric): Promise<HealthMetric> {
    const [newMetric] = await db.insert(healthMetrics).values(metric).returning();
    return newMetric;
  }

  async getLatestMetric(userId: string): Promise<HealthMetric | undefined> {
    const [metric] = await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.userId, userId))
      .orderBy(desc(healthMetrics.date))
      .limit(1);
    return metric;
  }

  // Health Documents operations
  async getHealthDocuments(userId: string): Promise<HealthDocument[]> {
    return await db
      .select()
      .from(healthDocuments)
      .where(eq(healthDocuments.userId, userId))
      .orderBy(desc(healthDocuments.createdAt));
  }

  async createHealthDocument(doc: InsertHealthDocument): Promise<HealthDocument> {
    const [newDoc] = await db.insert(healthDocuments).values(doc).returning();
    return newDoc;
  }

  async getDocumentCountForMonth(userId: string, month: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(healthDocuments)
      .where(
        and(
          eq(healthDocuments.userId, userId),
          eq(healthDocuments.uploadMonth, month)
        )
      );
    return Number(result[0]?.count || 0);
  }

  async updateDocumentAnalysis(id: string, analysis: any, metrics: any): Promise<HealthDocument | undefined> {
    const [updated] = await db
      .update(healthDocuments)
      .set({ 
        analysisResult: analysis,
        extractedMetrics: metrics
      })
      .where(eq(healthDocuments.id, id))
      .returning();
    return updated;
  }

  // Workout Log operations
  async getWorkoutLogs(userId: string, startDate?: Date, endDate?: Date): Promise<WorkoutLog[]> {
    const conditions = [eq(workoutLogs.userId, userId)];
    if (startDate) conditions.push(gte(workoutLogs.date, startDate));
    if (endDate) conditions.push(lte(workoutLogs.date, endDate));
    
    return await db
      .select()
      .from(workoutLogs)
      .where(and(...conditions))
      .orderBy(desc(workoutLogs.date));
  }

  async getWorkoutLog(id: string): Promise<WorkoutLog | undefined> {
    const [log] = await db.select().from(workoutLogs).where(eq(workoutLogs.id, id));
    return log;
  }

  async createWorkoutLog(log: InsertWorkoutLog): Promise<WorkoutLog> {
    const [newLog] = await db.insert(workoutLogs).values(log).returning();
    return newLog;
  }

  async updateWorkoutLog(id: string, updates: Partial<InsertWorkoutLog>): Promise<WorkoutLog | undefined> {
    const [updated] = await db
      .update(workoutLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workoutLogs.id, id))
      .returning();
    return updated;
  }

  async deleteWorkoutLog(id: string): Promise<boolean> {
    const result = await db.delete(workoutLogs).where(eq(workoutLogs.id, id)).returning();
    return result.length > 0;
  }


  // Smartwatch Connection operations
  async getSmartwatchConnections(userId: string): Promise<SmartwatchConnection[]> {
    return await db
      .select()
      .from(smartwatchConnections)
      .where(eq(smartwatchConnections.userId, userId));
  }

  async getAllActiveSmartwatchConnections(): Promise<SmartwatchConnection[]> {
    return await db
      .select()
      .from(smartwatchConnections)
      .where(eq(smartwatchConnections.isActive, true));
  }

  async connectSmartwatch(connection: InsertSmartwatchConnection): Promise<SmartwatchConnection> {
    const [newConnection] = await db.insert(smartwatchConnections).values(connection).returning();
    return newConnection;
  }

  async disconnectSmartwatch(userId: string, provider: string): Promise<boolean> {
    const result = await db
      .delete(smartwatchConnections)
      .where(
        and(
          eq(smartwatchConnections.userId, userId),
          eq(smartwatchConnections.provider, provider)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getSmartwatchConnectionByTerraUser(terraUserId: string): Promise<SmartwatchConnection | undefined> {
    const [connection] = await db
      .select()
      .from(smartwatchConnections)
      .where(eq(smartwatchConnections.terraUserId, terraUserId));
    return connection;
  }

  async getSmartwatchConnectionByGarminUserId(garminUserId: string): Promise<SmartwatchConnection | undefined> {
    const [connection] = await db
      .select()
      .from(smartwatchConnections)
      .where(eq(smartwatchConnections.garminUserId, garminUserId));
    return connection;
  }

  async getSmartwatchConnectionByProvider(userId: string, provider: string): Promise<SmartwatchConnection | undefined> {
    const [connection] = await db
      .select()
      .from(smartwatchConnections)
      .where(
        and(
          eq(smartwatchConnections.userId, userId),
          eq(smartwatchConnections.provider, provider)
        )
      );
    return connection;
  }

  async updateSmartwatchConnection(id: string, updates: Partial<SmartwatchConnection>): Promise<SmartwatchConnection | undefined> {
    const [updated] = await db
      .update(smartwatchConnections)
      .set(updates)
      .where(eq(smartwatchConnections.id, id))
      .returning();
    return updated;
  }

  async getDailyActivity(userId: string, date: string): Promise<DailyActivity | undefined> {
    const [activity] = await db
      .select()
      .from(dailyActivity)
      .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.date, date)));
    return activity;
  }

  async getDailyActivityRange(userId: string, startDate: string, endDate: string): Promise<DailyActivity[]> {
    return db
      .select()
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, userId),
          gte(dailyActivity.date, startDate),
          lte(dailyActivity.date, endDate)
        )
      )
      .orderBy(desc(dailyActivity.date));
  }

  async upsertDailyActivity(activity: InsertDailyActivity): Promise<DailyActivity> {
    const existing = await this.getDailyActivity(activity.userId, activity.date);
    if (existing) {
      const filteredActivity = Object.fromEntries(
        Object.entries(activity).filter(([_, v]) => v !== undefined && v !== null)
      );
      
      const [updated] = await db
        .update(dailyActivity)
        .set({ 
          ...filteredActivity, 
          updatedAt: new Date() 
        })
        .where(eq(dailyActivity.id, existing.id))
        .returning();
      return updated;
    }
    const [newActivity] = await db.insert(dailyActivity).values(activity).returning();
    return newActivity;
  }
  
  async updateSleepOnly(userId: string, date: string, sleepMinutes: number, sleepEfficiency?: number | null): Promise<DailyActivity> {
    const existing = await this.getDailyActivity(userId, date);
    
    if (existing) {
      const [updated] = await db
        .update(dailyActivity)
        .set({ 
          sleepMinutes,
          sleepEfficiency: sleepEfficiency ?? null,
          source: 'manual_sleep',
          updatedAt: new Date() 
        })
        .where(eq(dailyActivity.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newActivity] = await db.insert(dailyActivity).values({
      userId,
      date,
      sleepMinutes,
      sleepEfficiency: sleepEfficiency ?? null,
      source: 'manual_sleep',
      steps: 0,
      caloriesBurned: 0,
      activeMinutes: 0,
    }).returning();
    return newActivity;
  }

  // Device Metrics Raw operations (multi-device support)
  async getDeviceMetricsRaw(userId: string, date: string): Promise<DeviceMetricsRaw[]> {
    return db
      .select()
      .from(deviceMetricsRaw)
      .where(
        and(
          eq(deviceMetricsRaw.userId, userId),
          eq(deviceMetricsRaw.date, date)
        )
      );
  }

  async upsertDeviceMetricsRaw(metrics: InsertDeviceMetricsRaw): Promise<DeviceMetricsRaw> {
    const [existing] = await db
      .select()
      .from(deviceMetricsRaw)
      .where(
        and(
          eq(deviceMetricsRaw.userId, metrics.userId),
          eq(deviceMetricsRaw.date, metrics.date),
          eq(deviceMetricsRaw.sourceDevice, metrics.sourceDevice)
        )
      );
    
    if (existing) {
      const filteredMetrics = Object.fromEntries(
        Object.entries(metrics).filter(([key, v]) => {
          if (v === undefined || v === null) return false;
          if (key === 'sleepMinutes' && v === 0 && existing.sleepMinutes && existing.sleepMinutes > 0) {
            return false;
          }
          if (key === 'sleepEfficiency' && v === 0 && existing.sleepEfficiency && existing.sleepEfficiency > 0) {
            return false;
          }
          return true;
        })
      );
      
      const [updated] = await db
        .update(deviceMetricsRaw)
        .set({ 
          ...filteredMetrics, 
          syncedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(deviceMetricsRaw.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newMetrics] = await db.insert(deviceMetricsRaw).values(metrics).returning();
    return newMetrics;
  }

  async resolveAndSaveDailyActivity(userId: string, date: string): Promise<DailyActivity> {
    // Get all raw device metrics for this date
    const rawMetrics = await this.getDeviceMetricsRaw(userId, date);
    
    // Get user's primary device preference
    const user = await this.getUser(userId);
    const primaryDevice = user?.primaryDevice as RawDeviceMetric['sourceDevice'] | null;
    
    // Convert to the format expected by the conflict resolver
    const metricsForResolver: RawDeviceMetric[] = rawMetrics.map(m => ({
      sourceDevice: m.sourceDevice as RawDeviceMetric['sourceDevice'],
      steps: m.steps,
      caloriesBurned: m.caloriesBurned,
      activeMinutes: m.activeMinutes,
      distance: m.distance,
      floors: m.floors,
      restingHeartRate: m.restingHeartRate,
      averageHeartRate: m.averageHeartRate,
      maxHeartRate: m.maxHeartRate,
      heartRateZones: m.heartRateZones,
      hrvRmssd: m.hrvRmssd,
      hrvScore: m.hrvScore,
      sleepMinutes: m.sleepMinutes,
      sleepEfficiency: m.sleepEfficiency,
      sleepStages: m.sleepStages,
      timeInBed: m.timeInBed,
      activities: m.activities,
      syncedAt: m.syncedAt,
      isEvaluationData: m.isEvaluationData || false,
    }));
    
    // Resolve conflicts
    const resolved = resolveDeviceConflicts(primaryDevice, metricsForResolver);
    
    // Save resolved data to daily_activity
    return this.upsertDailyActivity({
      userId,
      date,
      steps: resolved.steps,
      caloriesBurned: resolved.caloriesBurned,
      activeMinutes: resolved.activeMinutes,
      distance: resolved.distance,
      floors: resolved.floors,
      restingHeartRate: resolved.restingHeartRate,
      averageHeartRate: resolved.averageHeartRate,
      maxHeartRate: resolved.maxHeartRate,
      heartRateZones: resolved.heartRateZones,
      hrvRmssd: resolved.hrvRmssd,
      hrvScore: resolved.hrvScore,
      sleepMinutes: resolved.sleepMinutes,
      sleepEfficiency: resolved.sleepEfficiency,
      sleepStages: resolved.sleepStages,
      timeInBed: resolved.timeInBed,
      activities: resolved.activities,
      source: resolved.source,
    });
  }

  // Bodyweight Entry operations (for trend tracking)
  async getBodyweightEntries(userId: string, startDate: string, endDate: string): Promise<BodyweightEntry[]> {
    const allEntries = await db
      .select()
      .from(bodyweightEntries)
      .where(
        and(
          eq(bodyweightEntries.userId, userId),
          gte(bodyweightEntries.date, startDate),
          lte(bodyweightEntries.date, endDate)
        )
      )
      .orderBy(desc(bodyweightEntries.date));
    
    const dateMap = new Map<string, BodyweightEntry>();
    for (const entry of allEntries) {
      const existing = dateMap.get(entry.date);
      if (!existing) {
        if (!entry.hidden) {
          dateMap.set(entry.date, entry);
        }
      } else if (entry.source === 'manual' && !entry.hidden) {
        dateMap.set(entry.date, entry);
      }
    }
    
    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  async getBodyweightEntry(id: string): Promise<BodyweightEntry | undefined> {
    const [entry] = await db
      .select()
      .from(bodyweightEntries)
      .where(eq(bodyweightEntries.id, id));
    return entry;
  }

  async createBodyweightEntry(entry: InsertBodyweightEntry): Promise<BodyweightEntry> {
    const [newEntry] = await db.insert(bodyweightEntries).values(entry).returning();
    return newEntry;
  }

  async upsertBodyweightEntry(entry: InsertBodyweightEntry): Promise<BodyweightEntry> {
    const [existing] = await db
      .select()
      .from(bodyweightEntries)
      .where(
        and(
          eq(bodyweightEntries.userId, entry.userId),
          eq(bodyweightEntries.date, entry.date)
        )
      );
    if (existing) {
      const [updated] = await db
        .update(bodyweightEntries)
        .set({ 
          weight: entry.weight,
          source: entry.source,
          notes: entry.notes
        })
        .where(eq(bodyweightEntries.id, existing.id))
        .returning();
      return updated;
    }
    return this.createBodyweightEntry(entry);
  }

  async deleteBodyweightEntry(id: string): Promise<boolean> {
    const result = await db
      .delete(bodyweightEntries)
      .where(eq(bodyweightEntries.id, id))
      .returning();
    return result.length > 0;
  }

  async getLatestBodyweightEntry(userId: string): Promise<BodyweightEntry | undefined> {
    const [entry] = await db
      .select()
      .from(bodyweightEntries)
      .where(eq(bodyweightEntries.userId, userId))
      .orderBy(desc(bodyweightEntries.date))
      .limit(1);
    return entry;
  }

  async updateBodyweightEntryHidden(id: string, hidden: boolean): Promise<BodyweightEntry | undefined> {
    const [updated] = await db
      .update(bodyweightEntries)
      .set({ hidden })
      .where(eq(bodyweightEntries.id, id))
      .returning();
    return updated;
  }

  // Body Measurement operations (weekly body composition)
  async getBodyMeasurements(userId: string, startDate: string, endDate: string): Promise<BodyMeasurement[]> {
    return db
      .select()
      .from(bodyMeasurements)
      .where(
        and(
          eq(bodyMeasurements.userId, userId),
          gte(bodyMeasurements.date, startDate),
          lte(bodyMeasurements.date, endDate)
        )
      )
      .orderBy(desc(bodyMeasurements.date));
  }

  async getBodyMeasurement(id: string): Promise<BodyMeasurement | undefined> {
    const [entry] = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.id, id));
    return entry;
  }

  async getLatestBodyMeasurement(userId: string): Promise<BodyMeasurement | undefined> {
    const [entry] = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.userId, userId))
      .orderBy(desc(bodyMeasurements.date))
      .limit(1);
    return entry;
  }

  async createBodyMeasurement(entry: InsertBodyMeasurement): Promise<BodyMeasurement> {
    const [newEntry] = await db.insert(bodyMeasurements).values(entry).returning();
    return newEntry;
  }

  async updateBodyMeasurement(id: string, updates: Partial<InsertBodyMeasurement>): Promise<BodyMeasurement | undefined> {
    const [updated] = await db
      .update(bodyMeasurements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bodyMeasurements.id, id))
      .returning();
    return updated;
  }

  async deleteBodyMeasurement(id: string): Promise<boolean> {
    const result = await db
      .delete(bodyMeasurements)
      .where(eq(bodyMeasurements.id, id))
      .returning();
    return result.length > 0;
  }

  // User goals operations
  async updateUserGoals(userId: string, goals: { dailyCalorieGoal?: number; dailyProteinGoal?: number; dailyCarbsGoal?: number; dailyFatsGoal?: number }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...goals, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Terms & Conditions
  async acceptTerms(userId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        termsAccepted: true, 
        termsAcceptedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Profile setup
  async updateUserProfile(userId: string, profile: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        ...profile,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Account deactivation
  async deactivateUser(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        isActive: false,
        deactivatedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // User Fitness Profile operations
  async getUserFitnessProfile(userId: string): Promise<UserFitnessProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userFitnessProfiles)
      .where(eq(userFitnessProfiles.userId, userId));
    return profile;
  }

  async upsertUserFitnessProfile(profile: InsertUserFitnessProfile): Promise<UserFitnessProfile> {
    const [result] = await db
      .insert(userFitnessProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: userFitnessProfiles.userId,
        set: {
          ...profile,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateFatigueLevel(userId: string, fatigueLevel: number): Promise<UserFitnessProfile | undefined> {
    const [updated] = await db
      .update(userFitnessProfiles)
      .set({ 
        fatigueLevel, 
        lastFatigueUpdate: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(userFitnessProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Milestone operations
  async getMilestones(userId: string): Promise<Milestone[]> {
    return await db
      .select()
      .from(milestones)
      .where(eq(milestones.userId, userId))
      .orderBy(desc(milestones.createdAt));
  }

  async getMilestone(id: string): Promise<Milestone | undefined> {
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id));
    return milestone;
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [newMilestone] = await db.insert(milestones).values(milestone).returning();
    return newMilestone;
  }

  async updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const [updated] = await db
      .update(milestones)
      .set(updates)
      .where(eq(milestones.id, id))
      .returning();
    return updated;
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const result = await db.delete(milestones).where(eq(milestones.id, id)).returning();
    return result.length > 0;
  }

  async completeMilestone(id: string): Promise<Milestone | undefined> {
    const [updated] = await db
      .update(milestones)
      .set({ 
        status: "completed", 
        completedAt: new Date() 
      })
      .where(eq(milestones.id, id))
      .returning();
    return updated;
  }

  // Scheduled Workout operations
  async getScheduledWorkouts(userId: string, startDate: Date, endDate: Date): Promise<ScheduledWorkout[]> {
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, startDate),
          lte(scheduledWorkouts.scheduledDate, endDate)
        )
      )
      .orderBy(scheduledWorkouts.scheduledDate);
  }

  async getScheduledWorkout(id: string): Promise<ScheduledWorkout | undefined> {
    const [workout] = await db.select().from(scheduledWorkouts).where(eq(scheduledWorkouts.id, id));
    return workout;
  }

  async getScheduledWorkoutsByWeek(userId: string, weekNumber: number): Promise<ScheduledWorkout[]> {
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          eq(scheduledWorkouts.weekNumber, weekNumber)
        )
      )
      .orderBy(scheduledWorkouts.scheduledDate);
  }

  async createScheduledWorkout(workout: InsertScheduledWorkout): Promise<ScheduledWorkout> {
    const [newWorkout] = await db.insert(scheduledWorkouts).values(workout).returning();
    return newWorkout;
  }

  async updateScheduledWorkout(id: string, updates: Partial<InsertScheduledWorkout>): Promise<ScheduledWorkout | undefined> {
    const [updated] = await db
      .update(scheduledWorkouts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(scheduledWorkouts.id, id))
      .returning();
    return updated;
  }

  async deleteScheduledWorkout(id: string): Promise<boolean> {
    const result = await db.delete(scheduledWorkouts).where(eq(scheduledWorkouts.id, id)).returning();
    return result.length > 0;
  }

  async deleteScheduledWorkoutsInRange(userId: string, fromDate: Date, toDate: Date): Promise<number> {
    const result = await db
      .delete(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, fromDate),
          lte(scheduledWorkouts.scheduledDate, toDate),
          eq(scheduledWorkouts.status, "scheduled")
        )
      )
      .returning();
    return result.length;
  }

  async findScheduledWorkoutByDateAndTitle(userId: string, scheduledDate: Date, title: string): Promise<ScheduledWorkout | undefined> {
    // Find workouts on the same calendar day with similar title
    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const [existing] = await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, dayStart),
          lte(scheduledWorkouts.scheduledDate, dayEnd),
          eq(scheduledWorkouts.title, title)
        )
      )
      .limit(1);
    return existing;
  }

  async completeScheduledWorkout(id: string, feedback?: 'easy' | 'moderate' | 'hard'): Promise<ScheduledWorkout | undefined> {
    const [updated] = await db
      .update(scheduledWorkouts)
      .set({ 
        status: "completed", 
        completedAt: new Date(),
        performanceFeedback: feedback,
        updatedAt: new Date() 
      })
      .where(eq(scheduledWorkouts.id, id))
      .returning();
    return updated;
  }

  async completeMatchingScheduledWorkouts(userId: string, title: string, date: Date): Promise<number> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const result = await db
      .update(scheduledWorkouts)
      .set({ 
        status: "completed", 
        completedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          eq(scheduledWorkouts.title, title),
          gte(scheduledWorkouts.scheduledDate, dayStart),
          lte(scheduledWorkouts.scheduledDate, dayEnd),
          eq(scheduledWorkouts.status, "scheduled")
        )
      )
      .returning();
    return result.length;
  }

  async getUpcomingWorkouts(userId: string, limit: number = 7): Promise<ScheduledWorkout[]> {
    const now = new Date();
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          gte(scheduledWorkouts.scheduledDate, now),
          eq(scheduledWorkouts.status, "scheduled")
        )
      )
      .orderBy(scheduledWorkouts.scheduledDate)
      .limit(limit);
  }

  async getRecentCompletedWorkouts(userId: string, limit: number = 10): Promise<ScheduledWorkout[]> {
    return await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          eq(scheduledWorkouts.status, "completed")
        )
      )
      .orderBy(desc(scheduledWorkouts.completedAt))
      .limit(limit);
  }

  // Admin operations
  async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    signupsThisMonth: number;
    signupsThisWeek: number;
    usersWithCompleteProfiles: number;
    totalMessages: number;
    totalFoodEntries: number;
    totalWorkoutLogs: number;
    messagesThisWeek: number;
    totalGoalsAssigned: number;
    goalsCompletedThisWeek: number;
    goalsCompletedThisMonth: number;
    activeGoals: number;
  }> {
    const now = new Date();
    // Use UTC for consistent timezone handling with database timestamps
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isActive, true));
    const [premiumResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.subscriptionType, 'premium'));
    const [monthResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, startOfMonth));
    const [weekResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(gte(users.createdAt, startOfWeek));
    const [profileCompleteResult] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.profileComplete, true));
    const [messagesResult] = await db.select({ count: sql<number>`count(*)` }).from(chatMessages);
    const [workoutResult] = await db.select({ count: sql<number>`count(*)` }).from(workoutLogs);
    const [messagesWeekResult] = await db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(gte(chatMessages.createdAt, startOfWeek));

    // Goal tracking stats
    const [totalGoalsResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals);
    const [activeGoalsResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals).where(eq(athleteGoals.status, 'active'));
    const [goalsWeekResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals)
      .where(and(eq(athleteGoals.status, 'completed'), gte(athleteGoals.completedAt, startOfWeek)));
    const [goalsMonthResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals)
      .where(and(eq(athleteGoals.status, 'completed'), gte(athleteGoals.completedAt, startOfMonth)));

    return {
      totalUsers: Number(totalResult?.count || 0),
      activeUsers: Number(activeResult?.count || 0),
      premiumUsers: Number(premiumResult?.count || 0),
      signupsThisMonth: Number(monthResult?.count || 0),
      signupsThisWeek: Number(weekResult?.count || 0),
      usersWithCompleteProfiles: Number(profileCompleteResult?.count || 0),
      totalMessages: Number(messagesResult?.count || 0),
      totalFoodEntries: 0,
      totalWorkoutLogs: Number(workoutResult?.count || 0),
      messagesThisWeek: Number(messagesWeekResult?.count || 0),
      totalGoalsAssigned: Number(totalGoalsResult?.count || 0),
      goalsCompletedThisWeek: Number(goalsWeekResult?.count || 0),
      goalsCompletedThisMonth: Number(goalsMonthResult?.count || 0),
      activeGoals: Number(activeGoalsResult?.count || 0),
    };
  }

  async getRecentUsers(limit: number): Promise<{
    id: string;
    firstName: string | null;
    email: string | null;
    createdAt: Date | null;
    subscriptionType: string | null;
    profileComplete: boolean | null;
  }[]> {
    const recentUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        email: users.email,
        createdAt: users.createdAt,
        subscriptionType: users.subscriptionType,
        profileComplete: users.profileComplete,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit);
    return recentUsers;
  }

  async getUserEmailsForExport(): Promise<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    subscriptionType: string | null;
    signupDate: Date | null;
  }[]> {
    const userEmails = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionType: users.subscriptionType,
        signupDate: users.createdAt,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(desc(users.createdAt));
    
    return userEmails.filter(u => u.email !== null) as {
      email: string;
      firstName: string | null;
      lastName: string | null;
      subscriptionType: string | null;
      signupDate: Date | null;
    }[];
  }

  // Athlete Goals operations
  async getAthleteGoals(userId: string, status?: string): Promise<AthleteGoal[]> {
    if (status) {
      return await db.select().from(athleteGoals)
        .where(and(eq(athleteGoals.userId, userId), eq(athleteGoals.status, status)))
        .orderBy(desc(athleteGoals.createdAt));
    }
    return await db.select().from(athleteGoals)
      .where(eq(athleteGoals.userId, userId))
      .orderBy(desc(athleteGoals.createdAt));
  }

  async getActiveGoals(userId: string): Promise<AthleteGoal[]> {
    return await db.select().from(athleteGoals)
      .where(and(eq(athleteGoals.userId, userId), eq(athleteGoals.status, 'active')))
      .orderBy(desc(athleteGoals.createdAt));
  }

  async getAthleteGoal(id: string): Promise<AthleteGoal | undefined> {
    const [goal] = await db.select().from(athleteGoals).where(eq(athleteGoals.id, id));
    return goal;
  }

  async createAthleteGoal(goal: InsertAthleteGoal): Promise<AthleteGoal> {
    const [newGoal] = await db.insert(athleteGoals).values(goal).returning();
    return newGoal;
  }

  async updateAthleteGoal(id: string, updates: Partial<InsertAthleteGoal>): Promise<AthleteGoal | undefined> {
    const [updated] = await db.update(athleteGoals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(athleteGoals.id, id))
      .returning();
    return updated;
  }

  async updateGoalProgress(id: string, currentValue: number): Promise<AthleteGoal | undefined> {
    const goal = await this.getAthleteGoal(id);
    if (!goal) return undefined;

    const updates: Partial<AthleteGoal> = {
      currentValue,
      updatedAt: new Date(),
    };

    // Auto-complete if target reached
    if (goal.targetValue && currentValue >= goal.targetValue) {
      updates.status = 'completed';
      updates.completedAt = new Date();
    }

    const [updated] = await db.update(athleteGoals)
      .set(updates)
      .where(eq(athleteGoals.id, id))
      .returning();
    return updated;
  }

  async completeGoal(id: string): Promise<AthleteGoal | undefined> {
    const [completed] = await db.update(athleteGoals)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(athleteGoals.id, id))
      .returning();
    return completed;
  }

  async deleteAthleteGoal(id: string): Promise<boolean> {
    const result = await db.delete(athleteGoals).where(eq(athleteGoals.id, id)).returning();
    return result.length > 0;
  }

  async getGoalStats(userId: string): Promise<{ completed: number; active: number; failed: number }> {
    const [completedResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals)
      .where(and(eq(athleteGoals.userId, userId), eq(athleteGoals.status, 'completed')));
    const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals)
      .where(and(eq(athleteGoals.userId, userId), eq(athleteGoals.status, 'active')));
    const [failedResult] = await db.select({ count: sql<number>`count(*)` }).from(athleteGoals)
      .where(and(eq(athleteGoals.userId, userId), eq(athleteGoals.status, 'failed')));

    return {
      completed: Number(completedResult?.count || 0),
      active: Number(activeResult?.count || 0),
      failed: Number(failedResult?.count || 0),
    };
  }

  // Referral operations
  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, code));
    return user;
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (user?.referralCode) {
      return user.referralCode;
    }
    
    // Generate a unique 8-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    await db.update(users)
      .set({ referralCode: code, updatedAt: new Date() })
      .where(eq(users.id, userId));
    
    return code;
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [newReferral] = await db.insert(referrals).values(referral).returning();
    return newReferral;
  }

  async getReferralsByReferrer(referrerId: string): Promise<Referral[]> {
    return await db.select().from(referrals)
      .where(eq(referrals.referrerId, referrerId))
      .orderBy(desc(referrals.createdAt));
  }

  async getPaidReferralCount(referrerId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(and(
        eq(referrals.referrerId, referrerId),
        eq(referrals.status, 'paid')
      ));
    return Number(result?.count || 0);
  }

  async markReferralPaid(referredId: string): Promise<Referral | undefined> {
    const [updated] = await db.update(referrals)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(referrals.referredId, referredId))
      .returning();
    return updated;
  }

  async rewardReferrer(referrerId: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ 
        freeMonthsEarned: sql`COALESCE(free_months_earned, 0) + 1`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, referrerId))
      .returning();
    return updated;
  }

  // Challenge operations
  async getChallenges(activeOnly: boolean = true): Promise<Challenge[]> {
    if (activeOnly) {
      return await db.select().from(challenges)
        .where(eq(challenges.isActive, true))
        .orderBy(desc(challenges.createdAt));
    }
    return await db.select().from(challenges).orderBy(desc(challenges.createdAt));
  }

  async getChallenge(id: string): Promise<Challenge | undefined> {
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id));
    return challenge;
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const [newChallenge] = await db.insert(challenges).values(challenge).returning();
    return newChallenge;
  }

  async joinChallenge(participation: InsertChallengeParticipant): Promise<ChallengeParticipant> {
    const [participant] = await db.insert(challengeParticipants).values(participation).returning();
    return participant;
  }

  async getUserChallenges(userId: string): Promise<(ChallengeParticipant & { challenge: Challenge })[]> {
    const results = await db.select({
      id: challengeParticipants.id,
      challengeId: challengeParticipants.challengeId,
      userId: challengeParticipants.userId,
      joinedAt: challengeParticipants.joinedAt,
      currentDay: challengeParticipants.currentDay,
      completedDays: challengeParticipants.completedDays,
      totalPoints: challengeParticipants.totalPoints,
      streak: challengeParticipants.streak,
      status: challengeParticipants.status,
      completedAt: challengeParticipants.completedAt,
      challenge: challenges,
    })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challengeParticipants.challengeId, challenges.id))
    .where(eq(challengeParticipants.userId, userId))
    .orderBy(desc(challengeParticipants.joinedAt));

    return results.map(r => ({
      id: r.id,
      challengeId: r.challengeId,
      userId: r.userId,
      joinedAt: r.joinedAt,
      currentDay: r.currentDay,
      completedDays: r.completedDays,
      totalPoints: r.totalPoints,
      streak: r.streak,
      status: r.status,
      completedAt: r.completedAt,
      challenge: r.challenge,
    }));
  }

  async getChallengeParticipant(challengeId: string, userId: string): Promise<ChallengeParticipant | undefined> {
    const [participant] = await db.select().from(challengeParticipants)
      .where(and(
        eq(challengeParticipants.challengeId, challengeId),
        eq(challengeParticipants.userId, userId)
      ));
    return participant;
  }

  async updateChallengeProgress(participantId: string, dayCompleted: number): Promise<ChallengeParticipant | undefined> {
    const participant = await db.select().from(challengeParticipants)
      .where(eq(challengeParticipants.id, participantId));
    
    if (!participant[0]) return undefined;

    const currentDays = (participant[0].completedDays as number[]) || [];
    if (!currentDays.includes(dayCompleted)) {
      currentDays.push(dayCompleted);
    }

    const [updated] = await db.update(challengeParticipants)
      .set({
        completedDays: currentDays,
        currentDay: Math.max(participant[0].currentDay || 0, dayCompleted),
        totalPoints: (participant[0].totalPoints || 0) + 10,
        streak: dayCompleted === (participant[0].currentDay || 0) + 1 
          ? (participant[0].streak || 0) + 1 
          : 1,
      })
      .where(eq(challengeParticipants.id, participantId))
      .returning();
    
    return updated;
  }

  async getChallengeLeaderboard(challengeId: string, limit: number = 50): Promise<(ChallengeParticipant & { user: Pick<User, 'id' | 'firstName' | 'profileImageUrl'> })[]> {
    const results = await db.select({
      id: challengeParticipants.id,
      challengeId: challengeParticipants.challengeId,
      userId: challengeParticipants.userId,
      joinedAt: challengeParticipants.joinedAt,
      currentDay: challengeParticipants.currentDay,
      completedDays: challengeParticipants.completedDays,
      totalPoints: challengeParticipants.totalPoints,
      streak: challengeParticipants.streak,
      status: challengeParticipants.status,
      completedAt: challengeParticipants.completedAt,
      user: {
        id: users.id,
        firstName: users.firstName,
        profileImageUrl: users.profileImageUrl,
      },
    })
    .from(challengeParticipants)
    .innerJoin(users, eq(challengeParticipants.userId, users.id))
    .where(eq(challengeParticipants.challengeId, challengeId))
    .orderBy(desc(challengeParticipants.totalPoints))
    .limit(limit);

    return results.map(r => ({
      id: r.id,
      challengeId: r.challengeId,
      userId: r.userId,
      joinedAt: r.joinedAt,
      currentDay: r.currentDay,
      completedDays: r.completedDays,
      totalPoints: r.totalPoints,
      streak: r.streak,
      status: r.status,
      completedAt: r.completedAt,
      user: r.user,
    }));
  }

  async getUserProgressStats(userId: string): Promise<{
    workoutsCompleted: number;
    totalCaloriesLogged: number;
    currentStreak: number;
    challengesCompleted: number;
  }> {
    const workoutsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId));
    
    const workoutsCompleted = Number(workoutsResult[0]?.count || 0);
    
    const totalCaloriesLogged = 0;
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let streak = 0;
    let checkDate = startOfToday;
    
    for (let i = 0; i < 365; i++) {
      const dayStart = new Date(checkDate);
      const dayEnd = new Date(checkDate);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayActivity = await db
        .select({ count: sql<number>`count(*)` })
        .from(workoutLogs)
        .where(
          and(
            eq(workoutLogs.userId, userId),
            gte(workoutLogs.date, dayStart),
            lt(workoutLogs.date, dayEnd)
          )
        );
      
      if (Number(dayActivity[0]?.count || 0) > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    const challengesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.userId, userId),
          eq(challengeParticipants.status, 'completed')
        )
      );
    
    const challengesCompleted = Number(challengesResult[0]?.count || 0);
    
    return {
      workoutsCompleted,
      totalCaloriesLogged,
      currentStreak: streak,
      challengesCompleted,
    };
  }

  async getWorkoutCountsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          gte(workoutLogs.date, startDate),
          lte(workoutLogs.date, endDate)
        )
      );
    return Number(result[0]?.count || 0);
  }

  // Feedback operations
  async createFeedback(feedback: { userId?: string; rating: number; category?: string; comment?: string; userEmail?: string; pageUrl?: string }): Promise<{ id: string; rating: number }> {
    const [result] = await db.insert(userFeedback).values({
      userId: feedback.userId || null,
      rating: feedback.rating,
      category: feedback.category || 'general',
      comment: feedback.comment || null,
      userEmail: feedback.userEmail || null,
      pageUrl: feedback.pageUrl || null,
      status: 'open',
    }).returning({ id: userFeedback.id, rating: userFeedback.rating });
    return result;
  }

  async getFeedbackStats(): Promise<{ 
    totalFeedback: number; 
    averageRating: number; 
    feedbackByCategory: { category: string; count: number }[];
    recentFeedback: { id: string; rating: number; category: string | null; comment: string | null; userEmail: string | null; status: string | null; createdAt: Date | null }[];
    openFeedbackCount: number;
  }> {
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(userFeedback);
    const totalFeedback = Number(totalResult[0]?.count || 0);

    const avgResult = await db.select({ avg: sql<number>`coalesce(avg(rating), 0)` }).from(userFeedback);
    const averageRating = Number(avgResult[0]?.avg || 0);

    const categoryResult = await db
      .select({ category: userFeedback.category, count: sql<number>`count(*)` })
      .from(userFeedback)
      .groupBy(userFeedback.category);
    
    const feedbackByCategory = categoryResult.map(r => ({
      category: r.category || 'general',
      count: Number(r.count),
    }));

    const recentResult = await db
      .select({
        id: userFeedback.id,
        rating: userFeedback.rating,
        category: userFeedback.category,
        comment: userFeedback.comment,
        userEmail: userFeedback.userEmail,
        status: userFeedback.status,
        createdAt: userFeedback.createdAt,
      })
      .from(userFeedback)
      .orderBy(desc(userFeedback.createdAt))
      .limit(20);

    const openResult = await db.select({ count: sql<number>`count(*)` }).from(userFeedback).where(eq(userFeedback.status, 'open'));
    const openFeedbackCount = Number(openResult[0]?.count || 0);

    return { totalFeedback, averageRating, feedbackByCategory, recentFeedback: recentResult, openFeedbackCount };
  }

  async updateFeedbackStatus(id: string, status: string, adminNotes?: string): Promise<void> {
    const updates: any = { status };
    if (status === 'resolved') {
      updates.resolvedAt = new Date();
    }
    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes;
    }
    await db.update(userFeedback).set(updates).where(eq(userFeedback.id, id));
  }

  // Streak operations
  async getUserStreak(userId: string, streakType: string = 'daily_checkin'): Promise<{ currentStreak: number; longestStreak: number; lastActivityDate: Date | null } | undefined> {
    const [streak] = await db
      .select()
      .from(userStreaks)
      .where(and(eq(userStreaks.userId, userId), eq(userStreaks.streakType, streakType)));
    
    if (!streak) return undefined;
    
    return {
      currentStreak: streak.currentStreak || 0,
      longestStreak: streak.longestStreak || 0,
      lastActivityDate: streak.lastActivityDate,
    };
  }

  async updateStreak(userId: string, streakType: string = 'daily_checkin'): Promise<{ currentStreak: number; longestStreak: number }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const existing = await this.getUserStreak(userId, streakType);
    
    if (!existing) {
      const [newStreak] = await db.insert(userStreaks).values({
        userId,
        streakType,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: now,
      }).returning();
      return { currentStreak: 1, longestStreak: 1 };
    }

    const lastDate = existing.lastActivityDate;
    let newCurrentStreak = existing.currentStreak;
    
    if (lastDate) {
      const lastDateNorm = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      
      if (lastDateNorm.getTime() === today.getTime()) {
        return { currentStreak: existing.currentStreak, longestStreak: existing.longestStreak };
      } else if (lastDateNorm.getTime() === yesterday.getTime()) {
        newCurrentStreak = existing.currentStreak + 1;
      } else {
        newCurrentStreak = 1;
      }
    } else {
      newCurrentStreak = 1;
    }

    const newLongestStreak = Math.max(newCurrentStreak, existing.longestStreak);

    await db.update(userStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: now,
        updatedAt: now,
      })
      .where(and(eq(userStreaks.userId, userId), eq(userStreaks.streakType, streakType)));

    return { currentStreak: newCurrentStreak, longestStreak: newLongestStreak };
  }

  // Coaching Engine operations
  async getUserCoachingPreferences(userId: string): Promise<UserCoachingPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userCoachingPreferences)
      .where(eq(userCoachingPreferences.userId, userId));
    return prefs;
  }

  async upsertUserCoachingPreferences(prefs: InsertUserCoachingPreferences): Promise<UserCoachingPreferences> {
    const [result] = await db
      .insert(userCoachingPreferences)
      .values(prefs)
      .onConflictDoUpdate({
        target: userCoachingPreferences.userId,
        set: {
          ...prefs,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getWeeklyCheckIns(userId: string, limit: number = 4): Promise<WeeklyCheckIn[]> {
    return await db
      .select()
      .from(weeklyCheckIns)
      .where(eq(weeklyCheckIns.userId, userId))
      .orderBy(desc(weeklyCheckIns.year), desc(weeklyCheckIns.weekNumber))
      .limit(limit);
  }

  async getWeeklyCheckIn(userId: string, weekNumber: number, year: number): Promise<WeeklyCheckIn | undefined> {
    const [checkIn] = await db
      .select()
      .from(weeklyCheckIns)
      .where(and(
        eq(weeklyCheckIns.userId, userId),
        eq(weeklyCheckIns.weekNumber, weekNumber),
        eq(weeklyCheckIns.year, year)
      ));
    return checkIn;
  }

  async upsertWeeklyCheckIn(checkIn: InsertWeeklyCheckIn): Promise<WeeklyCheckIn> {
    const existing = await this.getWeeklyCheckIn(checkIn.userId, checkIn.weekNumber, checkIn.year);
    
    if (existing) {
      const [updated] = await db
        .update(weeklyCheckIns)
        .set({ ...checkIn, updatedAt: new Date() })
        .where(eq(weeklyCheckIns.id, existing.id))
        .returning();
      return updated;
    }
    
    const [result] = await db.insert(weeklyCheckIns).values(checkIn).returning();
    return result;
  }

  async getMuscleVolumeTracking(userId: string, weekNumber: number, year: number): Promise<MuscleVolumeTracking | undefined> {
    const [volume] = await db
      .select()
      .from(muscleVolumeTracking)
      .where(and(
        eq(muscleVolumeTracking.userId, userId),
        eq(muscleVolumeTracking.weekNumber, weekNumber),
        eq(muscleVolumeTracking.year, year)
      ));
    return volume;
  }

  async upsertMuscleVolumeTracking(volume: InsertMuscleVolumeTracking): Promise<MuscleVolumeTracking> {
    const existing = await this.getMuscleVolumeTracking(volume.userId, volume.weekNumber, volume.year);
    
    if (existing) {
      const [updated] = await db
        .update(muscleVolumeTracking)
        .set(volume)
        .where(eq(muscleVolumeTracking.id, existing.id))
        .returning();
      return updated;
    }
    
    const [result] = await db.insert(muscleVolumeTracking).values(volume).returning();
    return result;
  }

  async getExercisePerformanceLogs(userId: string, limit: number = 20): Promise<ExercisePerformanceLog[]> {
    return await db
      .select()
      .from(exercisePerformanceLogs)
      .where(eq(exercisePerformanceLogs.userId, userId))
      .orderBy(desc(exercisePerformanceLogs.performedAt))
      .limit(limit);
  }

  async getExerciseHistory(userId: string, exerciseName: string, limit: number = 10): Promise<ExercisePerformanceLog[]> {
    return await db
      .select()
      .from(exercisePerformanceLogs)
      .where(and(
        eq(exercisePerformanceLogs.userId, userId),
        eq(exercisePerformanceLogs.exerciseName, exerciseName)
      ))
      .orderBy(desc(exercisePerformanceLogs.performedAt))
      .limit(limit);
  }

  async createExercisePerformanceLog(log: InsertExercisePerformanceLog): Promise<ExercisePerformanceLog> {
    const [result] = await db.insert(exercisePerformanceLogs).values(log).returning();
    return result;
  }

  // Focus Group operations
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));
    return user;
  }

  async createFocusGroupUser(email: string, firstName?: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        firstName: firstName || null,
        userStatus: 'waitlist',
        emailVerified: false,
        profileComplete: false,
        subscriptionType: 'trial',
      })
      .returning();
    return user;
  }

  async setEmailVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async verifyEmail(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async activateUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        userStatus: 'active',
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deactivateToWaitlist(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        userStatus: 'waitlist',
        activatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getWaitlistUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.userStatus, 'waitlist'))
      .orderBy(desc(users.createdAt));
  }

  async getActiveUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.userStatus, 'active'))
      .orderBy(desc(users.activatedAt));
  }

  async markActivationEmailSent(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        activationEmailSent: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getFocusGroupStats(): Promise<{
    guestMessageCount: number;
    totalSignups: number;
    waitlistUsers: number;
    activeUsers: number;
    avgMessagesPerUser: number;
  }> {
    const [guestStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(sql`${chatMessages.userId} IS NULL OR ${chatMessages.userId} = ''`);
    
    const [totalSignups] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.userStatus} IN ('waitlist', 'active')`);
    
    const [waitlist] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.userStatus, 'waitlist'));
    
    const [active] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.userStatus, 'active'));
    
    const [msgStats] = await db
      .select({
        totalMessages: sql<number>`count(*)`,
        uniqueUsers: sql<number>`count(DISTINCT ${chatMessages.userId})`
      })
      .from(chatMessages)
      .where(sql`${chatMessages.userId} IS NOT NULL AND ${chatMessages.userId} != ''`);
    
    const avgMessages = msgStats.uniqueUsers > 0 
      ? Math.round(msgStats.totalMessages / msgStats.uniqueUsers) 
      : 0;
    
    return {
      guestMessageCount: Number(guestStats.count) || 0,
      totalSignups: Number(totalSignups.count) || 0,
      waitlistUsers: Number(waitlist.count) || 0,
      activeUsers: Number(active.count) || 0,
      avgMessagesPerUser: avgMessages,
    };
  }

  // Wearable Activity operations (for workout mode system)
  async getWearableActivities(userId: string, startDate: Date, endDate: Date): Promise<WearableActivity[]> {
    return await db
      .select()
      .from(wearableActivities)
      .where(
        and(
          eq(wearableActivities.userId, userId),
          gte(wearableActivities.date, startDate),
          lte(wearableActivities.date, endDate)
        )
      )
      .orderBy(desc(wearableActivities.date));
  }

  async getWearableActivity(id: string): Promise<WearableActivity | undefined> {
    const [activity] = await db
      .select()
      .from(wearableActivities)
      .where(eq(wearableActivities.id, id));
    return activity;
  }

  async getWearableActivityByDeviceId(userId: string, sourceDevice: string, deviceActivityId: string): Promise<WearableActivity | undefined> {
    const [activity] = await db
      .select()
      .from(wearableActivities)
      .where(
        and(
          eq(wearableActivities.userId, userId),
          eq(wearableActivities.sourceDevice, sourceDevice),
          eq(wearableActivities.deviceActivityId, deviceActivityId)
        )
      );
    return activity;
  }

  async getWearableActivityByGarminSummaryId(userId: string, summaryId: string): Promise<WearableActivity | undefined> {
    const [activity] = await db
      .select()
      .from(wearableActivities)
      .where(
        and(
          eq(wearableActivities.userId, userId),
          eq(wearableActivities.garminSummaryId, summaryId)
        )
      );
    return activity;
  }

  async createWearableActivity(activity: InsertWearableActivity): Promise<WearableActivity> {
    const [newActivity] = await db
      .insert(wearableActivities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async updateWearableActivity(id: string, updates: Partial<InsertWearableActivity>): Promise<WearableActivity | undefined> {
    const [updated] = await db
      .update(wearableActivities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(wearableActivities.id, id))
      .returning();
    return updated;
  }

  async linkWearableToWorkoutLog(wearableActivityId: string, workoutLogId: string): Promise<WearableActivity | undefined> {
    const [updated] = await db
      .update(wearableActivities)
      .set({ linkedWorkoutLogId: workoutLogId, updatedAt: new Date() })
      .where(eq(wearableActivities.id, wearableActivityId))
      .returning();
    return updated;
  }

  async getUnstructuredWearableActivities(userId: string, limit: number = 10): Promise<WearableActivity[]> {
    return await db
      .select()
      .from(wearableActivities)
      .where(
        and(
          eq(wearableActivities.userId, userId),
          sql`${wearableActivities.linkedWorkoutLogId} IS NULL`,
          sql`${wearableActivities.structurePromptResponse} IS NULL OR ${wearableActivities.structurePromptResponse} != 'no'`
        )
      )
      .orderBy(desc(wearableActivities.date))
      .limit(limit);
  }

  async getPendingWearableActivities(userId: string): Promise<WearableActivity[]> {
    return await db
      .select()
      .from(wearableActivities)
      .where(
        and(
          eq(wearableActivities.userId, userId),
          eq(wearableActivities.pendingConfirmation, true)
        )
      )
      .orderBy(desc(wearableActivities.date));
  }

  async confirmWearableActivity(id: string, workoutLogId?: string, confirmedBy: string = 'trainer'): Promise<WearableActivity | undefined> {
    const [updated] = await db
      .update(wearableActivities)
      .set({
        pendingConfirmation: false,
        confirmedAt: new Date(),
        confirmedBy,
        linkedWorkoutLogId: workoutLogId || undefined,
        updatedAt: new Date(),
      })
      .where(eq(wearableActivities.id, id))
      .returning();
    return updated;
  }

  async skipWearableConfirmation(id: string): Promise<WearableActivity | undefined> {
    const [updated] = await db
      .update(wearableActivities)
      .set({
        pendingConfirmation: false,
        confirmedAt: new Date(),
        confirmedBy: 'skipped',
        structurePromptResponse: 'skipped',
        updatedAt: new Date(),
      })
      .where(eq(wearableActivities.id, id))
      .returning();
    return updated;
  }

  async getWearableExerciseSets(wearableActivityId: string): Promise<WearableExerciseSet[]> {
    return await db
      .select()
      .from(wearableExerciseSets)
      .where(eq(wearableExerciseSets.wearableActivityId, wearableActivityId))
      .orderBy(wearableExerciseSets.exerciseOrder, wearableExerciseSets.setNumber);
  }

  async createWearableExerciseSets(sets: InsertWearableExerciseSet[]): Promise<WearableExerciseSet[]> {
    if (sets.length === 0) return [];
    return await db.insert(wearableExerciseSets).values(sets).returning();
  }

  async deleteWearableExerciseSets(wearableActivityId: string): Promise<number> {
    const result = await db
      .delete(wearableExerciseSets)
      .where(eq(wearableExerciseSets.wearableActivityId, wearableActivityId))
      .returning();
    return result.length;
  }

  async updateWearableActivityStructure(id: string, status: string, error?: string): Promise<WearableActivity | undefined> {
    const [updated] = await db
      .update(wearableActivities)
      .set({
        structureStatus: status,
        structureParsedAt: status === 'complete' ? new Date() : undefined,
        structureError: error || null,
        pendingConfirmation: status === 'complete' ? false : true,
        confirmedAt: status === 'complete' ? new Date() : undefined,
        confirmedBy: status === 'complete' ? 'garmin_fit' : undefined,
        updatedAt: new Date(),
      })
      .where(eq(wearableActivities.id, id))
      .returning();
    return updated;
  }

  async reconcileDetectedActivity(wearableActivity: WearableActivity): Promise<ScheduledWorkout | null> {
    const { userId, id: wearableActivityId, sourceDevice, activityName, activityType, date, duration, caloriesBurned, distance } = wearableActivity;
    
    // Check if a scheduledWorkout already exists linked to this wearable activity
    const [existingLinked] = await db
      .select()
      .from(scheduledWorkouts)
      .where(eq(scheduledWorkouts.linkedWearableActivityId, wearableActivityId));
    
    if (existingLinked) {
      return existingLinked; // Already reconciled
    }
    
    // Get the date portion of the wearable activity
    const activityDate = new Date(date);
    const dayStart = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    // Check if a scheduled workout exists for this day that matches the activity type
    // First, try to find one that matches the activity type
    const scheduledForDay = await db
      .select()
      .from(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.userId, userId),
          sql`${scheduledWorkouts.scheduledDate} >= ${dayStart} AND ${scheduledWorkouts.scheduledDate} < ${dayEnd}`,
          eq(scheduledWorkouts.status, 'scheduled')
        )
      )
      .orderBy(scheduledWorkouts.scheduledDate);
    
    // Find the best match based on activity type and time proximity
    // Score each scheduled workout and pick the best match
    let existingScheduled = null;
    
    if (scheduledForDay.length > 0) {
      // Score each scheduled workout for matching quality
      const scored = scheduledForDay.map(s => {
        let score = 0;
        
        // Type matching (highest priority)
        if (activityType && activityType.length > 0) {
          if (s.activityType === activityType) score += 100;
          if (s.workoutType === activityType) score += 100;
          if (s.title?.toLowerCase().includes(activityType.toLowerCase())) score += 50;
        }
        
        // Name matching
        if (activityName && activityName.length > 0) {
          if ((s.title || '').toLowerCase().includes(activityName.toLowerCase())) score += 75;
          if (activityName.toLowerCase().includes((s.title || '').toLowerCase())) score += 50;
        }
        
        // Time proximity - prefer scheduled workouts closest to the actual activity time
        const scheduledTime = new Date(s.scheduledDate).getTime();
        const actualTime = activityDate.getTime();
        const timeDiff = Math.abs(scheduledTime - actualTime);
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        // Give up to 30 points for being within 2 hours
        if (hoursDiff <= 2) score += 30;
        else if (hoursDiff <= 4) score += 20;
        else if (hoursDiff <= 8) score += 10;
        
        return { scheduled: s, score };
      });
      
      // Sort by score descending and pick the best match
      scored.sort((a, b) => b.score - a.score);
      
      // Only accept if we have a reasonable score (at least some match criteria)
      if (scored[0].score >= 30) {
        existingScheduled = scored[0].scheduled;
      }
    }
    
    // If no match found, fall back to first scheduled ONLY if there's exactly one
    if (!existingScheduled && scheduledForDay.length === 1) {
      existingScheduled = scheduledForDay[0];
    }
    
    if (existingScheduled) {
      // Update the existing scheduled workout to mark as completed and link to wearable
      const [updated] = await db
        .update(scheduledWorkouts)
        .set({
          status: 'completed',
          completedAt: activityDate,
          linkedWearableActivityId: wearableActivityId,
          duration: duration || existingScheduled.duration,
          dataSource: `detected_${sourceDevice}`,
          updatedAt: new Date(),
        })
        .where(eq(scheduledWorkouts.id, existingScheduled.id))
        .returning();
      return updated;
    }
    
    // No scheduled workout for this day - create a new completed one from the detected activity
    const dataSource = `detected_${sourceDevice}`;
    const [newScheduledWorkout] = await db
      .insert(scheduledWorkouts)
      .values({
        userId,
        scheduledDate: activityDate,
        dayOfWeek: activityDate.toLocaleDateString('en-US', { weekday: 'long' }),
        timeSlot: 'flexible',
        workoutType: activityType || 'general',
        activityType: activityType || 'general',
        title: activityName,
        duration: duration || null,
        intensity: 'moderate',
        status: 'completed',
        completedAt: activityDate,
        linkedWearableActivityId: wearableActivityId,
        dataSource,
        aiGenerated: false,
      })
      .returning();
    
    console.log(`[Reconcile] Created completed activity from ${sourceDevice}: ${activityName} on ${activityDate.toISOString().split('T')[0]}`);
    return newScheduledWorkout;
  }

  // Planned Exercise operations (RP Hypertrophy style)
  async getPlannedExercises(scheduledWorkoutId: string): Promise<PlannedExercise[]> {
    return await db
      .select()
      .from(plannedExercises)
      .where(eq(plannedExercises.scheduledWorkoutId, scheduledWorkoutId))
      .orderBy(plannedExercises.exerciseOrder);
  }

  async getPlannedExercise(id: string): Promise<PlannedExercise | undefined> {
    const [exercise] = await db
      .select()
      .from(plannedExercises)
      .where(eq(plannedExercises.id, id));
    return exercise;
  }

  async createPlannedExercise(exercise: InsertPlannedExercise): Promise<PlannedExercise> {
    const [newExercise] = await db
      .insert(plannedExercises)
      .values(exercise)
      .returning();
    return newExercise;
  }

  async updatePlannedExercise(id: string, updates: Partial<InsertPlannedExercise>): Promise<PlannedExercise | undefined> {
    const [updated] = await db
      .update(plannedExercises)
      .set(updates)
      .where(eq(plannedExercises.id, id))
      .returning();
    return updated;
  }

  async deletePlannedExercise(id: string): Promise<boolean> {
    const result = await db
      .delete(plannedExercises)
      .where(eq(plannedExercises.id, id));
    return true;
  }

  async reorderExercises(scheduledWorkoutId: string, exerciseIds: string[]): Promise<void> {
    for (let i = 0; i < exerciseIds.length; i++) {
      await db
        .update(plannedExercises)
        .set({ exerciseOrder: i + 1 })
        .where(
          and(
            eq(plannedExercises.id, exerciseIds[i]),
            eq(plannedExercises.scheduledWorkoutId, scheduledWorkoutId)
          )
        );
    }
  }

  // Exercise Set operations
  async getExerciseSets(plannedExerciseId: string): Promise<ExerciseSet[]> {
    return await db
      .select()
      .from(exerciseSets)
      .where(eq(exerciseSets.plannedExerciseId, plannedExerciseId))
      .orderBy(exerciseSets.setNumber);
  }

  async getExerciseSet(id: string): Promise<ExerciseSet | undefined> {
    const [set] = await db
      .select()
      .from(exerciseSets)
      .where(eq(exerciseSets.id, id));
    return set;
  }

  async createExerciseSet(set: InsertExerciseSet): Promise<ExerciseSet> {
    const [newSet] = await db
      .insert(exerciseSets)
      .values(set)
      .returning();
    return newSet;
  }

  async updateExerciseSet(id: string, updates: Partial<InsertExerciseSet>): Promise<ExerciseSet | undefined> {
    const [updated] = await db
      .update(exerciseSets)
      .set(updates)
      .where(eq(exerciseSets.id, id))
      .returning();
    return updated;
  }

  async deleteExerciseSet(id: string): Promise<boolean> {
    await db
      .delete(exerciseSets)
      .where(eq(exerciseSets.id, id));
    return true;
  }

  async logSet(id: string, weight: number, reps: number, rir?: number): Promise<ExerciseSet | undefined> {
    const [updated] = await db
      .update(exerciseSets)
      .set({
        weight,
        reps,
        rir: rir ?? null,
        status: 'logged',
        loggedAt: new Date(),
      })
      .where(eq(exerciseSets.id, id))
      .returning();
    return updated;
  }

  async skipSet(id: string): Promise<ExerciseSet | undefined> {
    const [updated] = await db
      .update(exerciseSets)
      .set({ status: 'skipped', loggedAt: new Date() })
      .where(eq(exerciseSets.id, id))
      .returning();
    return updated;
  }

  async addSetToExercise(plannedExerciseId: string, setType: string = 'regular'): Promise<ExerciseSet> {
    // Get the exercise to find userId and current max set number
    const exercise = await this.getPlannedExercise(plannedExerciseId);
    if (!exercise) {
      throw new Error('Exercise not found');
    }

    const existingSets = await this.getExerciseSets(plannedExerciseId);
    const nextSetNumber = existingSets.length > 0 
      ? Math.max(...existingSets.map(s => s.setNumber)) + 1 
      : 1;

    const [newSet] = await db
      .insert(exerciseSets)
      .values({
        plannedExerciseId,
        userId: exercise.userId,
        setNumber: nextSetNumber,
        setType,
        targetReps: exercise.targetRepsMin,
        targetRir: exercise.targetRir,
      })
      .returning();
    return newSet;
  }

  // Coaching Decision operations
  async getLatestCoachingDecision(userId: string): Promise<CoachingDecision | undefined> {
    const [decision] = await db
      .select()
      .from(coachingDecisions)
      .where(eq(coachingDecisions.userId, userId))
      .orderBy(desc(coachingDecisions.generatedAt))
      .limit(1);
    return decision;
  }

  async getCoachingDecisionHistory(userId: string, limit: number = 10): Promise<CoachingDecision[]> {
    return await db
      .select()
      .from(coachingDecisions)
      .where(eq(coachingDecisions.userId, userId))
      .orderBy(desc(coachingDecisions.generatedAt))
      .limit(limit);
  }

  async createCoachingDecision(decision: InsertCoachingDecision): Promise<CoachingDecision> {
    const [created] = await db
      .insert(coachingDecisions)
      .values(decision)
      .returning();
    return created;
  }

  async markDecisionSurfaced(id: string): Promise<CoachingDecision | undefined> {
    const [updated] = await db
      .update(coachingDecisions)
      .set({ surfacedInChat: true, surfacedAt: new Date() })
      .where(eq(coachingDecisions.id, id))
      .returning();
    return updated;
  }

  // Push Subscription operations
  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return subscription;
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Upsert: if endpoint already exists, update the keys (could change on re-subscribe)
    const [created] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          platform: subscription.platform,
          displayMode: subscription.displayMode,
          lastUsedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async updatePushSubscriptionLastUsed(id: string): Promise<PushSubscription | undefined> {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.id, id))
      .returning();
    return updated;
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return (result.rowCount ?? 0) > 0;
  }
  
  async getAllUserIdsWithPushSubscriptions(): Promise<string[]> {
    const results = await db
      .selectDistinct({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions);
    return results.map(r => r.userId);
  }

  // Notification Log operations
  async getNotificationCountToday(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          gte(notificationLogs.sentAt, startOfDay)
        )
      );
    return result?.count ?? 0;
  }

  async getCoachingNotificationCountToday(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const coachingTypes = ['missed_workout', 'trainer_followup'] as const;
    
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          gte(notificationLogs.sentAt, startOfDay),
          inArray(notificationLogs.notificationType, [...coachingTypes])
        )
      );
    return result?.count ?? 0;
  }

  async getLastNotificationOfType(userId: string, notificationType: NotificationType): Promise<NotificationLog | undefined> {
    const [result] = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          eq(notificationLogs.notificationType, notificationType)
        )
      )
      .orderBy(desc(notificationLogs.sentAt))
      .limit(1);
    return result;
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const [created] = await db
      .insert(notificationLogs)
      .values(log)
      .returning();
    return created;
  }

  async markNotificationClicked(id: string): Promise<NotificationLog | undefined> {
    const [updated] = await db
      .update(notificationLogs)
      .set({ clickedAt: new Date() })
      .where(eq(notificationLogs.id, id))
      .returning();
    return updated;
  }

  // Admin export operations
  async getAdminUserExportData(): Promise<AdminUserExportRow[]> {
    // Get all users with basic info
    const allUsers = await db.select().from(users);
    
    // Get workout counts per user
    const workoutCounts = await db
      .select({
        userId: workoutLogs.userId,
        count: sql<number>`count(*)::int`,
        lastWorkout: sql<Date>`max(${workoutLogs.date})`,
      })
      .from(workoutLogs)
      .groupBy(workoutLogs.userId);
    
    // Get last chat activity per user
    const lastChatActivity = await db
      .select({
        userId: chatMessages.userId,
        lastMessage: sql<Date>`max(${chatMessages.createdAt})`,
      })
      .from(chatMessages)
      .groupBy(chatMessages.userId);
    
    // Get device connections per user
    const deviceConnections = await db
      .select({
        userId: smartwatchConnections.userId,
        provider: smartwatchConnections.provider,
      })
      .from(smartwatchConnections);
    
    // Build lookup maps
    const workoutMap = new Map(workoutCounts.map(w => [w.userId, { count: w.count, lastWorkout: w.lastWorkout }]));
    const chatMap = new Map(lastChatActivity.map(c => [c.userId, c.lastMessage]));
    
    // Build device connection map (user -> set of providers)
    const deviceMap = new Map<string, Set<string>>();
    for (const conn of deviceConnections) {
      if (!deviceMap.has(conn.userId)) {
        deviceMap.set(conn.userId, new Set());
      }
      deviceMap.get(conn.userId)!.add(conn.provider);
    }
    
    // Build export rows
    return allUsers.map(user => {
      const workoutData = workoutMap.get(user.id);
      const lastChat = chatMap.get(user.id);
      
      // Determine last active from most recent of workout or chat
      let lastActiveAt: Date | null = null;
      if (workoutData?.lastWorkout && lastChat) {
        lastActiveAt = workoutData.lastWorkout > lastChat ? workoutData.lastWorkout : lastChat;
      } else {
        lastActiveAt = workoutData?.lastWorkout || lastChat || null;
      }
      
      // Determine device connected from smartwatch_connections table
      let deviceConnected = 'none';
      const userDevices = deviceMap.get(user.id);
      if (userDevices) {
        const hasFitbit = userDevices.has('fitbit');
        const hasGarmin = userDevices.has('garmin');
        if (hasFitbit && hasGarmin) {
          deviceConnected = 'both';
        } else if (hasFitbit) {
          deviceConnected = 'fitbit';
        } else if (hasGarmin) {
          deviceConnected = 'garmin';
        }
      }
      
      // Determine plan name from subscriptionType and duration
      // Per prompt: "Empty values allowed (do not infer missing data)"
      let planName = 'free';
      if (user.subscriptionType === 'premium') {
        // Infer monthly vs yearly from subscription duration (if both dates exist)
        if (user.subscriptionStartDate && user.subscriptionEndDate) {
          const startDate = new Date(user.subscriptionStartDate);
          const endDate = new Date(user.subscriptionEndDate);
          const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          // Yearly subscriptions typically have >180 days duration
          planName = durationDays > 180 ? 'yearly' : 'monthly';
        } else {
          // Cannot determine interval without both dates - leave empty per prompt guidance
          planName = '';
        }
      }
      
      // Determine subscription status based on available data
      // Note: Without explicit cancellation tracking in schema, we can only determine:
      // - "active" for premium with valid dates
      // - "expired" for premium with passed end date
      // - "free" for non-premium users
      let subscriptionStatus = 'free';
      const now = new Date();
      if (user.subscriptionType === 'premium') {
        if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < now) {
          subscriptionStatus = 'expired';
        } else {
          subscriptionStatus = 'active';
        }
      }
      
      // Auto-renew: true if they have an active Stripe subscription (recurring billing)
      // If no Stripe subscription ID, auto-renew is false (manual grant or cancelled)
      const autoRenew = !!(user.stripeSubscriptionId && subscriptionStatus === 'active');
      
      return {
        userId: user.id,
        email: user.email || null,
        accountCreatedAt: user.createdAt || null,
        emailVerified: user.emailVerified ?? false,
        planName,
        subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate || null,
        subscriptionEndDate: user.subscriptionEndDate || null,
        autoRenew,
        lastActiveAt,
        totalWorkoutsLogged: workoutData?.count || 0,
        deviceConnected,
      };
    });
  }

  // ============================================
  // WEARABLE DATA CONTRACT OPERATIONS
  // ============================================

  async getUserWearableBaseline(userId: string): Promise<UserWearableBaseline | undefined> {
    const result = await db
      .select()
      .from(userWearableBaselines)
      .where(eq(userWearableBaselines.userId, userId))
      .limit(1);
    return result[0];
  }

  async upsertUserWearableBaseline(userId: string, data: Partial<InsertUserWearableBaseline>): Promise<UserWearableBaseline> {
    const existing = await this.getUserWearableBaseline(userId);
    
    if (existing) {
      const result = await db
        .update(userWearableBaselines)
        .set({
          ...data,
          userId,
          updatedAt: new Date(),
          lastRecalculatedAt: new Date(),
        })
        .where(eq(userWearableBaselines.userId, userId))
        .returning();
      return result[0];
    }
    
    const result = await db
      .insert(userWearableBaselines)
      .values({
        ...data,
        userId,
        lastRecalculatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async getWearablePhysiologicalFlags(userId: string, date: string): Promise<WearablePhysiologicalFlag | undefined> {
    const result = await db
      .select()
      .from(wearablePhysiologicalFlags)
      .where(
        and(
          eq(wearablePhysiologicalFlags.userId, userId),
          eq(wearablePhysiologicalFlags.date, date)
        )
      )
      .limit(1);
    return result[0];
  }

  async getRecentWearableFlags(userId: string, days: number): Promise<WearablePhysiologicalFlag[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    return db
      .select()
      .from(wearablePhysiologicalFlags)
      .where(
        and(
          eq(wearablePhysiologicalFlags.userId, userId),
          gte(wearablePhysiologicalFlags.date, cutoffStr)
        )
      )
      .orderBy(desc(wearablePhysiologicalFlags.date));
  }

  async upsertWearablePhysiologicalFlag(data: InsertWearablePhysiologicalFlag): Promise<WearablePhysiologicalFlag> {
    const existing = await this.getWearablePhysiologicalFlags(data.userId, data.date);
    
    if (existing) {
      const result = await db
        .update(wearablePhysiologicalFlags)
        .set(data)
        .where(eq(wearablePhysiologicalFlags.id, existing.id))
        .returning();
      return result[0];
    }
    
    const result = await db
      .insert(wearablePhysiologicalFlags)
      .values(data)
      .returning();
    return result[0];
  }

  // =============================================================================
  // WORKOUT EXECUTION MODEL OPERATIONS
  // =============================================================================

  async getActiveWorkoutSession(userId: string): Promise<ActiveWorkoutSessionRow | undefined> {
    const result = await db
      .select()
      .from(activeWorkoutSessionsTable)
      .where(
        and(
          eq(activeWorkoutSessionsTable.userId, userId),
          eq(activeWorkoutSessionsTable.status, SESSION_STATUS.ACTIVE)
        )
      )
      .limit(1);
    return result[0];
  }

  async getWorkoutSession(id: string): Promise<ActiveWorkoutSessionRow | undefined> {
    const result = await db
      .select()
      .from(activeWorkoutSessionsTable)
      .where(eq(activeWorkoutSessionsTable.id, id))
      .limit(1);
    return result[0];
  }

  async createWorkoutSession(session: InsertActiveWorkoutSession): Promise<ActiveWorkoutSessionRow> {
    const result = await db
      .insert(activeWorkoutSessionsTable)
      .values(session)
      .returning();
    return result[0];
  }

  async updateWorkoutSession(id: string, updates: Partial<InsertActiveWorkoutSession>): Promise<ActiveWorkoutSessionRow | undefined> {
    const result = await db
      .update(activeWorkoutSessionsTable)
      .set(updates)
      .where(eq(activeWorkoutSessionsTable.id, id))
      .returning();
    return result[0];
  }

  async endWorkoutSession(id: string, status: string): Promise<ActiveWorkoutSessionRow | undefined> {
    const result = await db
      .update(activeWorkoutSessionsTable)
      .set({
        status,
        completedAt: new Date(),
      })
      .where(eq(activeWorkoutSessionsTable.id, id))
      .returning();
    return result[0];
  }

  async getLiveSetLogs(sessionId: string): Promise<LiveSetLog[]> {
    return db
      .select()
      .from(liveSetLogs)
      .where(eq(liveSetLogs.sessionId, sessionId))
      .orderBy(liveSetLogs.exerciseOrder, liveSetLogs.setNumber);
  }

  async createLiveSetLog(log: InsertLiveSetLog): Promise<LiveSetLog> {
    const result = await db
      .insert(liveSetLogs)
      .values(log)
      .returning();
    return result[0];
  }

  async getCardioIntervals(sessionId: string): Promise<CardioInterval[]> {
    return db
      .select()
      .from(cardioIntervals)
      .where(eq(cardioIntervals.sessionId, sessionId))
      .orderBy(cardioIntervals.intervalNumber);
  }

  async createCardioInterval(interval: InsertCardioInterval): Promise<CardioInterval> {
    const result = await db
      .insert(cardioIntervals)
      .values(interval)
      .returning();
    return result[0];
  }

  async completeCardioInterval(
    id: string,
    actualDuration: number,
    heartRate?: number,
    perceivedExertion?: number
  ): Promise<CardioInterval | undefined> {
    const result = await db
      .update(cardioIntervals)
      .set({
        actualDurationSeconds: actualDuration,
        averageHeartRate: heartRate,
        perceivedExertion,
        completedAt: new Date(),
      })
      .where(eq(cardioIntervals.id, id))
      .returning();
    return result[0];
  }

  // Weekly Coaching Review operations
  async getWeeklyReview(userId: string, weekStart: Date): Promise<WeeklyCoachingReview | undefined> {
    const [review] = await db
      .select()
      .from(weeklyCoachingReviews)
      .where(and(
        eq(weeklyCoachingReviews.userId, userId),
        eq(weeklyCoachingReviews.weekStart, weekStart)
      ));
    return review;
  }

  async getLatestWeeklyReview(userId: string): Promise<WeeklyCoachingReview | undefined> {
    const [review] = await db
      .select()
      .from(weeklyCoachingReviews)
      .where(eq(weeklyCoachingReviews.userId, userId))
      .orderBy(desc(weeklyCoachingReviews.weekStart))
      .limit(1);
    return review;
  }

  async getWeeklyReviewHistory(userId: string, limit: number = 8): Promise<WeeklyCoachingReview[]> {
    return db
      .select()
      .from(weeklyCoachingReviews)
      .where(eq(weeklyCoachingReviews.userId, userId))
      .orderBy(desc(weeklyCoachingReviews.weekStart))
      .limit(limit);
  }

  async createWeeklyReview(review: InsertWeeklyCoachingReview): Promise<WeeklyCoachingReview> {
    const result = await db
      .insert(weeklyCoachingReviews)
      .values(review)
      .returning();
    return result[0];
  }

  // Goal Evaluation operations
  async getGoalEvaluation(userId: string, weekStart: Date): Promise<GoalEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(goalEvaluations)
      .where(and(
        eq(goalEvaluations.userId, userId),
        eq(goalEvaluations.weekStart, weekStart)
      ));
    return evaluation;
  }

  async getLatestGoalEvaluation(userId: string): Promise<GoalEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(goalEvaluations)
      .where(eq(goalEvaluations.userId, userId))
      .orderBy(desc(goalEvaluations.weekStart))
      .limit(1);
    return evaluation;
  }

  async getGoalEvaluationHistory(userId: string, limit: number = 8): Promise<GoalEvaluation[]> {
    return db
      .select()
      .from(goalEvaluations)
      .where(eq(goalEvaluations.userId, userId))
      .orderBy(desc(goalEvaluations.weekStart))
      .limit(limit);
  }

  async createGoalEvaluation(evaluation: InsertGoalEvaluation): Promise<GoalEvaluation> {
    const result = await db
      .insert(goalEvaluations)
      .values(evaluation)
      .returning();
    return result[0];
  }

  // Weekly Review Report operations
  async getWeeklyReviewReport(userId: string, weekStart: Date): Promise<WeeklyReviewReport | undefined> {
    const [report] = await db
      .select()
      .from(weeklyReviewReports)
      .where(and(
        eq(weeklyReviewReports.userId, userId),
        eq(weeklyReviewReports.weekStart, weekStart)
      ));
    return report;
  }

  async getLatestWeeklyReviewReport(userId: string): Promise<WeeklyReviewReport | undefined> {
    const [report] = await db
      .select()
      .from(weeklyReviewReports)
      .where(eq(weeklyReviewReports.userId, userId))
      .orderBy(desc(weeklyReviewReports.weekStart))
      .limit(1);
    return report;
  }

  async getWeeklyReviewReportHistory(userId: string, limit: number = 8): Promise<WeeklyReviewReport[]> {
    return db
      .select()
      .from(weeklyReviewReports)
      .where(eq(weeklyReviewReports.userId, userId))
      .orderBy(desc(weeklyReviewReports.weekStart))
      .limit(limit);
  }

  async createWeeklyReviewReport(report: InsertWeeklyReviewReport): Promise<WeeklyReviewReport> {
    const result = await db
      .insert(weeklyReviewReports)
      .values(report)
      .returning();
    return result[0];
  }

  async acknowledgeWeeklyReviewReport(reportId: string): Promise<WeeklyReviewReport | undefined> {
    const [report] = await db
      .update(weeklyReviewReports)
      .set({ acknowledgedByUser: true })
      .where(eq(weeklyReviewReports.id, reportId))
      .returning();
    return report;
  }

  // Food Log operations
  async getFoodLogs(userId: string, date: string): Promise<FoodLog[]> {
    return db
      .select()
      .from(foodLogs)
      .where(and(
        eq(foodLogs.userId, userId),
        eq(foodLogs.date, date)
      ))
      .orderBy(foodLogs.createdAt);
  }

  async getFoodLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<FoodLog[]> {
    return db
      .select()
      .from(foodLogs)
      .where(and(
        eq(foodLogs.userId, userId),
        gte(foodLogs.date, startDate),
        lte(foodLogs.date, endDate)
      ))
      .orderBy(foodLogs.date, foodLogs.createdAt);
  }

  async createFoodLog(log: InsertFoodLog): Promise<FoodLog> {
    const [newLog] = await db.insert(foodLogs).values(log).returning();
    return newLog;
  }

  async updateFoodLog(id: string, updates: Partial<InsertFoodLog>): Promise<FoodLog | undefined> {
    const [updated] = await db
      .update(foodLogs)
      .set(updates)
      .where(eq(foodLogs.id, id))
      .returning();
    return updated;
  }

  async deleteFoodLog(id: string): Promise<boolean> {
    const result = await db.delete(foodLogs).where(eq(foodLogs.id, id));
    return true;
  }

  async getDailyNutritionSummary(userId: string, date: string): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
    const logs = await this.getFoodLogs(userId, date);
    return logs.reduce((acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein || 0),
      carbs: acc.carbs + (log.carbs || 0),
      fats: acc.fats + (log.fats || 0),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
  }

  // Trainer Knowledge operations
  async getActiveKnowledge(category?: string, limit: number = 50): Promise<TrainerKnowledge[]> {
    if (category) {
      return db
        .select()
        .from(trainerKnowledge)
        .where(and(
          eq(trainerKnowledge.isActive, true),
          eq(trainerKnowledge.category, category)
        ))
        .orderBy(desc(trainerKnowledge.relevanceScore))
        .limit(limit);
    }
    return db
      .select()
      .from(trainerKnowledge)
      .where(eq(trainerKnowledge.isActive, true))
      .orderBy(desc(trainerKnowledge.relevanceScore))
      .limit(limit);
  }

  async getKnowledgeByCategories(categories: string[], limit: number = 30): Promise<TrainerKnowledge[]> {
    return db
      .select()
      .from(trainerKnowledge)
      .where(and(
        eq(trainerKnowledge.isActive, true),
        inArray(trainerKnowledge.category, categories)
      ))
      .orderBy(desc(trainerKnowledge.relevanceScore))
      .limit(limit);
  }

  async createKnowledge(knowledge: InsertTrainerKnowledge): Promise<TrainerKnowledge> {
    const [result] = await db.insert(trainerKnowledge).values(knowledge).returning();
    return result;
  }

  async getKnowledgeByHash(contentHash: string): Promise<TrainerKnowledge | undefined> {
    const [existing] = await db
      .select()
      .from(trainerKnowledge)
      .where(eq(trainerKnowledge.contentHash, contentHash));
    return existing;
  }

  async markKnowledgeApplied(knowledgeId: string): Promise<void> {
    await db
      .update(trainerKnowledge)
      .set({ 
        lastApplied: new Date(),
        applicationCount: sql`${trainerKnowledge.applicationCount} + 1`
      })
      .where(eq(trainerKnowledge.id, knowledgeId));
  }

  async getKnowledgeStats(): Promise<{ total: number; byCategory: Record<string, number>; recentlyLearned: number }> {
    const allKnowledge = await db
      .select()
      .from(trainerKnowledge)
      .where(eq(trainerKnowledge.isActive, true));
    
    const byCategory: Record<string, number> = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let recentlyLearned = 0;
    
    for (const k of allKnowledge) {
      byCategory[k.category] = (byCategory[k.category] || 0) + 1;
      if (k.learnedAt && new Date(k.learnedAt) > oneWeekAgo) {
        recentlyLearned++;
      }
    }
    
    return { total: allKnowledge.length, byCategory, recentlyLearned };
  }

  // Learning Job History operations
  async createLearningJob(job: InsertLearningJobHistory): Promise<LearningJobHistory> {
    const [result] = await db.insert(learningJobHistory).values(job).returning();
    return result;
  }

  async updateLearningJob(jobId: string, updates: Partial<LearningJobHistory>): Promise<LearningJobHistory | undefined> {
    const [result] = await db
      .update(learningJobHistory)
      .set(updates)
      .where(eq(learningJobHistory.id, jobId))
      .returning();
    return result;
  }

  async getRecentLearningJobs(limit: number = 10): Promise<LearningJobHistory[]> {
    return db
      .select()
      .from(learningJobHistory)
      .orderBy(desc(learningJobHistory.startedAt))
      .limit(limit);
  }

  // Wipe all fitness/profile/chat data for a user, optionally clearing admin status
  async resetUserForOnboarding(userId: string, clearAdmin = false): Promise<void> {
    await Promise.all([
      // Clear profile fields, force onboarding
      db.update(users).set({
        firstName: null,
        lastName: null,
        age: null,
        gender: null,
        height: null,
        currentWeight: null,
        targetWeight: null,
        fitnessGoal: null,
        activityLevel: null,
        profileComplete: false,
        ...(clearAdmin ? { isAdmin: false } : {}),
      }).where(eq(users.id, userId)),

      // Wipe fitness profile + coaching prefs
      db.delete(userFitnessProfiles).where(eq(userFitnessProfiles.userId, userId)),
      db.delete(userCoachingPreferences).where(eq(userCoachingPreferences.userId, userId)),

      // Wipe chat
      db.delete(conversations).where(eq(conversations.userId, userId)),
      // chatMessages cascade-delete via conversation FK, but clean orphans too
      db.delete(chatMessages).where(eq(chatMessages.userId, userId)),

      // Wipe workout + activity data
      db.delete(workoutLogs).where(eq(workoutLogs.userId, userId)),
      db.delete(scheduledWorkouts).where(eq(scheduledWorkouts.userId, userId)),
      db.delete(dailyActivity).where(eq(dailyActivity.userId, userId)),
      db.delete(weeklyCheckIns).where(eq(weeklyCheckIns.userId, userId)),

      // Wipe health metrics
      db.delete(healthMetrics).where(eq(healthMetrics.userId, userId)),
      db.delete(bodyweightEntries).where(eq(bodyweightEntries.userId, userId)),
      db.delete(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)),

      // Wipe wearable data
      db.delete(wearableActivities).where(eq(wearableActivities.userId, userId)),
      db.delete(userWearableBaselines).where(eq(userWearableBaselines.userId, userId)),
      db.delete(wearablePhysiologicalFlags).where(eq(wearablePhysiologicalFlags.userId, userId)),
    ]);
  }
}

export const storage = new DatabaseStorage();
