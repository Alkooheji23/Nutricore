/**
 * BODYWEIGHT NOTIFICATION SERVICE
 * 
 * Detects significant body weight changes and proactively notifies users
 * via trainer chat messages and push notifications.
 */

import { storage } from '../storage';
import { sendPushNotification } from '../pushService';
import type { InsertChatMessage, BodyweightEntry, User } from '@shared/schema';

const SIGNIFICANT_CHANGE_THRESHOLD_KG = 0.5;
const MINIMUM_ENTRIES_FOR_TREND = 3;
const TREND_ANALYSIS_DAYS = 14;

interface WeightTrendAnalysis {
  hasSignificantChange: boolean;
  direction: 'loss' | 'gain' | 'stable';
  changeKg: number;
  changePercent: number;
  periodDays: number;
  ratePerWeek: number;
}

async function analyzeWeightTrend(userId: string): Promise<WeightTrendAnalysis | null> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - TREND_ANALYSIS_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const entries = await storage.getBodyweightEntries(userId, startDate, endDate);
  
  if (entries.length < MINIMUM_ENTRIES_FOR_TREND) {
    return null;
  }
  
  const visibleEntries = entries.filter(e => !e.hidden).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  if (visibleEntries.length < 2) {
    return null;
  }
  
  const oldestEntry = visibleEntries[0];
  const newestEntry = visibleEntries[visibleEntries.length - 1];
  
  const changeKg = newestEntry.weight - oldestEntry.weight;
  const changePercent = (changeKg / oldestEntry.weight) * 100;
  
  const periodDays = Math.max(1, Math.round(
    (new Date(newestEntry.date).getTime() - new Date(oldestEntry.date).getTime()) / (24 * 60 * 60 * 1000)
  ));
  const ratePerWeek = (changeKg / periodDays) * 7;
  
  const hasSignificantChange = Math.abs(changeKg) >= SIGNIFICANT_CHANGE_THRESHOLD_KG;
  const direction: 'loss' | 'gain' | 'stable' = 
    changeKg < -SIGNIFICANT_CHANGE_THRESHOLD_KG / 2 ? 'loss' :
    changeKg > SIGNIFICANT_CHANGE_THRESHOLD_KG / 2 ? 'gain' : 'stable';
  
  return {
    hasSignificantChange,
    direction,
    changeKg: Math.round(changeKg * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    periodDays,
    ratePerWeek: Math.round(ratePerWeek * 10) / 10,
  };
}

function buildTrainerMessage(
  trend: WeightTrendAnalysis,
  user: User
): string | null {
  if (!trend.hasSignificantChange) {
    return null;
  }
  
  const goal = user.fitnessGoal?.toLowerCase() || '';
  const isWeightLossGoal = goal.includes('loss') || goal.includes('lose') || goal.includes('cut');
  const isMuscleGainGoal = goal.includes('muscle') || goal.includes('gain') || goal.includes('bulk');
  
  const absChange = Math.abs(trend.changeKg);
  const absRate = Math.abs(trend.ratePerWeek);
  
  if (trend.direction === 'loss') {
    if (isWeightLossGoal) {
      if (absRate > 1.0) {
        return `I noticed your weight has dropped ${absChange} kg over the past ${trend.periodDays} days. That's a rate of about ${absRate} kg per week — which is on the faster side. Let's make sure we're preserving muscle. I may adjust your calories slightly to keep the loss sustainable.`;
      }
      return `Great progress! Your weight is down ${absChange} kg over the past ${trend.periodDays} days. This is a healthy rate of change for your goal. Keep up the consistency!`;
    } else if (isMuscleGainGoal) {
      return `I noticed your weight dropped ${absChange} kg recently. Since your goal is muscle gain, this might mean we need to increase your calorie intake. I'll make an adjustment to help you stay on track.`;
    } else {
      return `I noticed your weight is down ${absChange} kg over the past ${trend.periodDays} days. Just keeping you informed — let me know if this was intentional or if you'd like to discuss adjustments.`;
    }
  } else if (trend.direction === 'gain') {
    if (isMuscleGainGoal) {
      if (absRate > 0.5) {
        return `Your weight is up ${absChange} kg over the past ${trend.periodDays} days. That's about ${absRate} kg per week — a bit faster than ideal for lean gains. I may dial back calories slightly to minimize fat gain while you build muscle.`;
      }
      return `Nice! Your weight is up ${absChange} kg over the past ${trend.periodDays} days. This is a solid rate for building muscle while keeping fat gain in check. Keep training hard!`;
    } else if (isWeightLossGoal) {
      return `I noticed your weight is up ${absChange} kg recently. Since your goal is weight loss, let's take a look at what might be happening. It could be water retention, or we might need to tighten up the nutrition plan. Let me know how you're feeling.`;
    } else {
      return `I noticed your weight is up ${absChange} kg over the past ${trend.periodDays} days. Just keeping you in the loop — let me know if you'd like to discuss any adjustments.`;
    }
  }
  
  return null;
}

export async function checkAndNotifyWeightTrend(userId: string): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return;
    }
    
    const trend = await analyzeWeightTrend(userId);
    if (!trend || !trend.hasSignificantChange) {
      return;
    }
    
    const message = buildTrainerMessage(trend, user);
    if (!message) {
      return;
    }
    
    const conversations = await storage.getConversations(userId);
    let conversationId = conversations[0]?.id;
    
    if (!conversationId) {
      const newConversation = await storage.createConversation({ userId, title: 'Trainer Chat' });
      conversationId = newConversation.id;
    }
    
    const chatMessage: InsertChatMessage = {
      userId,
      conversationId,
      role: 'assistant',
      content: message,
    };
    
    await storage.createChatMessage(chatMessage);
    
    const trainerName = user.trainerPreference === 'male' ? 'Coach Mike' : 'Coach Sarah';
    const notificationBody = trend.direction === 'loss'
      ? `I noticed a weight change. Tap to see my thoughts.`
      : `Your weight trend has changed. Tap to see my update.`;
    
    await sendPushNotification(userId, {
      title: `${trainerName} noticed something`,
      body: notificationBody,
      notificationType: 'trainer_followup',
      deepLink: '/chat',
    });
    
    console.log(`[BodyweightNotification] Sent weight trend notification to user ${userId}: ${trend.direction} ${trend.changeKg}kg`);
  } catch (error) {
    console.error('[BodyweightNotification] Failed to check/notify weight trend:', error);
  }
}
