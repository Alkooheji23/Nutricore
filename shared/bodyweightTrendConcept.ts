/**
 * Bodyweight Trend Feature - Concept & Positioning
 * 
 * This file defines the foundational concept, naming conventions, and rules
 * for the Bodyweight Trend feature. All future implementation should align
 * with these definitions.
 * 
 * IMPORTANT: This is a source of truth. Do not modify without explicit instruction.
 */

export const BODYWEIGHT_TREND_CONCEPT = {
  // Official feature name - never use "Weight Loss", "Weight Chart", etc.
  featureName: 'Bodyweight Trend',
  
  // Core positioning
  positioning: {
    type: 'health_insight', // NOT a performance score or goal tracker
    purpose: 'Visualize long-term direction rather than daily fluctuations',
    tone: 'calm, clarity, long-term perspective',
  },
  
  // Approved terminology for UI copy
  approvedTerminology: [
    'Current trend',
    'Recent direction', 
    'Based on recent entries',
    'Overall direction',
    'Long-term trend',
  ],
  
  // Terminology to AVOID
  forbiddenTerminology: [
    'Weight loss',
    'Weight gain',
    'Goal weight',
    'Target weight',
    'Good progress',
    'Bad progress',
    'You\'re doing great',
    'Keep it up',
    'Streak',
    'Achievement',
  ],
  
  // Required micro-explanation to display near the chart
  microExplanation: 'This view highlights overall direction rather than daily fluctuations.',
  
  // What the feature does NOT do
  scopeBoundaries: {
    doesNotPredictFuture: true,
    doesNotSetTargetsByDefault: true,
    doesNotReplaceMedicalAdvice: true,
    onlyVisualizesLoggedOrSyncedData: true,
  },
  
  // Rules for UI implementation
  uiRules: {
    noGamification: true,
    noStreaks: true,
    noCelebratoryLanguage: true,
    noMoralFraming: true, // no "good/bad" weight changes
    neutralLanguageOnly: true,
  },
  
  // Success criteria for user understanding
  successCriteria: [
    'Users understand that one data point does not change the narrative',
    'The chart communicates calm, clarity, and long-term perspective',
    'Short-term fluctuations (water, glycogen, digestion) are contextualized as normal',
  ],
  
  // Data sources (for future implementation reference)
  dataSources: ['user_logged', 'device_synced'],
} as const;

export type BodyweightTrendConcept = typeof BODYWEIGHT_TREND_CONCEPT;
