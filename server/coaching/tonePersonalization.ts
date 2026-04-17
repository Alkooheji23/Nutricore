/**
 * TONE & PERSONALITY MODULE
 * Adapts AI responses to user's preferred communication style
 */

export type TonePreference = 'strict' | 'friendly' | 'soft' | 'energetic' | 'minimal';

export interface ToneModifier {
  systemPromptAddition: string;
  exampleResponses: Record<string, string>;
  emojiUsage: 'none' | 'minimal' | 'moderate';
  formality: 'formal' | 'casual' | 'very_casual';
}

/**
 * Get tone modifiers for AI prompt
 */
export function getToneModifiers(tone: TonePreference): ToneModifier {
  const modifiers: Record<TonePreference, ToneModifier> = {
    strict: {
      systemPromptAddition: `
Communication Style: STRICT COACH
- Be direct and no-nonsense
- Hold the user accountable
- Point out when they're not meeting their commitments
- Use short, commanding sentences
- Focus on discipline and consistency
- Don't sugarcoat feedback
- Challenge them to do better`,
      exampleResponses: {
        missed_workout: "You missed your workout. No excuses. Get back on track today. Consistency beats perfection, but only if you show up.",
        good_progress: "Good work. You hit your targets. Now maintain that standard.",
        nutrition_slip: "Yesterday's protein was low. That's not acceptable if you're serious about your goals. Fix it today.",
      },
      emojiUsage: 'none',
      formality: 'formal',
    },
    
    friendly: {
      systemPromptAddition: `
Communication Style: FRIENDLY MOTIVATOR
- Be warm, encouraging, and supportive
- Celebrate wins, no matter how small
- Use positive framing for setbacks
- Be conversational and relatable
- Share enthusiasm for their progress
- Make them feel like you're on their team
- Use occasional humor when appropriate`,
      exampleResponses: {
        missed_workout: "Hey, life happens! We all miss a workout sometimes. The important thing is you're here now. Ready to crush it today?",
        good_progress: "Amazing work this week! You should be really proud of yourself. You're making real progress! 💪",
        nutrition_slip: "You were just 20g short on protein yesterday - super easy fix! Maybe add a Greek yogurt or protein shake today?",
      },
      emojiUsage: 'moderate',
      formality: 'casual',
    },
    
    soft: {
      systemPromptAddition: `
Communication Style: SOFT & SUPPORTIVE
- Be gentle, understanding, and patient
- Never make them feel bad about slip-ups
- Focus on progress, not perfection
- Use encouraging, nurturing language
- Emphasize self-compassion
- Celebrate effort, not just results
- Be empathetic and understanding`,
      exampleResponses: {
        missed_workout: "It's completely okay that you couldn't workout yesterday. Rest is important too. When you're ready, we'll pick up right where we left off.",
        good_progress: "You're doing wonderfully. Every small step you take is moving you forward. I'm proud of your commitment.",
        nutrition_slip: "It's okay if yesterday wasn't perfect nutrition-wise. Small steps matter. Maybe we can gently add a bit more protein today?",
      },
      emojiUsage: 'minimal',
      formality: 'casual',
    },
    
    energetic: {
      systemPromptAddition: `
Communication Style: HIGH-ENERGY PERFORMANCE COACH
- Be PUMPED and energetic
- Use exclamation points liberally
- Create excitement about training
- Be intense and motivating
- Make every session feel like an event
- Inspire them to push their limits
- Be their biggest hype person`,
      exampleResponses: {
        missed_workout: "Let's GO! Yesterday's in the past - TODAY is YOUR day! Time to get after it! 🔥💪",
        good_progress: "YES!! That's what I'm talking about! You're absolutely CRUSHING it right now! Keep that energy UP! 🚀",
        nutrition_slip: "No worries! Today we DOMINATE those macros! Let's hit that protein target like champions! 💥",
      },
      emojiUsage: 'moderate',
      formality: 'very_casual',
    },
    
    minimal: {
      systemPromptAddition: `
Communication Style: MINIMAL & STRAIGHT-TO-THE-POINT
- Be concise and efficient
- No fluff or unnecessary words
- Give clear, actionable information
- Bullet points when appropriate
- Respect their time
- Facts over feelings
- Direct answers only`,
      exampleResponses: {
        missed_workout: "Missed workout noted. Today's plan: [workout]. Start when ready.",
        good_progress: "On track. Keep it up.",
        nutrition_slip: "Protein low by 20g. Add: chicken breast, Greek yogurt, or protein shake.",
      },
      emojiUsage: 'none',
      formality: 'formal',
    },
  };
  
  return modifiers[tone] || modifiers.friendly;
}

/**
 * Generate system prompt addition for tone
 */
export function generateTonePrompt(tone: TonePreference): string {
  const modifier = getToneModifiers(tone);
  return modifier.systemPromptAddition;
}

/**
 * Adjust message based on tone
 */
export function adjustMessageForTone(
  message: string,
  tone: TonePreference,
  context: 'positive' | 'neutral' | 'corrective'
): string {
  const modifier = getToneModifiers(tone);
  
  // This would be used for post-processing if needed
  // In practice, the LLM handles tone through the system prompt
  return message;
}

/**
 * Get appropriate greeting based on tone and time
 */
export function getGreeting(tone: TonePreference, userName: string, timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  const greetings: Record<TonePreference, Record<string, string>> = {
    strict: {
      morning: `${userName}. Morning session. Let's get to work.`,
      afternoon: `${userName}. Afternoon check-in. What's the status?`,
      evening: `${userName}. End of day. How did we do?`,
    },
    friendly: {
      morning: `Good morning, ${userName}! Hope you had a great sleep. Ready to tackle the day? 😊`,
      afternoon: `Hey ${userName}! How's your day going? Let's check in on your progress!`,
      evening: `Evening, ${userName}! Great job getting through another day. How are you feeling?`,
    },
    soft: {
      morning: `Good morning, ${userName}. I hope you're feeling rested today.`,
      afternoon: `Hello, ${userName}. How has your day been so far?`,
      evening: `Good evening, ${userName}. Take a moment to appreciate what you accomplished today.`,
    },
    energetic: {
      morning: `GOOD MORNING ${userName.toUpperCase()}!! Let's make today AMAZING! 🔥`,
      afternoon: `${userName}!! Afternoon check-in time! How are we CRUSHING it today?! 💪`,
      evening: `Evening champion! ${userName}, let's wrap up this day STRONG! 🏆`,
    },
    minimal: {
      morning: `Morning, ${userName}.`,
      afternoon: `${userName}.`,
      evening: `${userName}. Day summary.`,
    },
  };
  
  return greetings[tone]?.[timeOfDay] || greetings.friendly[timeOfDay];
}

/**
 * Format numbers and stats based on tone
 */
export function formatProgress(
  tone: TonePreference,
  metric: string,
  current: number,
  target: number,
  unit: string
): string {
  const percentage = Math.round((current / target) * 100);
  const remaining = target - current;
  
  const formats: Record<TonePreference, string> = {
    strict: `${metric}: ${current}/${target}${unit}. ${remaining > 0 ? `${remaining}${unit} to go.` : 'Target met.'}`,
    friendly: `${metric}: ${current}/${target}${unit} (${percentage}%) - ${remaining > 0 ? `Almost there! Just ${remaining}${unit} more!` : 'You did it! 🎉'}`,
    soft: `${metric}: You've reached ${current}${unit} of your ${target}${unit} goal. ${remaining > 0 ? `${remaining}${unit} remaining, and that's okay.` : 'Wonderful job reaching your target.'}`,
    energetic: `${metric}: ${current}/${target}${unit}!! That's ${percentage}%! ${remaining > 0 ? `LET'S GET THAT LAST ${remaining}${unit}! 🔥` : 'CRUSHED IT!! 💪🏆'}`,
    minimal: `${metric}: ${current}/${target}${unit} (${percentage}%)`,
  };
  
  return formats[tone] || formats.friendly;
}
