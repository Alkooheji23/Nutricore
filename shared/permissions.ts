/**
 * NutriCore User Access States & Lifecycle System
 * 
 * User States:
 * 1. ANONYMOUS - Not signed up, 50 message limit, no memory
 * 2. TRIAL - Signed up, 7-day full access (starts immediately on signup)
 * 3. PAID - Active subscription, unlimited access
 * 4. EXPIRED - Post-7-day without subscription, limited access
 */

export const USER_STATES = {
  ANONYMOUS: "anonymous",
  TRIAL: "trial",
  PAID: "paid",
  EXPIRED: "expired"
} as const;

export type UserState = typeof USER_STATES[keyof typeof USER_STATES];

export interface StatePermissions {
  canUseChat: boolean;
  chatLimit: number;
  hasMemory: boolean;
  canGeneratePlans: boolean;
  canSavePlans: boolean;
  canAccessTracking: boolean;
  canAccessIntegrations: boolean;
  canAccessDocuments: boolean;
  canExecuteActions: boolean;
  hasWeeklyAdaptation: boolean;
}

export const PERMISSIONS: Record<UserState, StatePermissions> = {
  [USER_STATES.ANONYMOUS]: {
    canUseChat: true,
    chatLimit: 50,
    hasMemory: false,
    canGeneratePlans: false,
    canSavePlans: false,
    canAccessTracking: false,
    canAccessIntegrations: false,
    canAccessDocuments: false,
    canExecuteActions: false,
    hasWeeklyAdaptation: false
  },
  [USER_STATES.TRIAL]: {
    canUseChat: true,
    chatLimit: Infinity,
    hasMemory: true,
    canGeneratePlans: true,
    canSavePlans: true,
    canAccessTracking: true,
    canAccessIntegrations: true,
    canAccessDocuments: true,
    canExecuteActions: true,
    hasWeeklyAdaptation: true
  },
  [USER_STATES.PAID]: {
    canUseChat: true,
    chatLimit: Infinity,
    hasMemory: true,
    canGeneratePlans: true,
    canSavePlans: true,
    canAccessTracking: true,
    canAccessIntegrations: true,
    canAccessDocuments: true,
    canExecuteActions: true,
    hasWeeklyAdaptation: true
  },
  [USER_STATES.EXPIRED]: {
    canUseChat: true,
    chatLimit: 50,
    hasMemory: false, // Memory paused, not deleted
    canGeneratePlans: false,
    canSavePlans: false,
    canAccessTracking: false,
    canAccessIntegrations: false,
    canAccessDocuments: false,
    canExecuteActions: false,
    hasWeeklyAdaptation: false
  }
};

// Pricing constants
export const PRICING = {
  MONTHLY: 5,
  YEARLY: 40,
  TRIAL_DAYS: 7
} as const;

/**
 * Determines user state based on subscription data
 * Uses createdAt as the signup date for 7-day trial calculation
 * Admin users always get PAID status (full access)
 */
export function getUserState(user: {
  subscriptionType?: string | null;
  createdAt?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  isAdmin?: boolean | null;
} | null | undefined): UserState {
  // No user = anonymous
  if (!user) {
    return USER_STATES.ANONYMOUS;
  }

  // Admin users always have full access (bypasses all other checks)
  if (user.isAdmin === true) {
    return USER_STATES.PAID;
  }

  // Paid users with active subscription
  if (user.subscriptionType === 'paid' || user.subscriptionType === 'premium') {
    // Check if subscription is still valid
    if (user.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
      if (endDate > new Date()) {
        return USER_STATES.PAID;
      }
    } else {
      // No end date means ongoing subscription
      return USER_STATES.PAID;
    }
  }

  // Signed up users - check if within 7-day trial period
  if (user.createdAt) {
    const signupDate = new Date(user.createdAt);
    const now = new Date();
    const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceSignup < PRICING.TRIAL_DAYS) {
      return USER_STATES.TRIAL;
    } else {
      return USER_STATES.EXPIRED;
    }
  }

  // Fallback for legacy users without createdAt - treat as trial
  return USER_STATES.TRIAL;
}

export function getPermissions(user: {
  subscriptionType?: string | null;
  createdAt?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  isAdmin?: boolean | null;
} | null | undefined): StatePermissions {
  const state = getUserState(user);
  return PERMISSIONS[state];
}

export function hasPermission(
  user: {
    subscriptionType?: string | null;
    createdAt?: Date | string | null;
    subscriptionEndDate?: Date | string | null;
    isAdmin?: boolean | null;
  } | null | undefined,
  feature: keyof StatePermissions
): boolean {
  const permissions = getPermissions(user);
  const value = permissions[feature];
  return typeof value === 'boolean' ? value : value > 0;
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysRemaining(createdAt: Date | string | null | undefined): number {
  if (!createdAt) return 0;
  
  const signup = new Date(createdAt);
  const now = new Date();
  const daysSinceSignup = Math.floor((now.getTime() - signup.getTime()) / (1000 * 60 * 60 * 24));
  
  return Math.max(0, PRICING.TRIAL_DAYS - daysSinceSignup);
}

/**
 * Check if user is in active access period (trial, paid, or admin)
 */
export function hasFullAccess(user: {
  subscriptionType?: string | null;
  createdAt?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
  isAdmin?: boolean | null;
} | null | undefined): boolean {
  const state = getUserState(user);
  return state === USER_STATES.TRIAL || state === USER_STATES.PAID;
}

// Legacy exports for backward compatibility
export const USER_ROLES = USER_STATES;
export type UserRole = UserState;
export type RolePermissions = StatePermissions;

export function getUserRole(userStatus: string | null | undefined): UserState {
  // Legacy mapping for old userStatus field
  if (userStatus === 'active') return USER_STATES.TRIAL;
  if (userStatus === 'waitlist') return USER_STATES.ANONYMOUS;
  return USER_STATES.ANONYMOUS;
}
