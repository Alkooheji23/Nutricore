import { ReactNode } from "react";
import { getPermissions, StatePermissions, getUserState, USER_STATES, getTrialDaysRemaining } from "@shared/permissions";

type UserForPermissions = {
  subscriptionType?: string | null;
  createdAt?: Date | string | null;
  subscriptionEndDate?: Date | string | null;
} | null | undefined;

interface RequiresPermissionProps {
  user: UserForPermissions;
  feature: keyof StatePermissions;
  children: ReactNode;
  fallback?: ReactNode;
}

const DefaultFallback = ({ user }: { user: UserForPermissions }) => {
  const state = getUserState(user);
  
  return (
    <div 
      className="text-center p-8 bg-card rounded-lg border border-white/5"
      data-testid="permission-denied"
    >
      {state === USER_STATES.EXPIRED ? (
        <>
          <p className="text-lg text-foreground mb-2">
            Your access has been paused
          </p>
          <p className="text-sm text-muted-foreground">
            Subscribe to continue with full access
          </p>
        </>
      ) : (
        <>
          <p className="text-lg text-foreground mb-2">
            Sign up to unlock this feature
          </p>
          <p className="text-sm text-muted-foreground">
            Get started with a free account
          </p>
        </>
      )}
    </div>
  );
};

export function RequiresPermission({ 
  user, 
  feature, 
  children, 
  fallback 
}: RequiresPermissionProps) {
  const permissions = getPermissions(user);
  const hasAccess = permissions[feature];
  
  const allowed = typeof hasAccess === 'boolean' ? hasAccess : hasAccess > 0;

  if (!allowed) {
    return <>{fallback || <DefaultFallback user={user} />}</>;
  }

  return <>{children}</>;
}

export function usePermissions(user: UserForPermissions) {
  return getPermissions(user);
}

export function useUserState(user: UserForPermissions) {
  return getUserState(user);
}

export function useTrialDaysRemaining(user: UserForPermissions) {
  return getTrialDaysRemaining(user?.createdAt);
}
