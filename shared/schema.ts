import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username", { length: 50 }).unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Fitness profile
  currentWeight: real("current_weight"),
  targetWeight: real("target_weight"),
  height: real("height"),
  age: integer("age"),
  gender: varchar("gender", { length: 20 }),
  fitnessGoal: varchar("fitness_goal", { length: 100 }),
  activityLevel: varchar("activity_level", { length: 50 }),
  
  // Daily nutrition goals (customizable)
  dailyCalorieGoal: integer("daily_calorie_goal").default(2000),
  dailyProteinGoal: integer("daily_protein_goal").default(150),
  dailyCarbsGoal: integer("daily_carbs_goal").default(250),
  dailyFatsGoal: integer("daily_fats_goal").default(65),
  
  // Subscription
  subscriptionType: varchar("subscription_type", { length: 20 }).default("trial"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
  
  // Admin/Owner access - bypasses all subscription/trial checks
  isAdmin: boolean("is_admin").default(false),
  
  // Stripe integration
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  stripePriceId: varchar("stripe_price_id", { length: 100 }),
  
  // Terms & Conditions
  termsAccepted: boolean("terms_accepted").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  
  // Profile completion & Account status
  profileComplete: boolean("profile_complete").default(false),
  isActive: boolean("is_active").default(true),
  deactivatedAt: timestamp("deactivated_at"),
  
  // Trainer preference
  trainerPreference: varchar("trainer_preference", { length: 20 }).default("female"),
  
  // Unit preferences
  weightUnit: varchar("weight_unit", { length: 10 }).default("kg"), // kg or lb
  
  // Nationality for personalized nutrition
  nationality: varchar("nationality", { length: 100 }),
  
  // Referral system
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  freeMonthsEarned: integer("free_months_earned").default(0),
  referredBy: varchar("referred_by", { length: 20 }),
  
  // Demo access
  demoCode: varchar("demo_code", { length: 50 }),
  isDemoUser: boolean("is_demo_user").default(false),
  
  // Primary device for multi-device conflict resolution
  primaryDevice: varchar("primary_device", { length: 20 }), // fitbit, garmin - source of truth when overlapping data
  
  // Default workout logging mode preference
  defaultWorkoutMode: varchar("default_workout_mode", { length: 30 }).default("hybrid"), // auto_tracked, structured_strength, hybrid
  
  // Focus Group System
  userStatus: varchar("user_status", { length: 20 }).default("guest"), // guest, waitlist, active
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token", { length: 100 }),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  activatedAt: timestamp("activated_at"),
  activationEmailSent: boolean("activation_email_sent").default(false),
});

// User status enum for type safety
export const USER_STATUS = {
  GUEST: 'guest',
  WAITLIST: 'waitlist', 
  ACTIVE: 'active',
} as const;
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

// Device provider types
export const DEVICE_PROVIDERS = {
  FITBIT: 'fitbit',
  GARMIN: 'garmin',
} as const;
export type DeviceProvider = typeof DEVICE_PROVIDERS[keyof typeof DEVICE_PROVIDERS];

// Smartwatch Connections (Direct OAuth)
export const smartwatchConnections = pgTable("smartwatch_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  terraUserId: varchar("terra_user_id", { length: 100 }),
  provider: varchar("provider", { length: 50 }).notNull(), // 'fitbit' | 'garmin'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  // Fitbit-specific
  fitbitUserId: varchar("fitbit_user_id", { length: 50 }),
  // Garmin-specific (OAuth 1.0a uses token + token secret)
  garminUserId: varchar("garmin_user_id", { length: 50 }),
  tokenSecret: text("token_secret"), // OAuth 1.0a token secret
  // Common fields
  scopes: text("scopes"),
  priority: integer("priority").default(1), // Higher = more authoritative (1-10)
  connectedAt: timestamp("connected_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(true),
}, (table) => [index("smartwatch_user_idx").on(table.userId)]);

export const insertSmartwatchConnectionSchema = createInsertSchema(smartwatchConnections).omit({ 
  id: true, 
  connectedAt: true,
  lastSyncAt: true,
});
export type InsertSmartwatchConnection = z.infer<typeof insertSmartwatchConnectionSchema>;
export type SmartwatchConnection = typeof smartwatchConnections.$inferSelect;

// Daily Activity Data (device-agnostic schema for smartwatch data)
export const dailyActivity = pgTable("daily_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(),
  
  // Movement metrics
  steps: integer("steps").default(0),
  caloriesBurned: integer("calories_burned").default(0),
  activeMinutes: integer("active_minutes").default(0),
  distance: real("distance"),
  floors: integer("floors"),
  
  // Heart rate metrics
  restingHeartRate: integer("resting_heart_rate"),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  heartRateZones: jsonb("heart_rate_zones"), // Array of {name, minutes, caloriesOut}
  
  // HRV (Heart Rate Variability)
  hrvRmssd: real("hrv_rmssd"), // Root mean square of successive differences
  hrvScore: integer("hrv_score"), // Normalized 0-100 score if available
  
  // Sleep metrics
  sleepMinutes: integer("sleep_minutes"),
  sleepEfficiency: integer("sleep_efficiency"), // Percentage 0-100
  sleepStages: jsonb("sleep_stages"), // {deep, light, rem, awake} in minutes
  timeInBed: integer("time_in_bed"), // Total minutes
  
  // Activity details
  activities: jsonb("activities"), // Array of {type, duration, intensity, caloriesBurned}
  
  // Internal tracking (not exposed in UI)
  source: varchar("source", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("daily_activity_user_date_idx").on(table.userId, table.date)]);

export const insertDailyActivitySchema = createInsertSchema(dailyActivity).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;
export type DailyActivity = typeof dailyActivity.$inferSelect;

// Device Metrics Raw - stores raw per-device data before conflict resolution
// This enables multi-device support without double-counting
export const deviceMetricsRaw = pgTable("device_metrics_raw", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  sourceDevice: varchar("source_device", { length: 20 }).notNull(), // fitbit, garmin
  
  // Movement metrics (raw from device)
  steps: integer("steps"),
  caloriesBurned: integer("calories_burned"),
  activeMinutes: integer("active_minutes"),
  distance: real("distance"),
  floors: integer("floors"),
  
  // Heart rate metrics
  restingHeartRate: integer("resting_heart_rate"),
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  heartRateZones: jsonb("heart_rate_zones"),
  
  // HRV
  hrvRmssd: real("hrv_rmssd"),
  hrvScore: integer("hrv_score"),
  
  // Sleep metrics
  sleepMinutes: integer("sleep_minutes"),
  sleepEfficiency: integer("sleep_efficiency"),
  sleepStages: jsonb("sleep_stages"),
  timeInBed: integer("time_in_bed"),
  
  // Activity details
  activities: jsonb("activities"),
  
  // Metadata for conflict resolution
  syncedAt: timestamp("synced_at").defaultNow(),
  isEvaluationData: boolean("is_evaluation_data").default(false), // Garmin evaluation environment flag
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("device_metrics_raw_user_date_device_idx").on(table.userId, table.date, table.sourceDevice)
]);

export const insertDeviceMetricsRawSchema = createInsertSchema(deviceMetricsRaw).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  syncedAt: true,
});
export type InsertDeviceMetricsRaw = z.infer<typeof insertDeviceMetricsRawSchema>;
export type DeviceMetricsRaw = typeof deviceMetricsRaw.$inferSelect;

// ============================================
// WEARABLE DATA CONTRACT LAYER
// ============================================

// User Wearable Baselines - 14-21 day rolling baseline per user (NOT population norms)
// All metrics normalized against user's own baseline window
export const userWearableBaselines = pgTable("user_wearable_baselines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Baseline window dates
  baselineStartDate: varchar("baseline_start_date", { length: 10 }), // YYYY-MM-DD
  baselineEndDate: varchar("baseline_end_date", { length: 10 }), // YYYY-MM-DD
  validDaysCount: integer("valid_days_count").default(0), // Must reach 14-21 for stable baseline
  
  // Baseline values (rolling 14-21 day averages)
  baselineSteps: integer("baseline_steps"),
  baselineActiveCalories: integer("baseline_active_calories"),
  baselineSleepMinutes: integer("baseline_sleep_minutes"),
  baselineSleepEfficiency: integer("baseline_sleep_efficiency"),
  baselineHrvRmssd: real("baseline_hrv_rmssd"),
  baselineRestingHeartRate: integer("baseline_resting_heart_rate"),
  
  // Standard deviations for z-score calculation
  stdevSteps: real("stdev_steps"),
  stdevActiveCalories: real("stdev_active_calories"),
  stdevSleepMinutes: real("stdev_sleep_minutes"),
  stdevSleepEfficiency: real("stdev_sleep_efficiency"),
  stdevHrvRmssd: real("stdev_hrv_rmssd"),
  stdevRestingHeartRate: real("stdev_resting_heart_rate"),
  
  // Baseline maturity
  isBaselineStable: boolean("is_baseline_stable").default(false), // True when 14+ valid days
  lastRecalculatedAt: timestamp("last_recalculated_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("user_wearable_baselines_user_idx").on(table.userId)]);

export const insertUserWearableBaselineSchema = createInsertSchema(userWearableBaselines).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});
export type InsertUserWearableBaseline = z.infer<typeof insertUserWearableBaselineSchema>;
export type UserWearableBaseline = typeof userWearableBaselines.$inferSelect;

// Wearable Physiological Flags - output of the wearable contract layer
// These flags feed the decision layer (trainer authority). Never prescriptions, only signals.
export const wearablePhysiologicalFlags = pgTable("wearable_physiological_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  
  // Recovery flags (from HRV + sleep + resting HR trends)
  recoveryStatus: varchar("recovery_status", { length: 20 }), // 'ok' | 'compromised' | 'unknown'
  recoveryDegradation: varchar("recovery_degradation", { length: 20 }), // 'none' | 'mild' | 'moderate' | 'severe'
  
  // Activity level flags (from steps + active calories trends)
  activityLevel: varchar("activity_level", { length: 20 }), // 'low' | 'normal' | 'high' | 'unknown'
  
  // Sleep flags (from sleep duration + efficiency trends)
  sleepDebtPresent: boolean("sleep_debt_present"),
  sleepDebtSeverity: varchar("sleep_debt_severity", { length: 20 }), // 'none' | 'mild' | 'moderate' | 'severe'
  
  // Physiological stress flags (from combined HRV + resting HR trends)
  physiologicalStress: varchar("physiological_stress", { length: 20 }), // 'down' | 'normal' | 'up' | 'unknown'
  
  // Confidence level for this day's flags (based on data availability)
  overallConfidence: varchar("overall_confidence", { length: 20 }), // 'low' | 'medium' | 'high'
  
  // Data availability (for failure tolerance)
  stepsAvailable: boolean("steps_available").default(false),
  sleepAvailable: boolean("sleep_available").default(false),
  hrvAvailable: boolean("hrv_available").default(false),
  restingHrAvailable: boolean("resting_hr_available").default(false),
  
  // Rolling trend data (7-day and 14-day)
  trend7Day: jsonb("trend_7_day"), // { steps: 'up'|'down'|'stable', hrv: ..., sleep: ... }
  trend14Day: jsonb("trend_14_day"),
  
  // Deltas from baseline (for context, not prescriptions)
  stepsPercentDelta: real("steps_percent_delta"), // % change vs baseline
  sleepPercentDelta: real("sleep_percent_delta"),
  hrvPercentDelta: real("hrv_percent_delta"),
  restingHrPercentDelta: real("resting_hr_percent_delta"),
  
  generatedAt: timestamp("generated_at").defaultNow(),
}, (table) => [
  index("wearable_flags_user_date_idx").on(table.userId, table.date),
  index("wearable_flags_user_generated_idx").on(table.userId, table.generatedAt)
]);

export const insertWearablePhysiologicalFlagSchema = createInsertSchema(wearablePhysiologicalFlags).omit({ 
  id: true, 
  generatedAt: true,
});
export type InsertWearablePhysiologicalFlag = z.infer<typeof insertWearablePhysiologicalFlagSchema>;
export type WearablePhysiologicalFlag = typeof wearablePhysiologicalFlags.$inferSelect;

// Trust model constants for signal confidence weighting
export const WEARABLE_SIGNAL_TRUST = {
  steps: 'high',
  sleep_duration: 'medium',
  sleep_stages: 'low',
  calories_burned: 'low',
  hrv: 'medium', // trend only
  resting_heart_rate: 'medium',
} as const;
export type WearableSignalTrust = typeof WEARABLE_SIGNAL_TRUST[keyof typeof WEARABLE_SIGNAL_TRUST];

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Bodyweight Entries - for trend tracking
export const bodyweightEntries = pgTable("bodyweight_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  weight: real("weight").notNull(), // in kg (always stored in kg)
  source: varchar("source", { length: 20 }).default("manual"), // 'manual' | 'device'
  hidden: boolean("hidden").default(false), // User can hide device entries from trend
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("bodyweight_user_date_idx").on(table.userId, table.date)]);

export const insertBodyweightEntrySchema = createInsertSchema(bodyweightEntries).omit({
  id: true,
  createdAt: true,
});
export type InsertBodyweightEntry = z.infer<typeof insertBodyweightEntrySchema>;
export type BodyweightEntry = typeof bodyweightEntries.$inferSelect;

// Body Measurements - weekly body composition tracking
export const bodyMeasurements = pgTable("body_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  
  // All measurements in cm (stored in metric)
  chest: real("chest"),
  waist: real("waist"),
  hips: real("hips"),
  leftArm: real("left_arm"),
  rightArm: real("right_arm"),
  leftThigh: real("left_thigh"),
  rightThigh: real("right_thigh"),
  neck: real("neck"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("body_measurements_user_date_idx").on(table.userId, table.date)]);

export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBodyMeasurement = z.infer<typeof insertBodyMeasurementSchema>;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;

// Workout Plans
export const workoutPlans = pgTable("workout_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  phase: varchar("phase", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkoutPlanSchema = createInsertSchema(workoutPlans).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertWorkoutPlan = z.infer<typeof insertWorkoutPlanSchema>;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;

// Individual Workouts
export const workouts = pgTable("workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => workoutPlans.id, { onDelete: "cascade" }),
  day: varchar("day", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  duration: integer("duration"),
  intensity: varchar("intensity", { length: 50 }),
  status: varchar("status", { length: 20 }).default("upcoming"),
  exercises: jsonb("exercises"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workouts.$inferSelect;

// Diet Plans
export const dietPlans = pgTable("diet_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  dailyCalories: integer("daily_calories"),
  macros: jsonb("macros"), // { protein: number, carbs: number, fats: number }
  contextLabel: varchar("context_label", { length: 50 }), // "Training day", "Rest day", "Recovery-focused", "Deload adjustment"
  foodPlan: jsonb("food_plan"), // Array of { food: string, quantity: string }
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDietPlanSchema = createInsertSchema(dietPlans).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDietPlan = z.infer<typeof insertDietPlanSchema>;
export type DietPlan = typeof dietPlans.$inferSelect;

// Meals
export const meals = pgTable("meals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => dietPlans.id, { onDelete: "cascade" }),
  mealType: varchar("meal_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fats: integer("fats"),
  ingredients: jsonb("ingredients"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMealSchema = createInsertSchema(meals).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof meals.$inferSelect;

// Food Logs - Track actual food intake
export const foodLogs = pgTable("food_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  mealType: varchar("meal_type", { length: 20 }).notNull(), // breakfast, lunch, dinner, snack
  foodName: varchar("food_name", { length: 200 }).notNull(),
  servingSize: varchar("serving_size", { length: 100 }), // e.g., "1 cup", "100g"
  servingQuantity: real("serving_quantity").default(1),
  calories: integer("calories").notNull(),
  protein: real("protein").default(0), // in grams
  carbs: real("carbs").default(0), // in grams
  fats: real("fats").default(0), // in grams
  fiber: real("fiber"), // optional
  sodium: real("sodium"), // optional, in mg
  sugar: real("sugar"), // optional, in grams
  source: varchar("source", { length: 50 }).default("manual"), // manual, usda, openfoodfacts
  externalId: varchar("external_id", { length: 100 }), // ID from external food database
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("food_logs_user_date_idx").on(table.userId, table.date)
]);

export const insertFoodLogSchema = createInsertSchema(foodLogs).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;
export type FoodLog = typeof foodLogs.$inferSelect;

// Meal type constants
export const MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snack',
} as const;
export type MealType = typeof MEAL_TYPES[keyof typeof MEAL_TYPES];

// Conversations (for multiple chat threads like ChatGPT)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).default("New Chat"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("conversation_user_idx").on(table.userId)]);

export const insertConversationSchema = createInsertSchema(conversations).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  imageUrls: jsonb("image_urls").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_user_idx").on(table.userId),
  index("chat_conversation_idx").on(table.conversationId)
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Health Metrics
export const healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  weight: real("weight"),
  caloriesBurned: integer("calories_burned"),
  workoutsCompleted: integer("workouts_completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("metrics_user_date_idx").on(table.userId, table.date)]);

export const insertHealthMetricSchema = createInsertSchema(healthMetrics).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertHealthMetric = z.infer<typeof insertHealthMetricSchema>;
export type HealthMetric = typeof healthMetrics.$inferSelect;

// Health Documents (lab results, medical reports, etc.)
export const healthDocuments = pgTable("health_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 50 }),
  documentType: varchar("document_type", { length: 100 }),
  analysisResult: jsonb("analysis_result"),
  extractedMetrics: jsonb("extracted_metrics"),
  uploadMonth: varchar("upload_month", { length: 7 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("documents_user_idx").on(table.userId)]);

export const insertHealthDocumentSchema = createInsertSchema(healthDocuments).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertHealthDocument = z.infer<typeof insertHealthDocumentSchema>;
export type HealthDocument = typeof healthDocuments.$inferSelect;

// Workout Logs (user-logged workouts)
// Workout Mode Types
export const WORKOUT_MODES = {
  AUTO_TRACKED: 'auto_tracked',      // Smartwatch-first, no manual sets/reps
  STRUCTURED_STRENGTH: 'structured_strength',  // Manual-first with sets/reps/weight/RIR
  HYBRID: 'hybrid',                  // Auto-import + optional structure
} as const;
export type WorkoutMode = typeof WORKOUT_MODES[keyof typeof WORKOUT_MODES];

// Wearable Activities - auto-imported from smartwatches, separate from manual logs
export const wearableActivities = pgTable("wearable_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  
  // Activity metadata from device
  activityName: varchar("activity_name", { length: 200 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }), // strength, running, cycling, etc.
  sourceDevice: varchar("source_device", { length: 20 }).notNull(), // fitbit, garmin
  deviceActivityId: varchar("device_activity_id", { length: 100 }), // Original ID from device
  garminSummaryId: varchar("garmin_summary_id", { length: 100 }), // Garmin server-assigned ID for FIT file downloads
  
  // Auto-imported metrics from wearable
  duration: integer("duration"), // minutes
  caloriesBurned: integer("calories_burned"),
  distance: real("distance"), // km
  averageHeartRate: integer("average_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  heartRateZones: jsonb("heart_rate_zones"), // time in zones
  elevationGain: real("elevation_gain"),
  avgPace: real("avg_pace"), // min/km for running
  avgPower: integer("avg_power"), // watts for cycling
  trainingLoad: integer("training_load"), // Garmin-specific
  
  // User additions (optional notes only for auto-tracked mode)
  notes: text("notes"),
  
  // Linking to structured strength log (for hybrid mode)
  linkedWorkoutLogId: varchar("linked_workout_log_id"), // Points to workout_logs if user structures it
  structurePromptShown: boolean("structure_prompt_shown").default(false),
  structurePromptResponse: varchar("structure_prompt_response", { length: 20 }), // 'yes', 'no', 'skipped'
  
  // Trainer confirmation flow
  pendingConfirmation: boolean("pending_confirmation").default(true), // New workouts need trainer confirmation
  confirmedAt: timestamp("confirmed_at"), // When user confirmed via trainer
  confirmedBy: varchar("confirmed_by", { length: 20 }), // 'trainer', 'manual', 'auto'
  
  // Structured data status (for strength workouts from Garmin FIT files)
  structureStatus: varchar("structure_status", { length: 20 }).default("none"), // 'none', 'pending', 'complete', 'failed'
  structureParsedAt: timestamp("structure_parsed_at"), // When FIT file was parsed
  structureError: text("structure_error"), // Error message if parsing failed
  
  // Timestamps
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("wearable_activities_user_date_idx").on(table.userId, table.date)]);

export const insertWearableActivitySchema = createInsertSchema(wearableActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  syncedAt: true,
});
export type InsertWearableActivity = z.infer<typeof insertWearableActivitySchema>;
export type WearableActivity = typeof wearableActivities.$inferSelect;

// Wearable Exercise Sets - structured exercise data parsed from Garmin FIT files
export const wearableExerciseSets = pgTable("wearable_exercise_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wearableActivityId: varchar("wearable_activity_id").notNull().references(() => wearableActivities.id, { onDelete: "cascade" }),
  
  // Exercise identification
  exerciseOrder: integer("exercise_order").notNull(), // Order in workout (1, 2, 3...)
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  exerciseCategory: varchar("exercise_category", { length: 100 }), // chest, back, legs, etc.
  garminExerciseId: integer("garmin_exercise_id"), // Original Garmin exercise category ID
  
  // Set data
  setNumber: integer("set_number").notNull(), // Set number within this exercise (1, 2, 3...)
  reps: integer("reps"),
  weight: real("weight"), // kg
  weightUnit: varchar("weight_unit", { length: 10 }).default("kg"),
  duration: integer("duration"), // seconds (for timed exercises)
  restAfter: integer("rest_after"), // seconds of rest after this set
  
  // Optional metrics from device
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("wearable_exercise_sets_activity_idx").on(table.wearableActivityId)]);

export const insertWearableExerciseSetSchema = createInsertSchema(wearableExerciseSets).omit({
  id: true,
  createdAt: true,
});
export type InsertWearableExerciseSet = z.infer<typeof insertWearableExerciseSetSchema>;
export type WearableExerciseSet = typeof wearableExerciseSets.$inferSelect;

export const workoutLogs = pgTable("workout_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  workoutName: varchar("workout_name", { length: 200 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }), // strength, running, cycling, etc.
  duration: integer("duration"),
  caloriesBurned: integer("calories_burned"),
  distance: real("distance"), // km for endurance activities
  notes: text("notes"),
  exercises: jsonb("exercises"),
  completed: boolean("completed").default(true),
  source: varchar("source", { length: 50 }), // manual, fitbit, garmin
  
  // Workout mode tracking
  workoutMode: varchar("workout_mode", { length: 30 }).default("structured_strength"), // auto_tracked, structured_strength, hybrid
  linkedWearableActivityId: varchar("linked_wearable_activity_id"), // Links to wearable_activities for hybrid mode
  
  // Background metrics from wearable (used in structured_strength mode)
  wearableHeartRateAvg: integer("wearable_heart_rate_avg"),
  wearableHeartRateMax: integer("wearable_heart_rate_max"),
  wearableCalories: integer("wearable_calories"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("workout_logs_user_date_idx").on(table.userId, table.date)]);

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogs.$inferSelect;


// User Fitness Profile (goals, sport preferences, training style)
export const userFitnessProfiles = pgTable("user_fitness_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Sport/Activity type
  primarySport: varchar("primary_sport", { length: 100 }),
  secondarySports: jsonb("secondary_sports"),
  trainingEnvironment: varchar("training_environment", { length: 50 }),
  
  // Goals and milestones
  shortTermGoal: text("short_term_goal"),
  longTermGoal: text("long_term_goal"),
  currentMilestone: text("current_milestone"),
  targetDate: timestamp("target_date"),
  
  // Training preferences
  preferredWorkoutDays: jsonb("preferred_workout_days"),
  workoutDuration: integer("workout_duration"),
  intensityPreference: varchar("intensity_preference", { length: 20 }),
  
  // Progress tracking
  weeklyProgress: jsonb("weekly_progress"),
  fatigueLevel: integer("fatigue_level"),
  lastFatigueUpdate: timestamp("last_fatigue_update"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("fitness_profile_user_idx").on(table.userId)]);

export const insertUserFitnessProfileSchema = createInsertSchema(userFitnessProfiles).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertUserFitnessProfile = z.infer<typeof insertUserFitnessProfileSchema>;
export type UserFitnessProfile = typeof userFitnessProfiles.$inferSelect;

// Milestones (trackable achievements)
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  targetValue: real("target_value"),
  currentValue: real("current_value"),
  unit: varchar("unit", { length: 50 }),
  category: varchar("category", { length: 50 }),
  
  targetDate: timestamp("target_date"),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 20 }).default("in_progress"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("milestones_user_idx").on(table.userId)]);

export const insertMilestoneSchema = createInsertSchema(milestones).omit({ 
  id: true, 
  createdAt: true
});
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

// Scheduled Workouts (weekly planning)
export const scheduledWorkouts = pgTable("scheduled_workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date").notNull(),
  dayOfWeek: varchar("day_of_week", { length: 15 }),
  timeSlot: varchar("time_slot", { length: 20 }),
  
  // Workout details
  workoutType: varchar("workout_type", { length: 100 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }), // running, strength_training, yoga, etc.
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  duration: integer("duration"),
  intensity: varchar("intensity", { length: 20 }),
  exercises: jsonb("exercises"),
  
  // Endurance-specific fields
  distance: real("distance"), // in km
  
  // HIIT/Mixed-specific fields
  intervals: integer("intervals"),
  workTime: integer("work_time"), // seconds per work interval
  restTime: integer("rest_time"), // seconds per rest interval
  
  // Skill/Sport-specific fields
  perceivedEffort: integer("perceived_effort"), // 1-10 scale
  
  // Recovery-specific fields
  mobilityType: varchar("mobility_type", { length: 50 }), // stretching, foam_rolling, yoga
  
  // Sport-specific
  sportCategory: varchar("sport_category", { length: 50 }),
  location: varchar("location", { length: 100 }),
  equipment: jsonb("equipment"),
  
  // Data source tracking (manual, fitbit, garmin, ai_generated)
  dataSource: varchar("data_source", { length: 30 }).default("manual"),
  
  // Wearable integration - link to imported activity when completed via wearable
  linkedWearableActivityId: varchar("linked_wearable_activity_id"),
  
  // Status
  status: varchar("status", { length: 20 }).default("scheduled"),
  completedAt: timestamp("completed_at"),
  performanceFeedback: varchar("performance_feedback", { length: 20 }), // easy, moderate, hard
  notes: text("notes"),
  
  // AI-generated flag
  aiGenerated: boolean("ai_generated").default(false),
  weekNumber: integer("week_number"),
  
  // Legacy flag for duration-only strength workouts (pre-validation)
  // These workouts were created before structured exercises were required
  legacyUnstructured: boolean("legacy_unstructured").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("scheduled_workouts_user_date_idx").on(table.userId, table.scheduledDate),
  index("scheduled_workouts_user_week_idx").on(table.userId, table.weekNumber),
  index("scheduled_workouts_wearable_idx").on(table.linkedWearableActivityId)
]);

export const insertScheduledWorkoutSchema = createInsertSchema(scheduledWorkouts).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertScheduledWorkout = z.infer<typeof insertScheduledWorkoutSchema>;
export type ScheduledWorkout = typeof scheduledWorkouts.$inferSelect;

// Planned Exercises (exercises within a scheduled workout - RP Hypertrophy style)
export const plannedExercises = pgTable("planned_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduledWorkoutId: varchar("scheduled_workout_id").notNull().references(() => scheduledWorkouts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Exercise details
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  muscleGroup: varchar("muscle_group", { length: 50 }).notNull(), // chest, back, shoulders, legs, arms, core
  equipmentType: varchar("equipment_type", { length: 50 }), // machine, barbell, dumbbell, cable, bodyweight
  
  // Target prescription
  targetSets: integer("target_sets").default(3),
  targetRepsMin: integer("target_reps_min").default(8),
  targetRepsMax: integer("target_reps_max").default(12),
  targetRir: integer("target_rir").default(2), // Reps in Reserve
  
  // Order in workout
  exerciseOrder: integer("exercise_order").default(1),
  
  // Notes
  notes: text("notes"),
  supersetWith: varchar("superset_with"), // reference to another exercise id
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("planned_exercises_workout_idx").on(table.scheduledWorkoutId),
  index("planned_exercises_user_idx").on(table.userId)
]);

export const insertPlannedExerciseSchema = createInsertSchema(plannedExercises).omit({ 
  id: true, 
  createdAt: true
});
export type InsertPlannedExercise = z.infer<typeof insertPlannedExerciseSchema>;
export type PlannedExercise = typeof plannedExercises.$inferSelect;

// Exercise Sets (individual set logging with weight/reps/RIR)
export const exerciseSets = pgTable("exercise_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plannedExerciseId: varchar("planned_exercise_id").notNull().references(() => plannedExercises.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Set number
  setNumber: integer("set_number").notNull(),
  
  // Set type
  setType: varchar("set_type", { length: 30 }).default("regular"), // regular, warmup, myorep, drop, failure
  
  // Target (prescribed)
  targetWeight: real("target_weight"),
  targetReps: integer("target_reps"),
  targetRir: integer("target_rir"),
  
  // Actual (logged)
  weight: real("weight"),
  reps: integer("reps"),
  rir: integer("rir"),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, logged, skipped
  loggedAt: timestamp("logged_at"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("exercise_sets_exercise_idx").on(table.plannedExerciseId),
  index("exercise_sets_user_idx").on(table.userId)
]);

export const insertExerciseSetSchema = createInsertSchema(exerciseSets).omit({ 
  id: true, 
  createdAt: true
});
export type InsertExerciseSet = z.infer<typeof insertExerciseSetSchema>;
export type ExerciseSet = typeof exerciseSets.$inferSelect;

// AI-Assigned Athlete Goals (weekly/monthly targets)
export const athleteGoals = pgTable("athlete_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Goal details
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  
  // Goal type and category
  goalType: varchar("goal_type", { length: 20 }).notNull(), // weekly, monthly
  category: varchar("category", { length: 50 }).notNull(), // workout, nutrition, weight, habit, strength, endurance
  
  // Tracking
  targetValue: real("target_value"),
  currentValue: real("current_value").default(0),
  unit: varchar("unit", { length: 50 }), // lbs, kg, sessions, calories, etc.
  
  // Dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Status
  status: varchar("status", { length: 20 }).default("active"), // active, completed, failed, abandoned
  completedAt: timestamp("completed_at"),
  
  // AI tracking
  aiAssigned: boolean("ai_assigned").default(true),
  assignedInConversation: varchar("assigned_in_conversation"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("athlete_goals_user_idx").on(table.userId),
  index("athlete_goals_status_idx").on(table.userId, table.status),
  index("athlete_goals_type_idx").on(table.userId, table.goalType)
]);

export const insertAthleteGoalSchema = createInsertSchema(athleteGoals).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertAthleteGoal = z.infer<typeof insertAthleteGoalSchema>;
export type AthleteGoal = typeof athleteGoals.$inferSelect;

// Referrals (track who referred whom - counts only when referred user pays)
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: varchar("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referralCode: varchar("referral_code", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, paid, expired
  paidAt: timestamp("paid_at"),
  rewardedAt: timestamp("rewarded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("referrals_referrer_idx").on(table.referrerId),
  index("referrals_referred_idx").on(table.referredId),
  index("referrals_code_idx").on(table.referralCode)
]);

export const insertReferralSchema = createInsertSchema(referrals).omit({ 
  id: true, 
  createdAt: true
});
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// Fitness Challenges (community challenges)
export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(), // abs, weight_loss, strength, cardio, flexibility
  durationDays: integer("duration_days").notNull(),
  dailyTasks: jsonb("daily_tasks"), // array of task descriptions
  imageUrl: varchar("image_url", { length: 500 }),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"), // easy, medium, hard
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({ 
  id: true, 
  createdAt: true
});
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

// Challenge Participants (users who joined a challenge)
export const challengeParticipants = pgTable("challenge_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow(),
  currentDay: integer("current_day").default(0),
  completedDays: jsonb("completed_days").default([]), // array of day numbers completed
  totalPoints: integer("total_points").default(0),
  streak: integer("streak").default(0),
  status: varchar("status", { length: 20 }).default("active"), // active, completed, abandoned
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("challenge_participants_challenge_idx").on(table.challengeId),
  index("challenge_participants_user_idx").on(table.userId)
]);

export const insertChallengeParticipantSchema = createInsertSchema(challengeParticipants).omit({ 
  id: true, 
  joinedAt: true
});
export type InsertChallengeParticipant = z.infer<typeof insertChallengeParticipantSchema>;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;

// User Feedback (for focus group)
export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(), // 1-5 stars
  category: varchar("category", { length: 50 }), // general, ai_trainer, tracker, ui, feature_request
  comment: text("comment"),
  userEmail: varchar("user_email", { length: 255 }), // for follow-up
  pageUrl: varchar("page_url", { length: 500 }),
  status: varchar("status", { length: 20 }).default("open"), // open, in_progress, resolved
  resolvedAt: timestamp("resolved_at"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_feedback_user_idx").on(table.userId),
  index("user_feedback_rating_idx").on(table.rating),
  index("user_feedback_created_idx").on(table.createdAt),
  index("user_feedback_status_idx").on(table.status)
]);

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({ 
  id: true, 
  createdAt: true
});
export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;

// User Streaks (for engagement tracking)
export const userStreaks = pgTable("user_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivityDate: timestamp("last_activity_date"),
  streakType: varchar("streak_type", { length: 30 }).default("daily_checkin"), // daily_checkin, workout, food_log
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_streaks_user_idx").on(table.userId)
]);

export const insertUserStreakSchema = createInsertSchema(userStreaks).omit({ 
  id: true, 
  updatedAt: true
});
export type InsertUserStreak = z.infer<typeof insertUserStreakSchema>;
export type UserStreak = typeof userStreaks.$inferSelect;

// ============================================
// AI COACHING ENGINE TABLES
// ============================================

// Weekly Check-ins (soreness, sleep, mood, energy for adaptive training)
export const weeklyCheckIns = pgTable("weekly_check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  
  // Wellness metrics (1-10 scale)
  soreness: integer("soreness"), // 1=none, 10=extreme
  sleepQuality: integer("sleep_quality"), // 1=poor, 10=excellent
  energyLevel: integer("energy_level"), // 1=exhausted, 10=energized
  stressLevel: integer("stress_level"), // 1=relaxed, 10=very stressed
  mood: integer("mood"), // 1=low, 10=great
  
  // Training feedback
  averageRPE: real("average_rpe"), // Rate of Perceived Exertion 1-10
  workoutsCompleted: integer("workouts_completed").default(0),
  workoutsPlanned: integer("workouts_planned").default(0),
  
  // Nutrition compliance
  nutritionCompliance: integer("nutrition_compliance"), // 1-10
  waterIntake: integer("water_intake"), // glasses per day average
  
  // Weight tracking
  weekStartWeight: real("week_start_weight"),
  weekEndWeight: real("week_end_weight"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("weekly_checkins_user_week_idx").on(table.userId, table.year, table.weekNumber)
]);

export const insertWeeklyCheckInSchema = createInsertSchema(weeklyCheckIns).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertWeeklyCheckIn = z.infer<typeof insertWeeklyCheckInSchema>;
export type WeeklyCheckIn = typeof weeklyCheckIns.$inferSelect;

// Muscle Volume Tracking (sets per muscle group per week)
export const muscleVolumeTracking = pgTable("muscle_volume_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  
  // Volume per muscle group (sets per week)
  chestSets: integer("chest_sets").default(0),
  backSets: integer("back_sets").default(0),
  shouldersSets: integer("shoulders_sets").default(0),
  bicepsSets: integer("biceps_sets").default(0),
  tricepsSets: integer("triceps_sets").default(0),
  quadsSets: integer("quads_sets").default(0),
  hamstringsSets: integer("hamstrings_sets").default(0),
  glutesSets: integer("glutes_sets").default(0),
  calvesSets: integer("calves_sets").default(0),
  absSets: integer("abs_sets").default(0),
  
  // Cardio tracking
  cardioMinutes: integer("cardio_minutes").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("muscle_volume_user_week_idx").on(table.userId, table.year, table.weekNumber)
]);

export const insertMuscleVolumeTrackingSchema = createInsertSchema(muscleVolumeTracking).omit({ 
  id: true, 
  createdAt: true
});
export type InsertMuscleVolumeTracking = z.infer<typeof insertMuscleVolumeTrackingSchema>;
export type MuscleVolumeTracking = typeof muscleVolumeTracking.$inferSelect;

// User Coaching Preferences (for personalized AI responses)
export const userCoachingPreferences = pgTable("user_coaching_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Communication style
  tonePreference: varchar("tone_preference", { length: 30 }).default("friendly"), // strict, friendly, soft, energetic, minimal
  
  // Physical limitations
  injuries: jsonb("injuries"), // array of injury descriptions
  limitations: text("limitations"), // other physical limitations
  
  // Equipment & Environment
  availableEquipment: jsonb("available_equipment"), // array: dumbbells, barbell, cables, bodyweight, etc.
  trainingLocation: varchar("training_location", { length: 50 }), // home, gym, outdoor
  
  // Dietary preferences
  dietaryRestrictions: jsonb("dietary_restrictions"), // halal, vegetarian, vegan, gluten-free, dairy-free, etc.
  allergies: jsonb("allergies"), // food allergies
  dislikedFoods: jsonb("disliked_foods"), // foods they don't like
  culturalCuisine: varchar("cultural_cuisine", { length: 100 }), // for meal suggestions
  
  // Training preferences
  preferredWorkoutDuration: integer("preferred_workout_duration").default(60), // minutes
  preferredWorkoutDays: integer("preferred_workout_days").default(4), // days per week
  experienceLevel: varchar("experience_level", { length: 20 }).default("beginner"), // beginner, intermediate, advanced
  
  // Goals detail
  primaryGoal: varchar("primary_goal", { length: 50 }), // fat_loss, muscle_gain, recomposition, maintenance, strength, endurance
  secondaryGoal: varchar("secondary_goal", { length: 50 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("coaching_prefs_user_idx").on(table.userId)
]);

export const insertUserCoachingPreferencesSchema = createInsertSchema(userCoachingPreferences).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertUserCoachingPreferences = z.infer<typeof insertUserCoachingPreferencesSchema>;
export type UserCoachingPreferences = typeof userCoachingPreferences.$inferSelect;

// Exercise Performance Logs (for progressive overload tracking)
export const exercisePerformanceLogs = pgTable("exercise_performance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workoutLogId: varchar("workout_log_id").references(() => workoutLogs.id, { onDelete: "cascade" }),
  
  // Exercise details
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  muscleGroup: varchar("muscle_group", { length: 50 }),
  
  // Performance data
  sets: integer("sets").notNull(),
  reps: jsonb("reps"), // array of reps per set, e.g., [12, 10, 8]
  weight: jsonb("weight"), // array of weights per set, e.g., [50, 55, 60]
  weightUnit: varchar("weight_unit", { length: 10 }).default("kg"), // kg or lbs
  
  // RPE tracking
  rpe: real("rpe"), // Rate of Perceived Exertion 1-10
  
  // Notes
  notes: text("notes"),
  
  performedAt: timestamp("performed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("exercise_logs_user_idx").on(table.userId),
  index("exercise_logs_exercise_idx").on(table.userId, table.exerciseName)
]);

export const insertExercisePerformanceLogSchema = createInsertSchema(exercisePerformanceLogs).omit({ 
  id: true, 
  createdAt: true
});
export type InsertExercisePerformanceLog = z.infer<typeof insertExercisePerformanceLogSchema>;
export type ExercisePerformanceLog = typeof exercisePerformanceLogs.$inferSelect;

// Types for weight lifting workout UI
export interface WorkoutSet {
  id: string;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  rir?: number | null; // Reps In Reserve (optional)
  setType?: 'regular' | 'drop' | 'myorep' | null; // Set type (optional)
}

export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'other';
  targetRepRange: string; // e.g., "6-10"
  sets: WorkoutSet[];
  notes?: string;
}

export interface ActiveWorkoutSession {
  id: string;
  userId: string;
  workoutName: string;
  programName?: string;
  dayName?: string;
  workoutType: 'strength' | 'weight_lifting';
  exercises: WorkoutExercise[];
  startedAt: Date;
  completedAt?: Date;
}

// OAuth pending auth table for PKCE flow (persists across server instances)
export const oauthPendingAuth = pgTable("oauth_pending_auth", {
  state: varchar("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  userId: varchar("user_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'garmin', 'fitbit', etc.
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type OAuthPendingAuth = typeof oauthPendingAuth.$inferSelect;

// Coaching Decision Types
export const COACHING_DECISION_TYPES = {
  MAINTAIN: 'maintain',
  REDUCE_VOLUME: 'reduce_volume',
  INCREASE_VOLUME: 'increase_volume',
  DELOAD_SUGGESTED: 'deload_suggested',
} as const;
export type CoachingDecisionType = typeof COACHING_DECISION_TYPES[keyof typeof COACHING_DECISION_TYPES];

export const CONFIDENCE_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[keyof typeof CONFIDENCE_LEVELS];

// Coaching Decisions - automated training decisions without chat interaction
export const coachingDecisions = pgTable("coaching_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Decision details
  decisionType: varchar("decision_type", { length: 30 }).notNull(), // maintain, reduce_volume, increase_volume, deload_suggested
  confidence: varchar("confidence", { length: 10 }).notNull(), // low, medium, high
  primaryReason: text("primary_reason").notNull(), // e.g., "high soreness + elevated RPE"
  
  // Input metrics snapshot (for audit/debugging)
  inputMetrics: jsonb("input_metrics"), // { avgRPE, avgSoreness, sleepQuality, weeksSinceDeload, performanceTrend }
  
  // Timestamps
  generatedAt: timestamp("generated_at").defaultNow(),
  
  // Consumption tracking
  surfacedInChat: boolean("surfaced_in_chat").default(false),
  surfacedAt: timestamp("surfaced_at"),
}, (table) => [
  index("coaching_decisions_user_idx").on(table.userId),
  index("coaching_decisions_generated_idx").on(table.userId, table.generatedAt)
]);

export const insertCoachingDecisionSchema = createInsertSchema(coachingDecisions).omit({ 
  id: true, 
  generatedAt: true
});
export type InsertCoachingDecision = z.infer<typeof insertCoachingDecisionSchema>;
export type CoachingDecision = typeof coachingDecisions.$inferSelect;

// Push notification subscriptions for PWA
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Web Push subscription data
  endpoint: text("endpoint").notNull(),
  expirationTime: timestamp("expiration_time"),
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Auth secret
  
  // Device/context info
  platform: varchar("platform", { length: 20 }), // ios, android, desktop
  displayMode: varchar("display_mode", { length: 20 }), // standalone, browser
  
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("push_subscriptions_user_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint)
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Notification types for rate limiting and tracking
export const NOTIFICATION_TYPES = {
  WORKOUT_DETECTED: 'workout_detected',
  MISSED_WORKOUT: 'missed_workout',
  TRAINER_FOLLOWUP: 'trainer_followup',
} as const;
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Notification log for rate limiting (max 2/day per user)
export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  notificationType: varchar("notification_type", { length: 30 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  deepLink: text("deep_link"),
  
  // Delivery tracking
  sentAt: timestamp("sent_at").defaultNow(),
  delivered: boolean("delivered").default(false),
  clickedAt: timestamp("clicked_at"),
}, (table) => [
  index("notification_logs_user_idx").on(table.userId),
  index("notification_logs_user_date_idx").on(table.userId, table.sentAt)
]);

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({ 
  id: true, 
  sentAt: true 
});
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

// =============================================================================
// WORKOUT EXECUTION MODEL - Live in-session workout tracking
// =============================================================================

export const SESSION_STATUS = {
  ACTIVE: 'active',
  WEIGHTS_COMPLETE: 'weights_complete',
  CARDIO_COMPLETE: 'cardio_complete',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const;
export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

export const SESSION_PHASE = {
  WARMUP: 'warmup',
  WEIGHTS: 'weights',
  CARDIO: 'cardio',
  COOLDOWN: 'cooldown',
} as const;
export type SessionPhase = typeof SESSION_PHASE[keyof typeof SESSION_PHASE];

export const EXECUTION_MODE = {
  LIVE: 'live',
  POST_WORKOUT: 'post_workout',
} as const;
export type ExecutionMode = typeof EXECUTION_MODE[keyof typeof EXECUTION_MODE];

export const activeWorkoutSessionsTable = pgTable("active_workout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledWorkoutId: varchar("scheduled_workout_id").references(() => scheduledWorkouts.id, { onDelete: "set null" }),
  
  sessionName: varchar("session_name", { length: 200 }).notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  currentPhase: varchar("current_phase", { length: 30 }).default("weights").notNull(),
  executionMode: varchar("execution_mode", { length: 20 }).default("live").notNull(),
  
  currentExerciseIndex: integer("current_exercise_index").default(0),
  currentSetNumber: integer("current_set_number").default(1),
  
  exercisePlan: jsonb("exercise_plan"),
  cardioPlan: jsonb("cardio_plan"),
  
  startedAt: timestamp("started_at").defaultNow(),
  weightsCompletedAt: timestamp("weights_completed_at"),
  cardioCompletedAt: timestamp("cardio_completed_at"),
  completedAt: timestamp("completed_at"),
  
  totalRestTime: integer("total_rest_time").default(0),
  notes: text("notes"),
}, (table) => [
  index("active_sessions_user_idx").on(table.userId),
  index("active_sessions_status_idx").on(table.userId, table.status)
]);

export const insertActiveWorkoutSessionSchema = createInsertSchema(activeWorkoutSessionsTable).omit({ 
  id: true, 
  startedAt: true 
});
export type InsertActiveWorkoutSession = z.infer<typeof insertActiveWorkoutSessionSchema>;
export type ActiveWorkoutSessionRow = typeof activeWorkoutSessionsTable.$inferSelect;

export const SET_TYPE = {
  WARMUP: 'warmup',
  REGULAR: 'regular',
  DROP: 'drop',
  MYOREP: 'myorep',
  FAILURE: 'failure',
  BACKOFF: 'backoff',
} as const;
export type SetType = typeof SET_TYPE[keyof typeof SET_TYPE];

export const SET_DECISION = {
  INCREASE: 'increase',
  HOLD: 'hold',
  REDUCE: 'reduce',
  END_EXERCISE: 'end_exercise',
} as const;
export type SetDecision = typeof SET_DECISION[keyof typeof SET_DECISION];

export const liveSetLogs = pgTable("live_set_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => activeWorkoutSessionsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  exerciseOrder: integer("exercise_order").notNull(),
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  muscleGroup: varchar("muscle_group", { length: 50 }),
  
  setNumber: integer("set_number").notNull(),
  setType: varchar("set_type", { length: 20 }).default("regular"),
  
  targetWeight: real("target_weight"),
  targetReps: integer("target_reps"),
  targetRpe: real("target_rpe"),
  
  actualWeight: real("actual_weight"),
  actualReps: integer("actual_reps"),
  actualRpe: real("actual_rpe"),
  repsInReserve: integer("reps_in_reserve"),
  
  weightUnit: varchar("weight_unit", { length: 10 }).default("kg"),
  
  decision: varchar("decision", { length: 20 }),
  decisionReason: text("decision_reason"),
  nextSetWeight: real("next_set_weight"),
  nextSetReps: integer("next_set_reps"),
  
  restAfterSeconds: integer("rest_after_seconds"),
  performedAt: timestamp("performed_at").defaultNow(),
}, (table) => [
  index("live_set_logs_session_idx").on(table.sessionId),
  index("live_set_logs_user_idx").on(table.userId)
]);

export const insertLiveSetLogSchema = createInsertSchema(liveSetLogs).omit({ 
  id: true, 
  performedAt: true 
});
export type InsertLiveSetLog = z.infer<typeof insertLiveSetLogSchema>;
export type LiveSetLog = typeof liveSetLogs.$inferSelect;

export const CARDIO_INTERVAL_TYPE = {
  WALKING: 'walking',
  JOGGING: 'jogging',
  RUNNING: 'running',
  REST: 'rest',
} as const;
export type CardioIntervalType = typeof CARDIO_INTERVAL_TYPE[keyof typeof CARDIO_INTERVAL_TYPE];

export const HEART_RATE_ZONE = {
  ZONE_1: 'zone_1',
  ZONE_2: 'zone_2',
  ZONE_3: 'zone_3',
  ZONE_4: 'zone_4',
  ZONE_5: 'zone_5',
  UNKNOWN: 'unknown',
} as const;
export type HeartRateZone = typeof HEART_RATE_ZONE[keyof typeof HEART_RATE_ZONE];

export const cardioIntervals = pgTable("cardio_intervals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => activeWorkoutSessionsTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  intervalNumber: integer("interval_number").notNull(),
  intervalType: varchar("interval_type", { length: 20 }).notNull(),
  
  targetDurationSeconds: integer("target_duration_seconds"),
  targetSpeed: real("target_speed"),
  targetHeartRateZone: varchar("target_hr_zone", { length: 20 }),
  
  actualDurationSeconds: integer("actual_duration_seconds"),
  actualSpeed: real("actual_speed"),
  averageHeartRate: integer("average_heart_rate"),
  actualHeartRateZone: varchar("actual_hr_zone", { length: 20 }),
  
  perceivedExertion: integer("perceived_exertion"),
  
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  
  nextIntervalType: varchar("next_interval_type", { length: 20 }),
  nextIntervalDuration: integer("next_interval_duration"),
  adjustmentReason: text("adjustment_reason"),
}, (table) => [
  index("cardio_intervals_session_idx").on(table.sessionId),
  index("cardio_intervals_user_idx").on(table.userId)
]);

export const insertCardioIntervalSchema = createInsertSchema(cardioIntervals).omit({ 
  id: true, 
  startedAt: true 
});
export type InsertCardioInterval = z.infer<typeof insertCardioIntervalSchema>;
export type CardioInterval = typeof cardioIntervals.$inferSelect;

export interface ExercisePlanItem {
  exerciseOrder: number;
  exerciseName: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  targetRpe: number;
  startingWeight?: number;
  equipment?: string;
  notes?: string;
}

export interface CardioPlanItem {
  defaultWalkDuration: number;
  defaultJogDuration: number;
  totalTargetMinutes: number;
  targetHeartRateZone: HeartRateZone;
}

export interface SetLogInput {
  weight: number;
  reps: number;
  rpe?: number;
  repsInReserve?: number;
}

export interface SetDecisionResult {
  decision: SetDecision;
  reason: string;
  nextSetWeight: number;
  nextSetReps: number;
  restSeconds: number;
  endExercise: boolean;
}

export interface CardioDecisionResult {
  nextIntervalType: CardioIntervalType;
  nextDuration: number;
  nextSpeed?: number;
  reason: string;
  endCardio: boolean;
}

// =============================================================================
// WEEKLY COACHING CADENCE - Weekly review and adjustment system
// =============================================================================

export const WEEKLY_CLASSIFICATION = {
  PROGRESSING: 'progressing',
  MAINTAINING: 'maintaining',
  OVERREACHING: 'overreaching',
  UNDER_ADHERING: 'under_adhering',
} as const;
export type WeeklyClassification = typeof WEEKLY_CLASSIFICATION[keyof typeof WEEKLY_CLASSIFICATION];

export const ADJUSTMENT_TYPE = {
  VOLUME_INCREASE: 'volume_increase',
  VOLUME_DECREASE: 'volume_decrease',
  INTENSITY_INCREASE: 'intensity_increase',
  INTENSITY_DECREASE: 'intensity_decrease',
  MAINTAIN: 'maintain',
  CARDIO_EMPHASIS: 'cardio_emphasis',
  CALORIE_ADJUST: 'calorie_adjust',
  DELOAD: 'deload',
} as const;
export type AdjustmentType = typeof ADJUSTMENT_TYPE[keyof typeof ADJUSTMENT_TYPE];

export const REVIEW_TRIGGER = {
  SCHEDULED: 'scheduled',
  USER_REQUEST: 'user_request',
  INJURY: 'injury',
  ILLNESS: 'illness',
  MISSED_WEEK: 'missed_week',
} as const;
export type ReviewTrigger = typeof REVIEW_TRIGGER[keyof typeof REVIEW_TRIGGER];

export const weeklyCoachingReviews = pgTable("weekly_coaching_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  
  classification: varchar("classification", { length: 30 }).notNull(),
  trigger: varchar("trigger", { length: 30 }).default("scheduled").notNull(),
  
  weeklyAggregates: jsonb("weekly_aggregates"),
  adjustmentPlan: jsonb("adjustment_plan"),
  unifiedVerdict: jsonb("unified_verdict"),
  
  summaryMessage: text("summary_message"),
  
  workoutCompletionRate: real("workout_completion_rate"),
  strengthTrend: varchar("strength_trend", { length: 20 }),
  cardioConsistency: real("cardio_consistency"),
  stepsTrend: varchar("steps_trend", { length: 20 }),
  sleepConsistency: real("sleep_consistency"),
  hrvTrend: varchar("hrv_trend", { length: 20 }),
  adherenceScore: real("adherence_score"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("weekly_reviews_user_idx").on(table.userId),
  index("weekly_reviews_week_idx").on(table.userId, table.weekStart)
]);

export const insertWeeklyCoachingReviewSchema = createInsertSchema(weeklyCoachingReviews).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWeeklyCoachingReview = z.infer<typeof insertWeeklyCoachingReviewSchema>;
export type WeeklyCoachingReview = typeof weeklyCoachingReviews.$inferSelect;

export interface WeeklyAggregates {
  workoutsPlanned: number;
  workoutsCompleted: number;
  completionRate: number;
  avgStrengthRpe: number;
  strengthProgressionCount: number;
  cardioSessionsCompleted: number;
  totalCardioMinutes: number;
  avgDailySteps: number;
  stepsTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  avgSleepScore: number;
  sleepConsistency: number;
  avgHrv: number | null;
  hrvTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  adherenceScore: number;
}

export interface WeeklyAdjustmentPlan {
  adjustments: {
    type: AdjustmentType;
    domain: 'training' | 'nutrition' | 'recovery';
    magnitude: number;
    rationale: string;
  }[];
  nextWeekFocus: string;
  volumeMultiplier: number;
  intensityMultiplier: number;
  calorieAdjustment: number;
}

// =============================================================================
// GOAL-DRIVEN METRICS & ADJUSTMENT LOGIC
// Goals define metrics. Trends drive changes. Patience beats precision.
// =============================================================================

export const PRIMARY_GOAL = {
  WEIGHT_LOSS: 'weight_loss',
  MUSCLE_GAIN: 'muscle_gain',
  PERFORMANCE: 'performance',
  HEALTH_MAINTENANCE: 'health_maintenance',
} as const;
export type PrimaryGoal = typeof PRIMARY_GOAL[keyof typeof PRIMARY_GOAL];

export const GOAL_EVALUATION_STATUS = {
  ON_TRACK: 'on_track',
  STALLED: 'stalled',
  REGRESSING: 'regressing',
  INSUFFICIENT_DATA: 'insufficient_data',
} as const;
export type GoalEvaluationStatus = typeof GOAL_EVALUATION_STATUS[keyof typeof GOAL_EVALUATION_STATUS];

export const ADJUSTMENT_AXIS = {
  CALORIES: 'calories',
  TRAINING_VOLUME: 'training_volume',
  CARDIO_EMPHASIS: 'cardio_emphasis',
  RECOVERY_BIAS: 'recovery_bias',
} as const;
export type AdjustmentAxis = typeof ADJUSTMENT_AXIS[keyof typeof ADJUSTMENT_AXIS];

export interface GoalMetricStack {
  goal: PrimaryGoal;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  ignoreMetrics: string[];
}

export const GOAL_METRIC_STACKS: Record<PrimaryGoal, GoalMetricStack> = {
  [PRIMARY_GOAL.WEIGHT_LOSS]: {
    goal: PRIMARY_GOAL.WEIGHT_LOSS,
    primaryMetrics: ['weekly_avg_weight_trend'],
    secondaryMetrics: ['waist_measurement', 'calorie_adherence'],
    ignoreMetrics: ['single_weigh_ins', 'water_fluctuations'],
  },
  [PRIMARY_GOAL.MUSCLE_GAIN]: {
    goal: PRIMARY_GOAL.MUSCLE_GAIN,
    primaryMetrics: ['strength_progression'],
    secondaryMetrics: ['body_weight_trend', 'training_volume_completion'],
    ignoreMetrics: ['short_term_scale_stagnation'],
  },
  [PRIMARY_GOAL.PERFORMANCE]: {
    goal: PRIMARY_GOAL.PERFORMANCE,
    primaryMetrics: ['sport_specific_performance', 'pace_power_volume_load'],
    secondaryMetrics: ['recovery_trends', 'consistency'],
    ignoreMetrics: ['cosmetic_body_changes'],
  },
  [PRIMARY_GOAL.HEALTH_MAINTENANCE]: {
    goal: PRIMARY_GOAL.HEALTH_MAINTENANCE,
    primaryMetrics: ['training_consistency', 'steps_consistency', 'sleep_consistency'],
    secondaryMetrics: ['stable_weight_range', 'subjective_energy'],
    ignoreMetrics: ['maximal_performance', 'aggressive_progression'],
  },
};

export const goalEvaluations = pgTable("goal_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  primaryGoal: varchar("primary_goal", { length: 30 }).notNull(),
  evaluationStatus: varchar("evaluation_status", { length: 30 }).notNull(),
  consecutiveWeeksInStatus: integer("consecutive_weeks_in_status").default(1),
  
  primaryMetricValues: jsonb("primary_metric_values").$type<Record<string, number | null>>(),
  secondaryMetricValues: jsonb("secondary_metric_values").$type<Record<string, number | null>>(),
  
  dataCompleteness: real("data_completeness"),
  daysWithData: integer("days_with_data"),
  
  adjustmentTriggered: boolean("adjustment_triggered").default(false),
  adjustmentAxis: varchar("adjustment_axis", { length: 30 }),
  adjustmentMagnitude: real("adjustment_magnitude"),
  adjustmentRationale: text("adjustment_rationale"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("goal_evaluations_user_week_idx").on(table.userId, table.weekStart),
]);

export const insertGoalEvaluationSchema = createInsertSchema(goalEvaluations).omit({ 
  id: true,
  createdAt: true 
});
export type InsertGoalEvaluation = z.infer<typeof insertGoalEvaluationSchema>;
export type GoalEvaluation = typeof goalEvaluations.$inferSelect;

export interface GoalProgress {
  goal: PrimaryGoal;
  status: GoalEvaluationStatus;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  consecutiveWeeks: number;
  primaryMetrics: Record<string, { current: number | null; previous: number | null; trend: string }>;
  recommendedAction: string | null;
}

// Weekly Review Reports - AI Trainer's end-of-week analysis and adjustments
export const weeklyReviewReports = pgTable("weekly_review_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  
  // Weekly classification from cadence engine
  weeklyClassification: varchar("weekly_classification", { length: 30 }), // progressing, maintaining, overreaching, under_adhering
  
  // Recovery & Effort Summary
  avgSleepMinutes: integer("avg_sleep_minutes"),
  avgSleepQuality: real("avg_sleep_quality"),
  avgHrvScore: real("avg_hrv_score"),
  avgRpe: real("avg_rpe"),
  workoutsCompleted: integer("workouts_completed"),
  workoutsPlanned: integer("workouts_planned"),
  completionRate: real("completion_rate"),
  
  // Caloric Analysis & Adjustment
  previousCalorieTarget: integer("previous_calorie_target"),
  newCalorieTarget: integer("new_calorie_target"),
  calorieAdjustmentPercent: real("calorie_adjustment_percent"),
  calorieAdjustmentReason: text("calorie_adjustment_reason"),
  
  // Macros Adjustment
  previousProteinTarget: integer("previous_protein_target"),
  newProteinTarget: integer("new_protein_target"),
  previousCarbsTarget: integer("previous_carbs_target"),
  newCarbsTarget: integer("new_carbs_target"),
  previousFatsTarget: integer("previous_fats_target"),
  newFatsTarget: integer("new_fats_target"),
  
  // Workout Plan Amendments
  workoutAdjustments: jsonb("workout_adjustments").$type<{
    volumeChange: 'increase' | 'maintain' | 'decrease' | 'deload';
    volumeChangePercent: number;
    intensityChange: 'increase' | 'maintain' | 'decrease';
    focusAreas: string[];
    deloadRecommended: boolean;
    specificChanges: string[];
  }>(),
  
  // Report Content (trainer-generated summary)
  reportTitle: varchar("report_title", { length: 200 }),
  reportSummary: text("report_summary"),
  keyInsights: jsonb("key_insights").$type<string[]>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  
  // Goal Progress
  primaryGoal: varchar("primary_goal", { length: 30 }),
  goalProgressStatus: varchar("goal_progress_status", { length: 30 }), // on_track, ahead, behind, stalled
  
  // Meta
  appliedAt: timestamp("applied_at"),
  acknowledgedByUser: boolean("acknowledged_by_user").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("weekly_review_reports_user_week_idx").on(table.userId, table.weekStart),
]);

export const insertWeeklyReviewReportSchema = createInsertSchema(weeklyReviewReports).omit({ 
  id: true,
  createdAt: true 
});
export type InsertWeeklyReviewReport = z.infer<typeof insertWeeklyReviewReportSchema>;
export type WeeklyReviewReport = typeof weeklyReviewReports.$inferSelect;

// Trainer Knowledge Base - AI-processed insights from fitness sources
export const trainerKnowledge = pgTable("trainer_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Knowledge classification
  category: varchar("category", { length: 50 }).notNull(), // exercise_technique, nutrition_science, recovery, programming, injury_prevention
  subcategory: varchar("subcategory", { length: 100 }), // e.g., "hypertrophy", "protein_timing", "sleep_optimization"
  
  // The insight itself (distilled, actionable knowledge)
  insight: text("insight").notNull(),
  
  // Application context - when/how to apply this knowledge
  applicationContext: text("application_context"), // e.g., "when programming for muscle gain", "for athletes training twice daily"
  
  // Confidence and relevance
  confidenceScore: real("confidence_score").default(0.8), // 0-1, how confident we are in this insight
  relevanceScore: real("relevance_score").default(0.8), // 0-1, how broadly applicable
  
  // Source tracking (internal only, not shown to users)
  sourceType: varchar("source_type", { length: 30 }), // rss_feed, api, research_summary
  sourceName: varchar("source_name", { length: 200 }), // e.g., "ACE Fitness", "Precision Nutrition"
  sourceUrl: text("source_url"),
  originalTitle: varchar("original_title", { length: 500 }),
  
  // Temporal relevance
  learnedAt: timestamp("learned_at").defaultNow(),
  lastApplied: timestamp("last_applied"), // track when this knowledge was used
  applicationCount: integer("application_count").default(0),
  
  // Lifecycle
  isActive: boolean("is_active").default(true),
  supersededBy: varchar("superseded_by"), // if newer research updates this insight
  
  // Embedding for semantic search (future enhancement)
  contentHash: varchar("content_hash", { length: 64 }), // to avoid duplicate insights
}, (table) => [
  index("trainer_knowledge_category_idx").on(table.category),
  index("trainer_knowledge_active_idx").on(table.isActive),
  index("trainer_knowledge_learned_idx").on(table.learnedAt),
]);

export const insertTrainerKnowledgeSchema = createInsertSchema(trainerKnowledge).omit({ 
  id: true,
  learnedAt: true,
  lastApplied: true,
  applicationCount: true,
});
export type InsertTrainerKnowledge = z.infer<typeof insertTrainerKnowledgeSchema>;
export type TrainerKnowledge = typeof trainerKnowledge.$inferSelect;

// Learning job history - track when the trainer studied
export const learningJobHistory = pgTable("learning_job_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  jobType: varchar("job_type", { length: 30 }).notNull(), // scheduled, manual
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Results
  sourcesProcessed: integer("sources_processed").default(0),
  articlesProcessed: integer("articles_processed").default(0),
  insightsGenerated: integer("insights_generated").default(0),
  duplicatesSkipped: integer("duplicates_skipped").default(0),
  
  // Errors if any
  status: varchar("status", { length: 20 }).default("running"), // running, completed, failed
  errorMessage: text("error_message"),
  
  // Details
  sourcesUsed: jsonb("sources_used").$type<string[]>(),
});

export const insertLearningJobHistorySchema = createInsertSchema(learningJobHistory).omit({ 
  id: true,
  startedAt: true,
});
export type InsertLearningJobHistory = z.infer<typeof insertLearningJobHistorySchema>;
export type LearningJobHistory = typeof learningJobHistory.$inferSelect;
