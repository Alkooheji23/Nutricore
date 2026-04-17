# NutriCore Current State Documentation

**Generated:** December 27, 2024  
**Purpose:** External review and planning reference (descriptive only, no code changes)

---

## 1. Workout & Activity Data Model

### Core Tables

#### `workout_logs` (User-logged workouts)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | Foreign key to users |
| date | timestamp | Workout date |
| workoutName | varchar(200) | Name of the workout |
| activityType | varchar(50) | strength, running, cycling, etc. |
| duration | integer | Duration in minutes |
| caloriesBurned | integer | Calories burned |
| distance | real | Distance in km (for endurance) |
| notes | text | User notes |
| exercises | jsonb | Array of exercise data |
| completed | boolean | Completion status |
| source | varchar(50) | manual, fitbit, garmin |
| workoutMode | varchar(30) | auto_tracked, structured_strength, hybrid |
| linkedWearableActivityId | varchar | Links to wearable_activities for hybrid mode |
| wearableHeartRateAvg | integer | Background HR from wearable |
| wearableHeartRateMax | integer | Max HR from wearable |
| wearableCalories | integer | Calories from wearable |

#### `wearable_activities` (Auto-imported from smartwatches)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | Foreign key to users |
| date | timestamp | Activity date |
| activityName | varchar(200) | Name from device |
| activityType | varchar(50) | strength, running, cycling, etc. |
| sourceDevice | varchar(20) | fitbit, garmin |
| deviceActivityId | varchar(100) | Original ID from device |
| duration | integer | Minutes |
| caloriesBurned | integer | Calories |
| distance | real | Distance in km |
| averageHeartRate | integer | Avg HR |
| maxHeartRate | integer | Max HR |
| heartRateZones | jsonb | Time in HR zones |
| elevationGain | real | Elevation in meters |
| avgPace | real | min/km for running |
| avgPower | integer | Watts for cycling |
| trainingLoad | integer | Garmin-specific metric |
| notes | text | User notes |
| linkedWorkoutLogId | varchar | Links to workout_logs for hybrid mode |
| structurePromptShown | boolean | Whether user was prompted to add structure |
| structurePromptResponse | varchar(20) | yes, no, skipped |

#### `scheduled_workouts` (Weekly planning)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | Foreign key to users |
| scheduledDate | timestamp | Planned date |
| dayOfWeek | varchar(15) | Day name |
| timeSlot | varchar(20) | Time preference |
| workoutType | varchar(100) | Type of workout |
| activityType | varchar(50) | running, strength_training, yoga, etc. |
| title | varchar(200) | Workout title |
| description | text | Description |
| duration | integer | Planned duration |
| intensity | varchar(20) | Intensity level |
| exercises | jsonb | Planned exercises |
| distance | real | For endurance activities |
| intervals | integer | For HIIT workouts |
| workTime | integer | Seconds per work interval |
| restTime | integer | Seconds per rest interval |
| perceivedEffort | integer | 1-10 scale |
| mobilityType | varchar(50) | For recovery workouts |
| sportCategory | varchar(50) | Sport category |
| dataSource | varchar(30) | manual, fitbit, garmin, ai_generated |
| linkedWearableActivityId | varchar | Link when completed via wearable |
| status | varchar(20) | scheduled, completed, skipped |
| completedAt | timestamp | Completion time |
| performanceFeedback | varchar(20) | easy, moderate, hard |
| aiGenerated | boolean | Whether AI created this |
| weekNumber | integer | Week number |

#### `planned_exercises` (Exercises within scheduled workouts)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| scheduledWorkoutId | varchar | Foreign key to scheduled_workouts |
| userId | varchar | Foreign key to users |
| exerciseName | varchar(200) | Exercise name |
| muscleGroup | varchar(50) | chest, back, shoulders, legs, arms, core |
| equipmentType | varchar(50) | machine, barbell, dumbbell, cable, bodyweight |
| targetSets | integer | Target number of sets |
| targetRepsMin | integer | Minimum target reps |
| targetRepsMax | integer | Maximum target reps |
| targetRir | integer | Target Reps in Reserve |
| exerciseOrder | integer | Order in workout |
| notes | text | Notes |
| supersetWith | varchar | Reference to another exercise |

#### `exercise_sets` (Individual set logging)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| plannedExerciseId | varchar | Foreign key to planned_exercises |
| userId | varchar | Foreign key to users |
| setNumber | integer | Set number |
| setType | varchar(30) | regular, warmup, myorep, drop, failure |
| targetWeight | real | Prescribed weight |
| targetReps | integer | Prescribed reps |
| targetRir | integer | Prescribed RIR |
| weight | real | Actual weight logged |
| reps | integer | Actual reps logged |
| rir | integer | Actual RIR logged |
| status | varchar(20) | pending, logged, skipped |
| loggedAt | timestamp | When logged |
| notes | text | Notes |

#### `daily_activity` (Aggregated daily metrics)
| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | Foreign key to users |
| date | varchar(10) | YYYY-MM-DD |
| steps | integer | Daily steps |
| caloriesBurned | integer | Total calories |
| activeMinutes | integer | Active minutes |
| distance | real | Distance |
| floors | integer | Floors climbed |
| restingHeartRate | integer | Resting HR |
| averageHeartRate | integer | Avg HR |
| maxHeartRate | integer | Max HR |
| heartRateZones | jsonb | HR zone breakdown |
| hrvRmssd | real | HRV RMSSD |
| hrvScore | integer | Normalized HRV score |
| sleepMinutes | integer | Sleep duration |
| sleepEfficiency | integer | Sleep efficiency % |
| sleepStages | jsonb | {deep, light, rem, awake} |
| timeInBed | integer | Total time in bed |
| source | varchar(50) | Data source |

#### `device_metrics_raw` (Per-device raw data before conflict resolution)
Stores raw metrics from each connected device separately. Used for multi-device conflict resolution to prevent double-counting when user has multiple devices.

### Activity Types / Categories
Activity types are stored as varchar fields. Common values include:
- **Strength**: strength, strength_training
- **Endurance**: running, cycling, swimming, walking
- **Mixed**: hiit, crossfit, circuit_training
- **Skill/Sport**: yoga, pilates, martial_arts
- **Recovery**: stretching, foam_rolling, mobility

---

## 2. Workout Creation Flow

### Three Workout Logging Modes

Users can log workouts in three modes (stored in `users.defaultWorkoutMode`):

#### Mode 1: Auto-Tracked (Smartwatch-first)
1. User syncs smartwatch (Garmin/Fitbit)
2. System auto-imports workout to `wearable_activities` table
3. Duration, calories, heart rate are captured automatically
4. User can optionally add notes
5. **No manual sets/reps required**

#### Mode 2: Structured Strength (Manual-first)
1. User navigates to Tracker page
2. Selects "Log Workout" 
3. Enters workout name
4. Adds exercises with:
   - Exercise name (required)
   - Sets (required)
   - Reps (required)
   - Weight (required)
   - RIR - Reps in Reserve (optional)
5. Smartwatch data captured as background metrics if connected

#### Mode 3: Hybrid (Both combined)
1. System auto-imports smartwatch workout first
2. User sees prompt asking if they want to add structure
3. If yes, user adds exercises/sets/reps to the imported activity
4. Links `wearable_activities` to `workout_logs` via `linkedWorkoutLogId`

### Required vs Conditional Fields

**Always Required:**
- workoutName / activityName
- date

**Required for Structured Strength:**
- At least one exercise with sets, reps, weight

**Conditional (based on activity type):**
- distance (endurance activities)
- intervals, workTime, restTime (HIIT)
- muscleGroup (strength exercises)

---

## 3. Smartwatch Integration

### Connected Devices

#### Garmin (OAuth 1.0a)
- **Auth Flow**: OAuth 1.0a with request token → user authorization → access token exchange
- **Token Storage**: `smartwatch_connections.accessToken` + `smartwatch_connections.tokenSecret`
- **User ID**: Stored in `smartwatch_connections.garminUserId`
- **Data Sync**: 
  - Manual: "Sync Now" button triggers API pull
  - Automatic: Garmin webhooks push data when user syncs watch to Garmin Connect app

#### Fitbit (OAuth 2.0 PKCE)
- **Auth Flow**: OAuth 2.0 with PKCE (code_verifier/code_challenge)
- **Token Storage**: `smartwatch_connections.accessToken` + `smartwatch_connections.refreshToken`
- **Token Expiry**: `smartwatch_connections.tokenExpiresAt` (auto-refresh on expiry)
- **User ID**: Stored in `smartwatch_connections.fitbitUserId`
- **Scopes**: activity, heartrate, sleep, profile

### Data Imported and Storage

| Data Type | Source | Storage Table |
|-----------|--------|---------------|
| Daily steps, calories, distance, active minutes | Garmin/Fitbit | `daily_activity` |
| Heart rate (resting, avg, max, zones) | Garmin/Fitbit | `daily_activity` |
| Sleep (duration, stages, efficiency) | Garmin/Fitbit | `daily_activity` |
| HRV (RMSSD, score) | Garmin/Fitbit | `daily_activity` |
| Individual workouts/activities | Garmin/Fitbit | `wearable_activities` |
| Raw per-device metrics (for conflict resolution) | Garmin/Fitbit | `device_metrics_raw` |

### Raw Data Preservation
Yes, raw device data is preserved in `device_metrics_raw` table before conflict resolution. This enables:
- Multi-device support without double-counting
- Per-metric source selection (uses primary device or most complete data)
- Audit trail of what each device reported

### Primary Device
Users can set a primary device (`users.primaryDevice`) which takes precedence in conflict resolution when both Garmin and Fitbit report overlapping data.

---

## 4. Trainer / AI Logic

### Non-Chat Logic (server/coaching/)

The following automated logic exists independent of AI chat:

#### `fitnessEngine.ts` - Core Training Logic

**Volume Adjustment (`adjustVolume`)**
- Analyzes: soreness (1-10), average RPE, sleep quality, stress level
- Outputs: action (increase/maintain/decrease/deload), volumeMultiplier, reason
- Rules:
  - Soreness ≥8 → deload (0.6x volume)
  - Soreness ≥6 → decrease (0.85x volume)
  - RPE ≥9.5 → decrease (0.9x volume)
  - Poor sleep or high stress → decrease (0.85x volume)
  - Low RPE + good recovery → increase (1.1x volume)

**Progressive Overload (`calculateProgressiveOverload`)**
- Inputs: previous weight, previous reps, target RPE, actual RPE
- Outputs: new weight, new reps, recommendation text
- Logic:
  - RPE 2+ below target → increase weight 5%
  - RPE 1 below target → add 1 rep
  - RPE 1+ above target → reduce weight 5%
  - On target → maintain

**Deload Detection (`shouldDeload`)**
- Inputs: weeks without deload, average soreness, average RPE, performance decline
- Triggers deload if:
  - 5+ weeks without deload
  - High soreness (≥7) AND high RPE (≥9)
  - Performance is declining

**Workout Split Generation (`generateWorkoutSplit`)**
- Inputs: days per week, goal
- Outputs: array of workout day names
- Examples:
  - 3 days + muscle_gain → ['Push', 'Pull', 'Legs']
  - 4 days + muscle_gain → ['Upper A', 'Lower A', 'Upper B', 'Lower B']
  - 6 days → PPL x2

#### `weeklyPlanGenerator.ts` - Plan Generation

**`generateWeeklyPlan`** orchestrates:
1. Volume adjustment based on recovery metrics
2. Volume recommendations for experience level
3. Workout split generation
4. Building workout days with exercises
5. Nutrition calculation (macros, meal distribution)
6. Summary and recommendations

#### `contextBuilder.ts` - AI Context Building

Builds structured context for AI trainer including:
- Tone preference (strict, friendly, soft, energetic, minimal)
- Recovery metrics from weekly check-ins
- Muscle volume tracking (premium users)
- Performance trends (premium users)
- Recent workout feedback (easy/moderate/hard ratings)

### What the Trainer Currently Does
- Responds to chat messages with personalized advice
- Uses context from workouts, goals, and preferences
- Can suggest workout adjustments via chat
- Collects post-workout feedback (easy/moderate/hard)

### What the Trainer Does NOT Do (Yet)
- Does not automatically update plans without chat interaction
- Does not push notifications for recommendations
- Does not auto-generate weekly plans (requires user initiation)
- Volume/overload logic exists but is not automatically applied

---

## 5. Navigation & UX Structure

### Main Navigation Items

| Route | Label | Icon | Access |
|-------|-------|------|--------|
| /home | Home | Home | All users |
| /chat | My Trainer | MessageSquare | All users |
| /calendar | Calendar | ClipboardList | All users |
| /plans | Workouts | ClipboardList | All users |
| /profile | Profile | User | All users |
| /admin | Admin Dashboard | Shield | Admin only |

### Additional Pages (Not in main nav)

| Route | Purpose |
|-------|---------|
| / | Landing page (unauthenticated) |
| /onboarding | Profile setup (first-time users) |
| /tracker | Daily activity and workout logging |
| /progress | Progress tracking and trends |
| /devices | Smartwatch connection management |
| /privacy | Privacy policy |
| /verify-email | Email verification |

### Where Workouts Live
- **Weekly Plan view**: `/plans` - Shows scheduled workouts for the week
- **Daily Logging**: `/tracker` - Log food, workouts, and view daily activity
- **Calendar View**: `/calendar` - Calendar view of scheduled workouts

### Where Chat Lives
- `/chat` - Full chat interface with AI trainer
- Conversation history is stored in `conversations` and `chat_messages` tables

### Default Landing Screen
- Unauthenticated: `/` (Landing page)
- Authenticated with incomplete profile: `/home` (redirects to onboarding via chat)
- Authenticated with complete profile: `/home` (Dashboard)

---

## 6. Known Constraints or Fragile Areas

### Fragile Areas (Handle with Care)

1. **Session/Auth Handling (`AuthContext.tsx`)**
   - Complex retry logic for PWA session persistence
   - localStorage caching for iOS/Android cookie issues
   - Multiple fallback mechanisms - changing one may break others

2. **Garmin OAuth (`server/garmin.ts`)**
   - OAuth 1.0a is inherently complex (signatures, token secrets)
   - Token refresh logic is critical - any changes need thorough testing
   - Evaluation/sandbox environment detection for filtering test data

3. **Device Conflict Resolution (`shared/deviceConflictResolver.ts`)**
   - Per-metric source selection logic
   - 0 is treated as valid data (not missing)
   - Primary device precedence rules

4. **Workout Mode System**
   - Three interlinked tables: `workout_logs`, `wearable_activities`, `scheduled_workouts`
   - Bidirectional links between tables
   - Hybrid mode especially complex with prompt flows

5. **AI Cost Optimization (`selectAIModel`)**
   - Model selection based on query complexity
   - Context limiting with message summarization
   - Changes could significantly impact API costs

### Areas Safe to Modify

1. **UI Components** - Most React components in `/client/src/components/` are self-contained

2. **New Pages** - Adding new pages is safe (just register in App.tsx)

3. **Additional Fitness Engine Logic** - Adding new functions to `fitnessEngine.ts` is safe as long as existing functions aren't modified

4. **New Database Tables** - Adding new tables is safe; modifying existing table structures requires migration planning

5. **API Endpoints** - Adding new endpoints in `routes.ts` is safe

### Technical Debt / Known Issues

1. **Some workout data duplication** - Exercises can exist in both `workout_logs.exercises` (jsonb) and `planned_exercises` table

2. **Activity type inconsistency** - Activity types are strings without strict enum validation at the database level

3. **Legacy tables** - `workouts` and `workoutPlans` tables exist but are less used than `scheduled_workouts`

---

*End of Document*
