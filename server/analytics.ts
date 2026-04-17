import type { AnalyticsEvent, AnalyticsEventProperties, AnalyticsProvider } from '@shared/analytics';
import { NoOpAnalyticsProvider } from '@shared/analytics';

// PostHog provider for server-side tracking
class PostHogProvider implements AnalyticsProvider {
  private apiKey: string;
  private apiHost: string;

  constructor(apiKey: string, apiHost: string = 'https://app.posthog.com') {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
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
    // No-op for server-side
  }

  private sendEvent(event: string, properties: Record<string, any>): void {
    // Fire-and-forget, non-blocking
    const payload = {
      api_key: this.apiKey,
      event,
      properties,
      timestamp: new Date().toISOString(),
    };

    fetch(`${this.apiHost}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore - analytics failures must never break app flows
    });
  }
}

// Analytics service singleton
class AnalyticsService {
  private provider: AnalyticsProvider;
  private enabled: boolean;

  constructor() {
    // Disable analytics in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const apiKey = process.env.POSTHOG_API_KEY;

    if (isDevelopment || !apiKey) {
      this.provider = new NoOpAnalyticsProvider();
      this.enabled = false;
      if (!isDevelopment && !apiKey) {
        console.log('[Analytics] Disabled - no POSTHOG_API_KEY configured');
      } else if (isDevelopment) {
        console.log('[Analytics] Disabled in development mode');
      }
    } else {
      const apiHost = process.env.POSTHOG_API_HOST || 'https://app.posthog.com';
      this.provider = new PostHogProvider(apiKey, apiHost);
      this.enabled = true;
      console.log('[Analytics] PostHog enabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  identify(userId: string, traits?: Record<string, string>): void {
    try {
      this.provider.identify(userId, traits);
    } catch {
      // Silently ignore
    }
  }

  track(event: AnalyticsEvent, properties?: AnalyticsEventProperties): void {
    try {
      this.provider.track(event, {
        ...properties,
        timestamp: properties?.timestamp || new Date().toISOString(),
      });
    } catch {
      // Silently ignore
    }
  }

  reset(): void {
    try {
      this.provider.reset();
    } catch {
      // Silently ignore
    }
  }
}

export const analytics = new AnalyticsService();

// Helper function for common tracking patterns
export function trackUserEvent(
  event: AnalyticsEvent,
  userId: string,
  subscriptionStatus?: 'free' | 'trial' | 'premium' | 'expired',
  deviceType?: 'fitbit' | 'garmin'
): void {
  analytics.track(event, {
    userId,
    subscriptionStatus,
    deviceType,
  });
}
