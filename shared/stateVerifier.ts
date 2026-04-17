/**
 * NutriCore State Verification Utility
 * 
 * Use this to validate that all 4 user states behave correctly.
 * Run before accepting any changes that affect permissions or UI.
 */

import { getUserState, getPermissions, hasFullAccess, USER_STATES, type UserState } from './permissions';

export interface StateVerificationResult {
  state: UserState;
  passed: boolean;
  checks: {
    name: string;
    expected: boolean | string | number;
    actual: boolean | string | number;
    passed: boolean;
  }[];
}

export interface FullVerificationReport {
  allPassed: boolean;
  results: StateVerificationResult[];
  summary: string;
}

const EXPECTED_BEHAVIORS = {
  [USER_STATES.ANONYMOUS]: {
    hasFullAccess: false,
    canUseChat: true,
    chatLimit: 50,
    hasMemory: false,
    canGeneratePlans: false,
    canAccessTracking: false,
    canAccessDocuments: false,
    canExecuteActions: false,
  },
  [USER_STATES.TRIAL]: {
    hasFullAccess: true,
    canUseChat: true,
    chatLimit: Infinity,
    hasMemory: true,
    canGeneratePlans: true,
    canAccessTracking: true,
    canAccessDocuments: true,
    canExecuteActions: true,
  },
  [USER_STATES.PAID]: {
    hasFullAccess: true,
    canUseChat: true,
    chatLimit: Infinity,
    hasMemory: true,
    canGeneratePlans: true,
    canAccessTracking: true,
    canAccessDocuments: true,
    canExecuteActions: true,
  },
  [USER_STATES.EXPIRED]: {
    hasFullAccess: false,
    canUseChat: true,
    chatLimit: 50,
    hasMemory: false,
    canGeneratePlans: false,
    canAccessTracking: false,
    canAccessDocuments: false,
    canExecuteActions: false,
  },
};

function createMockUser(state: UserState): {
  subscriptionType: string | null;
  createdAt: Date | null;
  subscriptionEndDate: Date | null;
} {
  const now = new Date();
  
  switch (state) {
    case USER_STATES.ANONYMOUS:
      return { subscriptionType: null, createdAt: null, subscriptionEndDate: null };
    
    case USER_STATES.TRIAL:
      // Created 3 days ago (within 7-day trial)
      const trialDate = new Date(now);
      trialDate.setDate(trialDate.getDate() - 3);
      return { subscriptionType: null, createdAt: trialDate, subscriptionEndDate: null };
    
    case USER_STATES.PAID:
      // Paid subscription with future end date
      const futureDate = new Date(now);
      futureDate.setMonth(futureDate.getMonth() + 1);
      return { subscriptionType: 'paid', createdAt: now, subscriptionEndDate: futureDate };
    
    case USER_STATES.EXPIRED:
      // Created 10 days ago (past 7-day trial)
      const expiredDate = new Date(now);
      expiredDate.setDate(expiredDate.getDate() - 10);
      return { subscriptionType: null, createdAt: expiredDate, subscriptionEndDate: null };
    
    default:
      return { subscriptionType: null, createdAt: null, subscriptionEndDate: null };
  }
}

export function verifyState(targetState: UserState): StateVerificationResult {
  const mockUser = createMockUser(targetState);
  const actualState = getUserState(mockUser);
  const permissions = getPermissions(mockUser);
  const fullAccess = hasFullAccess(mockUser);
  
  const expected = EXPECTED_BEHAVIORS[targetState];
  const checks: StateVerificationResult['checks'] = [];
  
  // Verify state detection
  checks.push({
    name: 'State Detection',
    expected: targetState,
    actual: actualState,
    passed: actualState === targetState,
  });
  
  // Verify hasFullAccess
  checks.push({
    name: 'hasFullAccess()',
    expected: expected.hasFullAccess,
    actual: fullAccess,
    passed: fullAccess === expected.hasFullAccess,
  });
  
  // Verify individual permissions
  const permissionKeys = Object.keys(expected).filter(k => k !== 'hasFullAccess') as (keyof typeof permissions)[];
  
  for (const key of permissionKeys) {
    const expectedValue = expected[key as keyof typeof expected];
    const actualValue = permissions[key];
    
    checks.push({
      name: `permissions.${key}`,
      expected: expectedValue,
      actual: actualValue,
      passed: actualValue === expectedValue,
    });
  }
  
  return {
    state: targetState,
    passed: checks.every(c => c.passed),
    checks,
  };
}

export function verifyAllStates(): FullVerificationReport {
  const results: StateVerificationResult[] = [
    verifyState(USER_STATES.ANONYMOUS),
    verifyState(USER_STATES.TRIAL),
    verifyState(USER_STATES.PAID),
    verifyState(USER_STATES.EXPIRED),
  ];
  
  const allPassed = results.every(r => r.passed);
  
  const failedChecks = results
    .filter(r => !r.passed)
    .flatMap(r => r.checks.filter(c => !c.passed).map(c => `${r.state}: ${c.name}`));
  
  const summary = allPassed
    ? 'All state verification checks passed.'
    : `Failed checks: ${failedChecks.join(', ')}`;
  
  return { allPassed, results, summary };
}

export function runVerification(): void {
  console.log('\n=== NutriCore State Verification ===\n');
  
  const report = verifyAllStates();
  
  for (const result of report.results) {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.state.toUpperCase()}`);
    
    for (const check of result.checks) {
      if (!check.passed) {
        console.log(`  ✗ ${check.name}: expected ${check.expected}, got ${check.actual}`);
      }
    }
  }
  
  console.log(`\n${report.summary}\n`);
  
  if (!report.allPassed) {
    console.error('STATE VERIFICATION FAILED - Changes should be rejected.');
    process.exit(1);
  }
}

// UI Behavior Verification (for documentation)
export const UI_BEHAVIOR_RULES = {
  [USER_STATES.ANONYMOUS]: {
    description: 'Not signed in, 50 message limit',
    showUpgradePrompts: true,
    showTrialIndicators: false,
    showPremiumBadges: false,
    accessGatedFeatures: false,
  },
  [USER_STATES.TRIAL]: {
    description: '7-day full access, IDENTICAL to PAID',
    showUpgradePrompts: false,
    showTrialIndicators: false, // CRITICAL: No trial badges, timers, or countdowns
    showPremiumBadges: false,
    accessGatedFeatures: true,
  },
  [USER_STATES.PAID]: {
    description: 'Full premium access',
    showUpgradePrompts: false,
    showTrialIndicators: false,
    showPremiumBadges: false,
    accessGatedFeatures: true,
  },
  [USER_STATES.EXPIRED]: {
    description: 'Past 7 days, limited access',
    showUpgradePrompts: true, // Calm, non-aggressive
    showTrialIndicators: false,
    showPremiumBadges: false,
    accessGatedFeatures: false,
  },
} as const;
