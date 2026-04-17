// Garmin Exercise Category IDs to Exercise Names
// Based on Garmin FIT SDK exercise categories and common strength exercises
// Reference: https://developer.garmin.com/fit/cookbook/decoding-activity-files/

export interface GarminExerciseInfo {
  name: string;
  category: string;
  muscleGroups: string[];
}

// Garmin exercise category IDs from FIT SDK
export const GARMIN_EXERCISE_CATEGORIES: Record<number, GarminExerciseInfo> = {
  // Bench Press variants (category 0)
  0: { name: 'Bench Press', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  1: { name: 'Barbell Bench Press', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  2: { name: 'Dumbbell Bench Press', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  3: { name: 'Incline Bench Press', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  4: { name: 'Decline Bench Press', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  5: { name: 'Close Grip Bench Press', category: 'chest', muscleGroups: ['triceps', 'chest'] },
  
  // Calf Raise variants (category 10-19)
  10: { name: 'Calf Raise', category: 'calves', muscleGroups: ['calves'] },
  11: { name: 'Standing Calf Raise', category: 'calves', muscleGroups: ['calves'] },
  12: { name: 'Seated Calf Raise', category: 'calves', muscleGroups: ['calves'] },
  13: { name: 'Single Leg Calf Raise', category: 'calves', muscleGroups: ['calves'] },
  
  // Cardio exercises (category 20-29)
  20: { name: 'Cardio', category: 'cardio', muscleGroups: [] },
  21: { name: 'Running', category: 'cardio', muscleGroups: [] },
  22: { name: 'Cycling', category: 'cardio', muscleGroups: [] },
  23: { name: 'Rowing', category: 'cardio', muscleGroups: ['back', 'arms'] },
  24: { name: 'Jump Rope', category: 'cardio', muscleGroups: ['calves'] },
  25: { name: 'Burpees', category: 'cardio', muscleGroups: ['full_body'] },
  
  // Carry exercises (category 30-39)
  30: { name: 'Carry', category: 'core', muscleGroups: ['core', 'grip'] },
  31: { name: 'Farmers Walk', category: 'core', muscleGroups: ['core', 'grip', 'traps'] },
  32: { name: 'Suitcase Carry', category: 'core', muscleGroups: ['core', 'obliques'] },
  
  // Chop exercises (category 40-49)
  40: { name: 'Chop', category: 'core', muscleGroups: ['core', 'obliques'] },
  41: { name: 'Cable Woodchop', category: 'core', muscleGroups: ['core', 'obliques'] },
  
  // Crunch exercises (category 50-59)
  50: { name: 'Crunch', category: 'abs', muscleGroups: ['abs'] },
  51: { name: 'Basic Crunch', category: 'abs', muscleGroups: ['abs'] },
  52: { name: 'Bicycle Crunch', category: 'abs', muscleGroups: ['abs', 'obliques'] },
  53: { name: 'Reverse Crunch', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  54: { name: 'Cable Crunch', category: 'abs', muscleGroups: ['abs'] },
  
  // Curl exercises (category 60-79)
  60: { name: 'Curl', category: 'biceps', muscleGroups: ['biceps'] },
  61: { name: 'Barbell Curl', category: 'biceps', muscleGroups: ['biceps'] },
  62: { name: 'Dumbbell Curl', category: 'biceps', muscleGroups: ['biceps'] },
  63: { name: 'Hammer Curl', category: 'biceps', muscleGroups: ['biceps', 'forearms'] },
  64: { name: 'Preacher Curl', category: 'biceps', muscleGroups: ['biceps'] },
  65: { name: 'Concentration Curl', category: 'biceps', muscleGroups: ['biceps'] },
  66: { name: 'Cable Curl', category: 'biceps', muscleGroups: ['biceps'] },
  67: { name: 'Incline Dumbbell Curl', category: 'biceps', muscleGroups: ['biceps'] },
  68: { name: 'EZ Bar Curl', category: 'biceps', muscleGroups: ['biceps'] },
  
  // Deadlift exercises (category 80-89)
  80: { name: 'Deadlift', category: 'back', muscleGroups: ['back', 'hamstrings', 'glutes'] },
  81: { name: 'Conventional Deadlift', category: 'back', muscleGroups: ['back', 'hamstrings', 'glutes'] },
  82: { name: 'Sumo Deadlift', category: 'back', muscleGroups: ['back', 'hamstrings', 'glutes', 'adductors'] },
  83: { name: 'Romanian Deadlift', category: 'hamstrings', muscleGroups: ['hamstrings', 'glutes', 'back'] },
  84: { name: 'Stiff Leg Deadlift', category: 'hamstrings', muscleGroups: ['hamstrings', 'glutes'] },
  85: { name: 'Single Leg Deadlift', category: 'hamstrings', muscleGroups: ['hamstrings', 'glutes', 'core'] },
  86: { name: 'Trap Bar Deadlift', category: 'back', muscleGroups: ['back', 'quads', 'glutes'] },
  
  // Flye exercises (category 90-99)
  90: { name: 'Flye', category: 'chest', muscleGroups: ['chest'] },
  91: { name: 'Dumbbell Flye', category: 'chest', muscleGroups: ['chest'] },
  92: { name: 'Cable Flye', category: 'chest', muscleGroups: ['chest'] },
  93: { name: 'Incline Dumbbell Flye', category: 'chest', muscleGroups: ['chest'] },
  94: { name: 'Pec Deck Flye', category: 'chest', muscleGroups: ['chest'] },
  
  // Hip Raise exercises (category 100-109)
  100: { name: 'Hip Raise', category: 'glutes', muscleGroups: ['glutes', 'hamstrings'] },
  101: { name: 'Glute Bridge', category: 'glutes', muscleGroups: ['glutes', 'hamstrings'] },
  102: { name: 'Hip Thrust', category: 'glutes', muscleGroups: ['glutes', 'hamstrings'] },
  103: { name: 'Single Leg Hip Thrust', category: 'glutes', muscleGroups: ['glutes', 'hamstrings'] },
  
  // Hip Stability exercises (category 110-119)
  110: { name: 'Hip Stability', category: 'core', muscleGroups: ['hip_flexors', 'glutes'] },
  111: { name: 'Clamshell', category: 'glutes', muscleGroups: ['glutes'] },
  112: { name: 'Side Lying Hip Abduction', category: 'glutes', muscleGroups: ['glutes'] },
  
  // Hip Swing exercises (category 120-129)
  120: { name: 'Hip Swing', category: 'glutes', muscleGroups: ['glutes', 'hamstrings', 'core'] },
  121: { name: 'Kettlebell Swing', category: 'glutes', muscleGroups: ['glutes', 'hamstrings', 'core'] },
  
  // Hyperextension exercises (category 130-139)
  130: { name: 'Hyperextension', category: 'back', muscleGroups: ['lower_back', 'glutes', 'hamstrings'] },
  131: { name: 'Back Extension', category: 'back', muscleGroups: ['lower_back', 'glutes'] },
  132: { name: 'Reverse Hyperextension', category: 'back', muscleGroups: ['glutes', 'hamstrings', 'lower_back'] },
  
  // Lateral Raise exercises (category 140-149)
  140: { name: 'Lateral Raise', category: 'shoulders', muscleGroups: ['shoulders'] },
  141: { name: 'Dumbbell Lateral Raise', category: 'shoulders', muscleGroups: ['shoulders'] },
  142: { name: 'Cable Lateral Raise', category: 'shoulders', muscleGroups: ['shoulders'] },
  143: { name: 'Front Raise', category: 'shoulders', muscleGroups: ['shoulders'] },
  
  // Leg Curl exercises (category 150-159)
  150: { name: 'Leg Curl', category: 'hamstrings', muscleGroups: ['hamstrings'] },
  151: { name: 'Lying Leg Curl', category: 'hamstrings', muscleGroups: ['hamstrings'] },
  152: { name: 'Seated Leg Curl', category: 'hamstrings', muscleGroups: ['hamstrings'] },
  153: { name: 'Standing Leg Curl', category: 'hamstrings', muscleGroups: ['hamstrings'] },
  
  // Leg Raise exercises (category 160-169)
  160: { name: 'Leg Raise', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  161: { name: 'Lying Leg Raise', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  162: { name: 'Hanging Leg Raise', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  163: { name: 'Captain Chair Leg Raise', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  
  // Lunge exercises (category 170-179)
  170: { name: 'Lunge', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  171: { name: 'Walking Lunge', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  172: { name: 'Reverse Lunge', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  173: { name: 'Side Lunge', category: 'quads', muscleGroups: ['quads', 'glutes', 'adductors'] },
  174: { name: 'Bulgarian Split Squat', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  
  // Olympic Lift exercises (category 180-189)
  180: { name: 'Olympic Lift', category: 'full_body', muscleGroups: ['full_body'] },
  181: { name: 'Clean', category: 'full_body', muscleGroups: ['full_body'] },
  182: { name: 'Snatch', category: 'full_body', muscleGroups: ['full_body'] },
  183: { name: 'Clean and Jerk', category: 'full_body', muscleGroups: ['full_body'] },
  184: { name: 'Power Clean', category: 'full_body', muscleGroups: ['full_body'] },
  185: { name: 'Hang Clean', category: 'full_body', muscleGroups: ['full_body'] },
  
  // Plank exercises (category 190-199)
  190: { name: 'Plank', category: 'core', muscleGroups: ['core', 'abs'] },
  191: { name: 'Front Plank', category: 'core', muscleGroups: ['core', 'abs'] },
  192: { name: 'Side Plank', category: 'core', muscleGroups: ['core', 'obliques'] },
  193: { name: 'Plank with Leg Lift', category: 'core', muscleGroups: ['core', 'glutes'] },
  
  // Pull-up exercises (category 200-209)
  200: { name: 'Pull Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  201: { name: 'Wide Grip Pull Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  202: { name: 'Chin Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  203: { name: 'Close Grip Pull Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  204: { name: 'Assisted Pull Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  205: { name: 'Neutral Grip Pull Up', category: 'back', muscleGroups: ['back', 'biceps'] },
  
  // Push-up exercises (category 210-219)
  210: { name: 'Push Up', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  211: { name: 'Standard Push Up', category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
  212: { name: 'Wide Push Up', category: 'chest', muscleGroups: ['chest', 'triceps'] },
  213: { name: 'Diamond Push Up', category: 'chest', muscleGroups: ['triceps', 'chest'] },
  214: { name: 'Incline Push Up', category: 'chest', muscleGroups: ['chest', 'triceps'] },
  215: { name: 'Decline Push Up', category: 'chest', muscleGroups: ['chest', 'shoulders'] },
  
  // Row exercises (category 220-239)
  220: { name: 'Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  221: { name: 'Barbell Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  222: { name: 'Dumbbell Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  223: { name: 'Cable Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  224: { name: 'Seated Cable Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  225: { name: 'T-Bar Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  226: { name: 'Pendlay Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  227: { name: 'Single Arm Dumbbell Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  228: { name: 'Machine Row', category: 'back', muscleGroups: ['back', 'biceps'] },
  
  // Shoulder Press exercises (category 240-249)
  240: { name: 'Shoulder Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  241: { name: 'Overhead Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  242: { name: 'Dumbbell Shoulder Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  243: { name: 'Arnold Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  244: { name: 'Push Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps', 'legs'] },
  245: { name: 'Military Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  246: { name: 'Machine Shoulder Press', category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
  
  // Shoulder Stability exercises (category 250-259)
  250: { name: 'Shoulder Stability', category: 'shoulders', muscleGroups: ['rotator_cuff'] },
  251: { name: 'External Rotation', category: 'shoulders', muscleGroups: ['rotator_cuff'] },
  252: { name: 'Internal Rotation', category: 'shoulders', muscleGroups: ['rotator_cuff'] },
  253: { name: 'Face Pull', category: 'shoulders', muscleGroups: ['rear_delts', 'rotator_cuff'] },
  
  // Shrug exercises (category 260-269)
  260: { name: 'Shrug', category: 'traps', muscleGroups: ['traps'] },
  261: { name: 'Barbell Shrug', category: 'traps', muscleGroups: ['traps'] },
  262: { name: 'Dumbbell Shrug', category: 'traps', muscleGroups: ['traps'] },
  
  // Sit-up exercises (category 270-279)
  270: { name: 'Sit Up', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  271: { name: 'Standard Sit Up', category: 'abs', muscleGroups: ['abs', 'hip_flexors'] },
  272: { name: 'Decline Sit Up', category: 'abs', muscleGroups: ['abs'] },
  
  // Squat exercises (category 280-299)
  280: { name: 'Squat', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  281: { name: 'Barbell Back Squat', category: 'quads', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
  282: { name: 'Front Squat', category: 'quads', muscleGroups: ['quads', 'core'] },
  283: { name: 'Goblet Squat', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  284: { name: 'Sumo Squat', category: 'quads', muscleGroups: ['quads', 'glutes', 'adductors'] },
  285: { name: 'Box Squat', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  286: { name: 'Hack Squat', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  287: { name: 'Leg Press', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  288: { name: 'Smith Machine Squat', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  289: { name: 'Overhead Squat', category: 'quads', muscleGroups: ['quads', 'core', 'shoulders'] },
  
  // Step-up exercises (category 300-309)
  300: { name: 'Step Up', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  301: { name: 'Dumbbell Step Up', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  302: { name: 'Barbell Step Up', category: 'quads', muscleGroups: ['quads', 'glutes'] },
  
  // Tricep Extension exercises (category 310-329)
  310: { name: 'Tricep Extension', category: 'triceps', muscleGroups: ['triceps'] },
  311: { name: 'Tricep Pushdown', category: 'triceps', muscleGroups: ['triceps'] },
  312: { name: 'Overhead Tricep Extension', category: 'triceps', muscleGroups: ['triceps'] },
  313: { name: 'Skull Crusher', category: 'triceps', muscleGroups: ['triceps'] },
  314: { name: 'Tricep Kickback', category: 'triceps', muscleGroups: ['triceps'] },
  315: { name: 'Dip', category: 'triceps', muscleGroups: ['triceps', 'chest', 'shoulders'] },
  316: { name: 'Close Grip Push Up', category: 'triceps', muscleGroups: ['triceps', 'chest'] },
  317: { name: 'Cable Tricep Extension', category: 'triceps', muscleGroups: ['triceps'] },
  
  // Lat Pulldown exercises (category 330-339)
  330: { name: 'Lat Pulldown', category: 'back', muscleGroups: ['back', 'biceps'] },
  331: { name: 'Wide Grip Lat Pulldown', category: 'back', muscleGroups: ['back', 'biceps'] },
  332: { name: 'Close Grip Lat Pulldown', category: 'back', muscleGroups: ['back', 'biceps'] },
  333: { name: 'Reverse Grip Lat Pulldown', category: 'back', muscleGroups: ['back', 'biceps'] },
  334: { name: 'Straight Arm Pulldown', category: 'back', muscleGroups: ['back'] },
  
  // Leg Extension exercises (category 340-349)
  340: { name: 'Leg Extension', category: 'quads', muscleGroups: ['quads'] },
  341: { name: 'Machine Leg Extension', category: 'quads', muscleGroups: ['quads'] },
  
  // Hip Adduction/Abduction (category 350-359)
  350: { name: 'Hip Adduction', category: 'adductors', muscleGroups: ['adductors'] },
  351: { name: 'Machine Hip Adduction', category: 'adductors', muscleGroups: ['adductors'] },
  352: { name: 'Hip Abduction', category: 'glutes', muscleGroups: ['glutes'] },
  353: { name: 'Machine Hip Abduction', category: 'glutes', muscleGroups: ['glutes'] },
  
  // Core Stability (category 360-369)
  360: { name: 'Core Stability', category: 'core', muscleGroups: ['core'] },
  361: { name: 'Dead Bug', category: 'core', muscleGroups: ['core', 'abs'] },
  362: { name: 'Bird Dog', category: 'core', muscleGroups: ['core', 'back'] },
  363: { name: 'Pallof Press', category: 'core', muscleGroups: ['core', 'obliques'] },
  
  // Chest Press Machine (category 370-379)
  370: { name: 'Chest Press', category: 'chest', muscleGroups: ['chest', 'triceps'] },
  371: { name: 'Machine Chest Press', category: 'chest', muscleGroups: ['chest', 'triceps'] },
  372: { name: 'Incline Machine Press', category: 'chest', muscleGroups: ['chest', 'triceps'] },
  
  // Unknown/Custom exercises (category 65534-65535)
  65534: { name: 'Custom Exercise', category: 'other', muscleGroups: [] },
  65535: { name: 'Unknown Exercise', category: 'other', muscleGroups: [] },
};

// Get exercise info from Garmin category ID
export function getExerciseFromGarminId(categoryId: number): GarminExerciseInfo {
  return GARMIN_EXERCISE_CATEGORIES[categoryId] || {
    name: `Exercise ${categoryId}`,
    category: 'other',
    muscleGroups: [],
  };
}

// Try to match exercise name from Garmin activity name
export function matchExerciseByName(activityName: string): GarminExerciseInfo | null {
  const normalizedName = activityName.toLowerCase().trim();
  
  for (const [, info] of Object.entries(GARMIN_EXERCISE_CATEGORIES)) {
    if (info.name.toLowerCase() === normalizedName) {
      return info;
    }
  }
  
  // Partial matching for common terms
  const partialMatches: Record<string, GarminExerciseInfo> = {
    'bench': GARMIN_EXERCISE_CATEGORIES[0],
    'squat': GARMIN_EXERCISE_CATEGORIES[280],
    'deadlift': GARMIN_EXERCISE_CATEGORIES[80],
    'curl': GARMIN_EXERCISE_CATEGORIES[60],
    'press': GARMIN_EXERCISE_CATEGORIES[240],
    'row': GARMIN_EXERCISE_CATEGORIES[220],
    'pulldown': GARMIN_EXERCISE_CATEGORIES[330],
    'lat pull': GARMIN_EXERCISE_CATEGORIES[330],
    'pull up': GARMIN_EXERCISE_CATEGORIES[200],
    'pullup': GARMIN_EXERCISE_CATEGORIES[200],
    'chin up': GARMIN_EXERCISE_CATEGORIES[202],
    'lunge': GARMIN_EXERCISE_CATEGORIES[170],
    'plank': GARMIN_EXERCISE_CATEGORIES[190],
    'push up': GARMIN_EXERCISE_CATEGORIES[210],
    'pushup': GARMIN_EXERCISE_CATEGORIES[210],
  };
  
  for (const [keyword, info] of Object.entries(partialMatches)) {
    if (normalizedName.includes(keyword)) {
      return info;
    }
  }
  
  return null;
}
