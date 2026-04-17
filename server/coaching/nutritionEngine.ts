/**
 * NUTRITION ENGINE
 * 
 * Calculates macros and nutrition targets.
 * This engine is governed by the Unified Decision Layer.
 * All outputs must align with the current system verdict.
 */

export interface UserNutritionInput {
  weight: number;
  height: number;
  age: number;
  gender: 'male' | 'female';
  activityLevel: string;
  goal: string;
}

export interface MacroBreakdown {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlan {
  meals: Meal[];
  totalMacros: MacroBreakdown;
}

export interface Meal {
  name: string;
  timing: string;
  macros: MacroBreakdown;
  percentageOfDaily: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<string, { calories: number; protein: number }> = {
  fat_loss: { calories: -500, protein: 2.2 },
  muscle_gain: { calories: 300, protein: 2.0 },
  maintenance: { calories: 0, protein: 1.8 },
  recomposition: { calories: 0, protein: 2.2 },
  strength: { calories: 200, protein: 2.0 },
};

function calculateBMR(weight: number, height: number, age: number, gender: 'male' | 'female'): number {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
  return Math.round(bmr * multiplier);
}

/**
 * Calculate base macros for a user
 */
export function calculateMacros(input: UserNutritionInput): MacroBreakdown {
  const bmr = calculateBMR(input.weight, input.height, input.age, input.gender);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  
  const goalConfig = GOAL_ADJUSTMENTS[input.goal] || GOAL_ADJUSTMENTS.maintenance;
  const targetCalories = tdee + goalConfig.calories;
  
  const protein = Math.round(input.weight * goalConfig.protein);
  const proteinCalories = protein * 4;
  
  const fatCalories = targetCalories * 0.25;
  const fat = Math.round(fatCalories / 9);
  
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbs = Math.round(remainingCalories / 4);
  
  return {
    calories: Math.round(targetCalories),
    protein,
    carbs: Math.max(carbs, 50),
    fat: Math.max(fat, 40),
  };
}

/**
 * Adjust macros for training vs rest day
 */
export function adjustMacrosForDay(
  baseMacros: MacroBreakdown,
  isTrainingDay: boolean,
  intensity: 'light' | 'moderate' | 'intense' = 'moderate'
): MacroBreakdown {
  if (!isTrainingDay) {
    return {
      calories: Math.round(baseMacros.calories * 0.9),
      protein: baseMacros.protein,
      carbs: Math.round(baseMacros.carbs * 0.75),
      fat: Math.round(baseMacros.fat * 1.1),
    };
  }
  
  const intensityMultipliers = {
    light: 1.0,
    moderate: 1.05,
    intense: 1.15,
  };
  
  const multiplier = intensityMultipliers[intensity];
  
  return {
    calories: Math.round(baseMacros.calories * multiplier),
    protein: baseMacros.protein,
    carbs: Math.round(baseMacros.carbs * (multiplier + 0.1)),
    fat: baseMacros.fat,
  };
}

/**
 * Apply unified decision layer directives to nutrition
 */
export function applyNutritionDirective(
  baseMacros: MacroBreakdown,
  directive: {
    calorieAdjustment: 'surplus' | 'maintenance' | 'deficit' | 'recovery_surplus';
    proteinEmphasis: 'standard' | 'high' | 'maximum';
  }
): MacroBreakdown {
  let calorieMultiplier = 1.0;
  switch (directive.calorieAdjustment) {
    case 'surplus': calorieMultiplier = 1.1; break;
    case 'recovery_surplus': calorieMultiplier = 1.15; break;
    case 'deficit': calorieMultiplier = 0.85; break;
    case 'maintenance': calorieMultiplier = 1.0; break;
  }
  
  let proteinMultiplier = 1.0;
  switch (directive.proteinEmphasis) {
    case 'high': proteinMultiplier = 1.1; break;
    case 'maximum': proteinMultiplier = 1.2; break;
    case 'standard': proteinMultiplier = 1.0; break;
  }
  
  const adjustedCalories = Math.round(baseMacros.calories * calorieMultiplier);
  const adjustedProtein = Math.round(baseMacros.protein * proteinMultiplier);
  const proteinCalories = adjustedProtein * 4;
  
  const fatCalories = adjustedCalories * 0.25;
  const fat = Math.round(fatCalories / 9);
  
  const remainingCalories = adjustedCalories - proteinCalories - fatCalories;
  const carbs = Math.round(remainingCalories / 4);
  
  return {
    calories: adjustedCalories,
    protein: adjustedProtein,
    carbs: Math.max(carbs, 50),
    fat: Math.max(fat, 40),
  };
}

/**
 * Generate meal distribution plan
 */
export function generateMealPlan(dailyMacros: MacroBreakdown, numberOfMeals: number): MealPlan {
  const mealDistributions: Record<number, { name: string; timing: string; percentage: number }[]> = {
    3: [
      { name: 'Breakfast', timing: '7:00 AM', percentage: 0.30 },
      { name: 'Lunch', timing: '12:30 PM', percentage: 0.35 },
      { name: 'Dinner', timing: '7:00 PM', percentage: 0.35 },
    ],
    4: [
      { name: 'Breakfast', timing: '7:00 AM', percentage: 0.25 },
      { name: 'Lunch', timing: '12:00 PM', percentage: 0.30 },
      { name: 'Snack', timing: '3:30 PM', percentage: 0.15 },
      { name: 'Dinner', timing: '7:00 PM', percentage: 0.30 },
    ],
    5: [
      { name: 'Breakfast', timing: '7:00 AM', percentage: 0.20 },
      { name: 'Mid-Morning', timing: '10:00 AM', percentage: 0.15 },
      { name: 'Lunch', timing: '12:30 PM', percentage: 0.25 },
      { name: 'Afternoon', timing: '3:30 PM', percentage: 0.15 },
      { name: 'Dinner', timing: '7:00 PM', percentage: 0.25 },
    ],
    6: [
      { name: 'Breakfast', timing: '7:00 AM', percentage: 0.18 },
      { name: 'Mid-Morning', timing: '9:30 AM', percentage: 0.12 },
      { name: 'Lunch', timing: '12:00 PM', percentage: 0.20 },
      { name: 'Afternoon', timing: '3:00 PM', percentage: 0.15 },
      { name: 'Dinner', timing: '6:30 PM', percentage: 0.20 },
      { name: 'Evening', timing: '9:00 PM', percentage: 0.15 },
    ],
  };
  
  const distribution = mealDistributions[numberOfMeals] || mealDistributions[4];
  
  const meals: Meal[] = distribution.map(d => ({
    name: d.name,
    timing: d.timing,
    percentageOfDaily: d.percentage,
    macros: {
      calories: Math.round(dailyMacros.calories * d.percentage),
      protein: Math.round(dailyMacros.protein * d.percentage),
      carbs: Math.round(dailyMacros.carbs * d.percentage),
      fat: Math.round(dailyMacros.fat * d.percentage),
    },
  }));
  
  return {
    meals,
    totalMacros: dailyMacros,
  };
}

/**
 * Format macros for display
 */
export function formatMacros(macros: MacroBreakdown): string {
  return `${macros.calories} kcal | P: ${macros.protein}g | C: ${macros.carbs}g | F: ${macros.fat}g`;
}
