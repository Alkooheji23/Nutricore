// Analytics Event Types - Core events only
export type AnalyticsEvent =
  // Auth & Lifecycle
  | 'user_signed_up'
  | 'user_logged_in'
  | 'user_logged_out'
  // Core Engagement
  | 'home_viewed'
  | 'chat_opened'
  | 'calendar_viewed'
  | 'plan_viewed'
  | 'tracker_opened'
  // Workout Activity
  | 'workout_logged'
  | 'workout_completed'
  | 'workout_skipped'
  // Device & Data
  | 'device_connected'
  | 'device_sync_success'
  | 'device_sync_failed'
  // Monetization
  | 'subscription_started'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expired';

// Event Properties - Keep light, no PII beyond userId
export interface AnalyticsEventProperties {
  userId?: string;
  timestamp?: string;
  subscriptionStatus?: 'free' | 'trial' | 'premium' | 'expired';
  deviceType?: 'fitbit' | 'garmin';
}

// Analytics Provider Interface - allows swapping providers
export interface AnalyticsProvider {
  identify(userId: string, traits?: Record<string, string>): void;
  track(event: AnalyticsEvent, properties?: AnalyticsEventProperties): void;
  reset(): void;
}

// No-op provider for development or when analytics is disabled
export class NoOpAnalyticsProvider implements AnalyticsProvider {
  identify(_userId: string, _traits?: Record<string, string>): void {}
  track(_event: AnalyticsEvent, _properties?: AnalyticsEventProperties): void {}
  reset(): void {}
}
