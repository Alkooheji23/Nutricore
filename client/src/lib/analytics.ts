import type { AnalyticsEvent, AnalyticsEventProperties, AnalyticsProvider } from '@shared/analytics';
import { NoOpAnalyticsProvider } from '@shared/analytics';

// PostHog client-side provider
class PostHogClientProvider implements AnalyticsProvider {
  private apiKey: string;
  private apiHost: string;
  private initialized: boolean = false;

  constructor(apiKey: string, apiHost: string = 'https://app.posthog.com') {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    // Dynamically load PostHog if available
    try {
      // Use beacon API for lightweight tracking
      this.initialized = true;
    } catch {
      // Silently ignore
    }
  }

  identify(userId: string, traits?: Record<string, string>): void {
    this.sendEvent('$identify', { distinct_id: userId, $set: traits || {} });
  }

  track(event: AnalyticsEvent, properties?: AnalyticsEventProperties): void {
    const eventProperties = {
      distinct_id: properties?.userId || 'anonymous',
      timestamp: properties?.timestamp || new Date().toISOString(),
      ...properties,
    };
    this.sendEvent(event, eventProperties);
  }

  reset(): void {
    // Clear any stored user identification
  }

  private sendEvent(event: string, properties: Record<string, any>): void {
    const payload = {
      api_key: this.apiKey,
      event,
      properties: {
        ...properties,
        $current_url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // Use sendBeacon for non-blocking, fire-and-forget behavior
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${this.apiHost}/capture/`, blob);
    } else {
      // Fallback to fetch for older browsers
      fetch(`${this.apiHost}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Silently ignore - analytics failures must never break app flows
      });
    }
  }
}

// Client analytics service singleton
class ClientAnalyticsService {
  private provider: AnalyticsProvider;
  private enabled: boolean;
  private userId: string | null = null;
  private subscriptionStatus: 'free' | 'trial' | 'premium' | 'expired' = 'free';

  constructor() {
    // Check if we're in development mode
    const isDevelopment = import.meta.env.DEV;
    const apiKey = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined;

    if (isDevelopment || !apiKey) {
      this.provider = new NoOpAnalyticsProvider();
      this.enabled = false;
    } else {
      const apiHost = (import.meta.env.VITE_POSTHOG_API_HOST as string) || 'https://app.posthog.com';
      this.provider = new PostHogClientProvider(apiKey, apiHost);
      this.enabled = true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setUser(userId: string, subscriptionStatus?: 'free' | 'trial' | 'premium' | 'expired'): void {
    this.userId = userId;
    if (subscriptionStatus) {
      this.subscriptionStatus = subscriptionStatus;
    }
    try {
      this.provider.identify(userId, { subscriptionStatus: this.subscriptionStatus });
    } catch {
      // Silently ignore
    }
  }

  clearUser(): void {
    this.userId = null;
    this.subscriptionStatus = 'free';
    try {
      this.provider.reset();
    } catch {
      // Silently ignore
    }
  }

  track(event: AnalyticsEvent, properties?: Partial<AnalyticsEventProperties>): void {
    try {
      this.provider.track(event, {
        userId: this.userId || undefined,
        subscriptionStatus: this.subscriptionStatus,
        timestamp: new Date().toISOString(),
        ...properties,
      });
    } catch {
      // Silently ignore - analytics failures must never break app flows
    }
  }

  // Convenience methods for page views
  trackPageView(page: 'home' | 'chat' | 'calendar' | 'plan' | 'tracker'): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      home: 'home_viewed',
      chat: 'chat_opened',
      calendar: 'calendar_viewed',
      plan: 'plan_viewed',
      tracker: 'tracker_opened',
    };
    this.track(eventMap[page]);
  }

  // Convenience methods for workout events
  trackWorkout(action: 'logged' | 'completed' | 'skipped'): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      logged: 'workout_logged',
      completed: 'workout_completed',
      skipped: 'workout_skipped',
    };
    this.track(eventMap[action]);
  }
}

export const analytics = new ClientAnalyticsService();
