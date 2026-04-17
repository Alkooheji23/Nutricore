// Garmin FIT File Parser for Strength Training Workouts
// Extracts exercise names, sets, reps, and weight from FIT files

import FitParser from 'fit-file-parser';
import { getExerciseFromGarminId, matchExerciseByName, type GarminExerciseInfo } from '@shared/garminExerciseMap';

export interface ParsedExerciseSet {
  exerciseOrder: number;
  exerciseName: string;
  exerciseCategory: string;
  garminExerciseId?: number;
  setNumber: number;
  reps?: number;
  weight?: number;
  weightUnit: string;
  duration?: number;
  restAfter?: number;
  startTime?: Date;
  endTime?: Date;
  avgHeartRate?: number;
  maxHeartRate?: number;
}

export interface ParsedStrengthWorkout {
  success: boolean;
  exercises: ParsedExerciseSet[];
  totalSets: number;
  totalExercises: number;
  error?: string;
}

// FIT file record types for strength training
interface FitSetRecord {
  timestamp?: Date;
  set_type?: number; // 0 = active, 1 = rest
  duration?: number; // milliseconds
  repetitions?: number;
  weight?: number; // grams or scaled value
  weight_display_unit?: number; // 0 = kg, 1 = lb
  start_time?: Date;
  category?: number; // Exercise category ID
  category_subtype?: number; // Exercise subtype
  message_index?: number;
}

interface FitExerciseTitleRecord {
  message_index?: number;
  exercise_category?: number;
  exercise_name?: string;
  wkt_step_name?: string;
}

// Parse FIT file buffer and extract strength training data
export async function parseStrengthWorkout(fitBuffer: Buffer): Promise<ParsedStrengthWorkout> {
  return new Promise((resolve) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        mode: 'both',
      });

      fitParser.parse(fitBuffer, (error: string | undefined, data: any) => {
        if (error) {
          console.error('[FitParser] Parse error:', error);
          resolve({
            success: false,
            exercises: [],
            totalSets: 0,
            totalExercises: 0,
            error: error,
          });
          return;
        }

        try {
          const result = extractStrengthData(data);
          resolve(result);
        } catch (extractError: any) {
          console.error('[FitParser] Extraction error:', extractError.message);
          resolve({
            success: false,
            exercises: [],
            totalSets: 0,
            totalExercises: 0,
            error: extractError.message,
          });
        }
      });
    } catch (error: any) {
      console.error('[FitParser] Unexpected error:', error.message);
      resolve({
        success: false,
        exercises: [],
        totalSets: 0,
        totalExercises: 0,
        error: error.message,
      });
    }
  });
}

// Extract strength training data from parsed FIT data
function extractStrengthData(fitData: any): ParsedStrengthWorkout {
  const exercises: ParsedExerciseSet[] = [];
  
  // FIT files contain 'set' records for strength training
  const setRecords: FitSetRecord[] = fitData.set || fitData.sets || [];
  const exerciseTitles: FitExerciseTitleRecord[] = fitData.exercise_title || fitData.workout_step || [];
  
  console.log(`[FitParser] Found ${setRecords.length} set records, ${exerciseTitles.length} exercise titles`);
  
  if (setRecords.length === 0) {
    // Try alternative data structures
    // Some FIT files store workout data in 'record' with specific fields
    const records = fitData.records || fitData.record || [];
    if (records.length > 0) {
      console.log('[FitParser] Checking records for workout data...');
      // Look for strength-specific fields in records
    }
    
    // Check for workout definition
    const workout = fitData.workout || {};
    const workoutSteps = fitData.workout_step || [];
    
    if (workoutSteps.length > 0) {
      console.log(`[FitParser] Found ${workoutSteps.length} workout steps`);
      return extractFromWorkoutSteps(workoutSteps, fitData);
    }
    
    return {
      success: false,
      exercises: [],
      totalSets: 0,
      totalExercises: 0,
      error: 'No strength training data found in FIT file',
    };
  }
  
  // Build exercise name map from exercise_title records
  const exerciseNameMap: Map<number, string> = new Map();
  for (const title of exerciseTitles) {
    if (title.message_index !== undefined) {
      const name = title.wkt_step_name || title.exercise_name || `Exercise ${title.message_index + 1}`;
      exerciseNameMap.set(title.message_index, name);
    }
  }
  
  // Group sets by exercise
  interface ExerciseGroup {
    categoryId: number;
    sets: FitSetRecord[];
    name?: string;
  }
  
  const exerciseGroups: ExerciseGroup[] = [];
  let currentExercise: ExerciseGroup | null = null;
  
  for (const record of setRecords) {
    // Skip rest sets (set_type === 1)
    if (record.set_type === 1) continue;
    
    const categoryId = record.category ?? record.category_subtype ?? 65535;
    
    // Check if this is a new exercise
    if (!currentExercise || currentExercise.categoryId !== categoryId) {
      if (currentExercise) {
        exerciseGroups.push(currentExercise);
      }
      currentExercise = {
        categoryId,
        sets: [],
        name: exerciseNameMap.get(record.message_index ?? 0),
      };
    }
    
    currentExercise.sets.push(record);
  }
  
  // Don't forget the last exercise
  if (currentExercise && currentExercise.sets.length > 0) {
    exerciseGroups.push(currentExercise);
  }
  
  // Convert to ParsedExerciseSet format
  let exerciseOrder = 0;
  for (const group of exerciseGroups) {
    exerciseOrder++;
    
    // Get exercise info from Garmin ID
    const exerciseInfo = getExerciseFromGarminId(group.categoryId);
    const exerciseName = group.name || exerciseInfo.name;
    
    let setNumber = 0;
    for (const record of group.sets) {
      setNumber++;
      
      // Convert weight from grams to kg
      let weightKg: number | undefined;
      if (record.weight !== undefined && record.weight > 0) {
        // Garmin stores weight in grams or as a scaled value
        // Weight is typically stored in grams (weight / 1000 for kg)
        weightKg = record.weight / 1000;
        
        // If weight_display_unit is 1 (lb), convert to kg
        if (record.weight_display_unit === 1) {
          weightKg = weightKg * 0.453592;
        }
      }
      
      // Convert duration from milliseconds to seconds
      const durationSeconds = record.duration 
        ? Math.round(record.duration / 1000) 
        : undefined;
      
      exercises.push({
        exerciseOrder,
        exerciseName,
        exerciseCategory: exerciseInfo.category,
        garminExerciseId: group.categoryId,
        setNumber,
        reps: record.repetitions,
        weight: weightKg ? Math.round(weightKg * 10) / 10 : undefined,
        weightUnit: 'kg',
        duration: durationSeconds,
        startTime: record.start_time || record.timestamp,
        avgHeartRate: undefined, // Would need to cross-reference with HR records
        maxHeartRate: undefined,
      });
    }
  }
  
  // Calculate unique exercise count
  const uniqueExercises = new Set(exercises.map(e => e.exerciseOrder));
  
  console.log(`[FitParser] Extracted ${exercises.length} sets across ${uniqueExercises.size} exercises`);
  
  return {
    success: exercises.length > 0,
    exercises,
    totalSets: exercises.length,
    totalExercises: uniqueExercises.size,
  };
}

// Extract data from workout_step records (alternative format)
function extractFromWorkoutSteps(workoutSteps: any[], fitData: any): ParsedStrengthWorkout {
  const exercises: ParsedExerciseSet[] = [];
  
  let exerciseOrder = 0;
  for (const step of workoutSteps) {
    if (step.intensity === 'active' || step.intensity === undefined) {
      exerciseOrder++;
      
      const exerciseName = step.wkt_step_name || step.exercise_name || `Exercise ${exerciseOrder}`;
      const categoryId = step.exercise_category ?? step.category ?? 65535;
      const exerciseInfo = getExerciseFromGarminId(categoryId);
      
      // Each step might represent multiple sets
      const targetSets = step.repeat_value || step.target_value || 1;
      const targetReps = step.custom_target_value_low || step.target_reps || undefined;
      
      for (let setNum = 1; setNum <= targetSets; setNum++) {
        exercises.push({
          exerciseOrder,
          exerciseName,
          exerciseCategory: exerciseInfo.category,
          garminExerciseId: categoryId,
          setNumber: setNum,
          reps: targetReps,
          weight: undefined, // Weight not typically in workout definition
          weightUnit: 'kg',
        });
      }
    }
  }
  
  const uniqueExercises = new Set(exercises.map(e => e.exerciseOrder));
  
  return {
    success: exercises.length > 0,
    exercises,
    totalSets: exercises.length,
    totalExercises: uniqueExercises.size,
    error: exercises.length === 0 ? 'No exercises found in workout steps' : undefined,
  };
}

// Check if activity type is a strength workout
export function isStrengthActivity(activityType: string | null | undefined): boolean {
  if (!activityType) return false;
  
  const strengthTypes = [
    'strength_training',
    'strength',
    'weight_training',
    'weights',
    'gym',
    'fitness_equipment',
    'cardio_training',
  ];
  
  const normalizedType = activityType.toLowerCase().replace(/[_-]/g, '_');
  return strengthTypes.some(t => normalizedType.includes(t) || normalizedType === t);
}
