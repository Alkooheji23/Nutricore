import { z } from "zod";

// Exercise schema for structured strength workouts
export const ExerciseSchema = z.object({
  name: z.string().min(1).describe("Name of the exercise"),
  sets: z.coerce.number().int().positive().describe("Number of sets"),
  reps: z.union([
    z.coerce.number().int().positive(),
    z.string().regex(/^\d+(-\d+)?$/) // Allows "8" or "8-12" format
  ]).describe("Number of reps or rep range (e.g., '8-12')"),
  weight: z.coerce.number().optional().describe("Weight in user's preferred unit"),
  targetRir: z.coerce.number().int().min(0).max(5).optional().describe("Target Reps in Reserve (0-5)"),
  muscleGroup: z.string().optional().describe("Primary muscle group targeted"),
  notes: z.string().optional().describe("Notes for the exercise"),
});

export type ScheduledExercise = z.infer<typeof ExerciseSchema>;

// Validation helper for strength workouts
export function isValidStrengthWorkout(exercises: unknown): boolean {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return false;
  }
  
  return exercises.every(ex => {
    if (typeof ex !== 'object' || ex === null) return false;
    const exercise = ex as Record<string, unknown>;
    
    // Must have name, sets, and either reps or targetRir
    const hasName = typeof exercise.name === 'string' && exercise.name.length > 0;
    const hasSets = typeof exercise.sets === 'number' && exercise.sets > 0;
    const hasReps = exercise.reps !== undefined && exercise.reps !== null;
    const hasTargetRir = typeof exercise.targetRir === 'number';
    
    return hasName && hasSets && (hasReps || hasTargetRir);
  });
}

// Check if activity type is strength-based
export function isStrengthActivityType(activityType: string): boolean {
  const strengthTypes = ['strength', 'strength_training', 'weightlifting', 'resistance', 'gym'];
  return strengthTypes.some(t => activityType.toLowerCase().includes(t));
}

// Schema for logging individual sets with exact reps/weight per set
export const LoggedSetSchema = z.object({
  reps: z.coerce.number().int().nonnegative().describe("Actual reps completed for this set"),
  weight: z.coerce.number().nonnegative().optional().describe("Weight used for this set"),
  rir: z.coerce.number().int().min(0).max(10).optional().describe("Reps in Reserve"),
  restSeconds: z.coerce.number().int().nonnegative().optional().describe("Rest time taken after this set in seconds"),
});

// Schema for logging exercises with individual sets
export const LoggedExerciseSchema = z.object({
  name: z.string().min(1).describe("Name of the exercise"),
  sets: z.array(LoggedSetSchema).min(1).describe("Array of sets with individual reps/weight/rest for each set"),
  muscleGroup: z.string().optional().describe("Primary muscle group targeted"),
  notes: z.string().optional().describe("Notes for the exercise"),
});

export const LogWorkoutArgsSchema = z.object({
  activityName: z.string().min(1).describe("Name of the workout/activity"),
  activityType: z.string().min(1).describe("Type of activity: running, walking, cycling, strength, hiit, yoga, etc."),
  duration: z.coerce.number().positive().describe("Duration in minutes"),
  intensity: z.enum(["low", "moderate", "high"]).optional().default("moderate").describe("Workout intensity level"),
  caloriesBurned: z.coerce.number().positive().optional().describe("Estimated calories burned"),
  notes: z.string().optional().describe("Any notes about the workout"),
  scheduledDate: z.string().optional().describe("ISO date string for when workout occurred, defaults to today"),
  exercises: z.array(LoggedExerciseSchema).optional().describe("REQUIRED for strength workouts: Array of exercises with exact sets/reps/weights as logged by the athlete. Each set can have different reps and weights. NEVER modify, hallucinate, or change the values the athlete provided."),
});

export const ScheduleWorkoutArgsSchema = z.object({
  title: z.string().min(1).describe("Title for the scheduled workout"),
  activityType: z.string().min(1).describe("Type of activity"),
  duration: z.coerce.number().positive().optional().describe("Planned duration in minutes (optional for strength workouts)"),
  intensity: z.enum(["low", "moderate", "high"]).optional().default("moderate"),
  scheduledDate: z.string().min(1).describe("ISO date string for when to schedule"),
  description: z.string().optional().describe("Description of the workout plan"),
  exercises: z.array(ExerciseSchema).optional().describe("Structured exercises for strength workouts (required for strength type)"),
}).refine(
  (data) => {
    // Strength workouts MUST have exercises with sets/reps
    if (isStrengthActivityType(data.activityType)) {
      return isValidStrengthWorkout(data.exercises);
    }
    // Non-strength workouts need duration
    return data.duration !== undefined && data.duration > 0;
  },
  {
    message: "Strength workouts require structured exercises with sets and reps. Non-strength workouts require duration.",
  }
);

export const DeleteScheduledWorkoutsArgsSchema = z.object({
  fromDate: z.string().min(1).describe("ISO date string - delete workouts from this date onwards"),
  toDate: z.string().optional().describe("ISO date string - delete workouts until this date (optional, defaults to far future)"),
});

export const ConfirmWearableWorkoutArgsSchema = z.object({
  wearableActivityId: z.string().min(1).describe("ID of the pending wearable activity to confirm"),
  exercises: z.array(z.object({
    name: z.string().min(1),
    sets: z.coerce.number().int().positive(),
    reps: z.union([z.coerce.number().int().positive(), z.string()]),
    weight: z.coerce.number().optional(),
  })).optional().describe("User-provided exercises for strength workouts"),
  distance: z.coerce.number().positive().optional().describe("Distance in km"),
  pace: z.coerce.number().positive().optional().describe("Pace in min/km"),
  notes: z.string().optional().describe("User notes"),
});

export const SkipWearableConfirmationArgsSchema = z.object({
  wearableActivityId: z.string().min(1).describe("ID of the pending wearable activity to skip"),
});

export const UpdateScheduledWorkoutArgsSchema = z.object({
  workoutId: z.string().min(1).describe("ID of the scheduled workout to update"),
  title: z.string().optional().describe("New title for the workout"),
  exercises: z.array(ExerciseSchema).optional().describe("Updated exercises for strength workouts"),
  duration: z.coerce.number().positive().optional().describe("Updated duration in minutes"),
  description: z.string().optional().describe("Updated description"),
  scheduledDate: z.string().optional().describe("New scheduled date (ISO format)"),
});


export const LogWorkoutActionSchema = z.object({
  action: z.literal("log_workout"),
  activityName: z.string().describe("Name of the workout/activity"),
  activityType: z.string().describe("Type of activity: running, walking, cycling, strength, hiit, yoga, etc."),
  duration: z.number().describe("Duration in minutes"),
  intensity: z.enum(["low", "moderate", "high"]).optional().describe("Workout intensity level"),
  caloriesBurned: z.number().optional().describe("Estimated calories burned"),
  notes: z.string().optional().describe("Any notes about the workout"),
  scheduledDate: z.string().optional().describe("ISO date string for when workout occurred, defaults to today"),
});

export const ScheduleWorkoutActionSchema = z.object({
  action: z.literal("schedule_workout"),
  title: z.string().describe("Title for the scheduled workout"),
  activityType: z.string().describe("Type of activity"),
  duration: z.number().describe("Planned duration in minutes"),
  intensity: z.enum(["low", "moderate", "high"]).optional(),
  scheduledDate: z.string().describe("ISO date string for when to schedule"),
  description: z.string().optional().describe("Description of the workout plan"),
});

export const UpdateGoalActionSchema = z.object({
  action: z.literal("update_goal"),
  goalType: z.enum(["weight", "fitness", "activity"]).describe("Type of goal to update"),
  value: z.string().describe("New goal value"),
});

export const AgentActionSchema = z.discriminatedUnion("action", [
  LogWorkoutActionSchema,
  ScheduleWorkoutActionSchema,
  UpdateGoalActionSchema,
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type LogWorkoutAction = z.infer<typeof LogWorkoutActionSchema>;
export type ScheduleWorkoutAction = z.infer<typeof ScheduleWorkoutActionSchema>;
export type UpdateGoalAction = z.infer<typeof UpdateGoalActionSchema>;

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "delete_scheduled_workouts",
      description: "Delete/clear scheduled workouts from the calendar. Use this when the user wants to remove, clear, or delete upcoming workouts from a specific date or date range.",
      parameters: {
        type: "object",
        properties: {
          fromDate: {
            type: "string",
            description: "ISO date string - delete workouts from this date onwards",
          },
          toDate: {
            type: "string",
            description: "ISO date string - delete workouts until this date (optional)",
          },
        },
        required: ["fromDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_workout",
      description: "Log a completed workout or activity for the user. Use this when the user says they did a workout, went for a walk/run, or completed any physical activity. For strength workouts, you MUST include the 'exercises' array with EXACT reps and weights for each set as the athlete stated - NEVER modify or make up numbers.",
      parameters: {
        type: "object",
        properties: {
          activityName: {
            type: "string",
            description: "Name of the workout/activity (e.g., 'Morning Walk', 'Leg Day', 'HIIT Session')",
          },
          activityType: {
            type: "string",
            enum: ["running", "strength", "walking", "cardio", "cycling", "swimming", "hiit", "yoga", "stretching", "sports", "other"],
            description: "Category of the activity - choose the closest match",
          },
          duration: {
            type: "number",
            description: "Duration in minutes",
          },
          intensity: {
            type: "string",
            enum: ["low", "moderate", "high"],
            description: "Intensity level of the workout",
          },
          caloriesBurned: {
            type: "number",
            description: "Estimated calories burned (optional)",
          },
          notes: {
            type: "string",
            description: "Any additional notes about the workout",
          },
          scheduledDate: {
            type: "string",
            description: "ISO date string for when workout occurred (defaults to today)",
          },
          exercises: {
            type: "array",
            description: "REQUIRED for strength workouts. Array of exercises with EXACT sets/reps/weights as the athlete stated. Each set can have different reps and weights. NEVER modify, round, or hallucinate any numbers.",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the exercise",
                },
                sets: {
                  type: "array",
                  description: "Array of individual sets, each with its own reps and weight",
                  items: {
                    type: "object",
                    properties: {
                      reps: {
                        type: "number",
                        description: "Actual reps completed for this set - use EXACTLY what athlete said",
                      },
                      weight: {
                        type: "number",
                        description: "Weight used for this set - use EXACTLY what athlete said",
                      },
                      rir: {
                        type: "number",
                        description: "Reps in Reserve (optional)",
                      },
                    },
                    required: ["reps"],
                  },
                },
                muscleGroup: {
                  type: "string",
                  description: "Primary muscle group (optional)",
                },
                notes: {
                  type: "string",
                  description: "Notes for the exercise (optional)",
                },
              },
              required: ["name", "sets"],
            },
          },
        },
        required: ["activityName", "activityType", "duration"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_workout",
      description: "Schedule a future workout for the user. IMPORTANT: For strength workouts, you MUST include the 'exercises' array with structured sets and reps. Duration-only strength workouts are NOT allowed.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title for the scheduled workout",
          },
          activityType: {
            type: "string",
            enum: ["running", "strength", "walking", "cardio", "cycling", "swimming", "hiit", "yoga", "stretching", "sports", "other"],
            description: "Category of the activity - choose the closest match",
          },
          duration: {
            type: "number",
            description: "Planned duration in minutes (required for non-strength, optional for strength)",
          },
          intensity: {
            type: "string",
            enum: ["low", "moderate", "high"],
            description: "Intensity level",
          },
          scheduledDate: {
            type: "string",
            description: "ISO date string for when to schedule the workout",
          },
          description: {
            type: "string",
            description: "Description of the workout plan",
          },
          exercises: {
            type: "array",
            description: "REQUIRED for strength workouts. Array of exercises with sets and reps.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exercise name (e.g., 'Bench Press')" },
                sets: { type: "number", description: "Number of sets" },
                reps: { type: "string", description: "Rep count or range (e.g., '8' or '8-12')" },
                weight: { type: "number", description: "Target weight (optional)" },
                targetRir: { type: "number", description: "Target RIR 0-5 (optional)" },
                muscleGroup: { type: "string", description: "Primary muscle group (optional)" },
              },
              required: ["name", "sets", "reps"],
            },
          },
        },
        required: ["title", "activityType", "scheduledDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "confirm_wearable_workout",
      description: "Confirm a smartwatch-detected workout after the user provides additional details. Use when user confirms or enriches a pending wearable activity. For strength workouts, collect exercises/sets/reps from user. For cardio, collect distance/pace if missing. NEVER assume or fabricate workout structure.",
      parameters: {
        type: "object",
        properties: {
          wearableActivityId: {
            type: "string",
            description: "ID of the pending wearable activity to confirm",
          },
          exercises: {
            type: "array",
            description: "User-provided exercises for strength workouts",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exercise name" },
                sets: { type: "number", description: "Number of sets completed" },
                reps: { type: "string", description: "Reps per set" },
                weight: { type: "number", description: "Weight used (optional)" },
              },
              required: ["name", "sets", "reps"],
            },
          },
          distance: {
            type: "number",
            description: "Distance in km (for cardio workouts, if user provides)",
          },
          pace: {
            type: "number",
            description: "Pace in min/km (for running workouts, if user provides)",
          },
          notes: {
            type: "string",
            description: "User notes about the workout",
          },
        },
        required: ["wearableActivityId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "skip_wearable_confirmation",
      description: "Skip confirmation for a smartwatch-detected workout. Use when user explicitly says they don't want to add details or confirm the workout. The activity will be marked as confirmed without structure.",
      parameters: {
        type: "object",
        properties: {
          wearableActivityId: {
            type: "string",
            description: "ID of the pending wearable activity to skip",
          },
        },
        required: ["wearableActivityId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_scheduled_workout",
      description: "Update an existing scheduled workout. Use this to modify exercises, title, duration, or date of a workout that's already on the calendar. For strength workouts, provide the full exercises array with the updated exercises.",
      parameters: {
        type: "object",
        properties: {
          workoutId: {
            type: "string",
            description: "ID of the scheduled workout to update",
          },
          title: {
            type: "string",
            description: "New title for the workout (optional)",
          },
          exercises: {
            type: "array",
            description: "Updated exercises for strength workouts",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Exercise name" },
                sets: { type: "number", description: "Number of sets" },
                reps: { type: "string", description: "Rep count or range" },
                weight: { type: "number", description: "Target weight (optional)" },
                targetRir: { type: "number", description: "Target RIR 0-5 (optional)" },
                muscleGroup: { type: "string", description: "Primary muscle group (optional)" },
              },
              required: ["name", "sets", "reps"],
            },
          },
          duration: {
            type: "number",
            description: "Updated duration in minutes (optional)",
          },
          description: {
            type: "string",
            description: "Updated description (optional)",
          },
          scheduledDate: {
            type: "string",
            description: "New scheduled date in ISO format (optional)",
          },
        },
        required: ["workoutId"],
      },
    },
  },
];
