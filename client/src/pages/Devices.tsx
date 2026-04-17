import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Watch, RefreshCw, Unlink, Activity, Flame, Download, ArrowLeft, Settings, Dumbbell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSearch, Link } from "wouter";
import { WorkoutModeSelector, type WorkoutMode } from "@/components/WorkoutModeSelector";
import { getQueryFn } from "@/lib/queryClient";

const FitbitLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="12" cy="4" r="2" />
    <circle cx="12" cy="10" r="2" />
    <circle cx="12" cy="16" r="2" />
    <circle cx="6" cy="7" r="2" />
    <circle cx="6" cy="13" r="2" />
    <circle cx="18" cy="7" r="2" />
    <circle cx="18" cy="13" r="2" />
    <circle cx="12" cy="22" r="1.5" />
  </svg>
);

const GarminLogo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    <path d="M12 4.5c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5-3.36-7.5-7.5-7.5zm0 13.5c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    <polygon points="12,7 13.5,10 17,10 14.5,12 15.5,16 12,14 8.5,16 9.5,12 7,10 10.5,10"/>
  </svg>
);

interface FitbitStatus {
  connected: boolean;
  fitbitUserId?: string;
  lastSyncAt?: string;
  connectedAt?: string;
}

interface GarminStatus {
  connected: boolean;
  garminUserId?: string;
  lastSyncAt?: string;
  connectedAt?: string;
  authError?: boolean;
  needsReconnect?: boolean;
}

interface PrimaryDeviceStatus {
  primaryDevice: 'fitbit' | 'garmin' | null;
}

interface ActivityData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number;
}

export default function Devices() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [workoutMode, setWorkoutMode] = useState<WorkoutMode>('hybrid');
  
  useEffect(() => {
    if (user?.defaultWorkoutMode) {
      setWorkoutMode(user.defaultWorkoutMode as WorkoutMode);
    }
  }, [user?.defaultWorkoutMode]);

  const { data: fitbitStatus, isLoading: fitbitLoading } = useQuery<FitbitStatus | null>({
    queryKey: ['/api/fitbit/status'],
    queryFn: async () => {
      // Retry with session refresh for PWA timing issues
      for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        const res = await fetch('/api/fitbit/status', { credentials: 'include' });
        if (res.ok) return res.json();
        if (res.status === 401 && i < 2) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          continue;
        }
        if (res.status === 401) return null;
        return { connected: false };
      }
      return null;
    },
  });

  const { data: garminStatus, isLoading: garminLoading } = useQuery<GarminStatus | null>({
    queryKey: ['/api/garmin/status'],
    queryFn: async () => {
      // Retry with session refresh for PWA timing issues
      for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 500));
        const res = await fetch('/api/garmin/status', { credentials: 'include' });
        if (res.ok) return res.json();
        if (res.status === 401 && i < 2) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          continue;
        }
        if (res.status === 401) return null;
        return { connected: false };
      }
      return null;
    },
  });

  const { data: primaryDeviceStatus, isLoading: primaryDeviceLoading } = useQuery<PrimaryDeviceStatus>({
    queryKey: ['/api/primary-device'],
    enabled: fitbitStatus?.connected === true || garminStatus?.connected === true,
  });

  const { data: todayActivity } = useQuery<ActivityData>({
    queryKey: ['/api/activity/today'],
    enabled: fitbitStatus?.connected === true || garminStatus?.connected === true,
  });

  const updatePrimaryDeviceMutation = useMutation({
    mutationFn: async (device: 'fitbit' | 'garmin' | null) => {
      const res = await fetch('/api/primary-device', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ primaryDevice: device }),
      });
      if (!res.ok) throw new Error('Failed to update primary device');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/primary-device'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      toast({ 
        title: "Primary device updated", 
        description: data.primaryDevice 
          ? `${data.primaryDevice.charAt(0).toUpperCase() + data.primaryDevice.slice(1)} is now your primary device`
          : "Primary device preference cleared - using best available data"
      });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const updateWorkoutModeMutation = useMutation({
    mutationFn: async (mode: WorkoutMode) => {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ defaultWorkoutMode: mode }),
      });
      if (!res.ok) throw new Error('Failed to update workout mode');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ 
        title: "Workout mode updated",
        description: "Your default workout logging mode has been saved."
      });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleWorkoutModeChange = (mode: WorkoutMode) => {
    setWorkoutMode(mode);
    updateWorkoutModeMutation.mutate(mode);
  };

  const connectFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fitbit/auth-url', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to get authorization URL');
      const { url } = await res.json();
      window.location.href = url;
    },
  });

  const disconnectFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fitbit/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect Fitbit');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fitbit/status'] });
      toast({ title: "Fitbit disconnected", description: "Your Fitbit account has been unlinked." });
    },
  });

  const syncFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fitbit/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to sync data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fitbit/status'] });
      toast({ title: "Synced successfully!" });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Please try again or reconnect your Fitbit.", variant: "destructive" });
    },
  });

  const connectGarminMutation = useMutation({
    mutationFn: async () => {
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const res = await fetch('/api/garmin/auth-url', { credentials: 'include' });
        if (res.ok) {
          const { url } = await res.json();
          window.location.href = url;
          return;
        }
        
        if (res.status === 503) {
          throw new Error('Garmin integration is being configured. Please try again later.');
        }
        
        if (res.status === 401 && attempt < maxRetries - 1) {
          await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          continue;
        }
        
        const data = await res.json();
        lastError = new Error(data.message || 'Failed to connect to Garmin');
      }
      
      throw lastError || new Error('Failed to connect to Garmin');
    },
    onError: (error: any) => {
      toast({ 
        title: "Garmin Connection Issue", 
        description: error.message || "Please try again later or contact support.", 
        variant: "destructive" 
      });
    },
  });

  const disconnectGarminMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/garmin/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect Garmin');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/garmin/status'] });
      toast({ title: "Garmin disconnected", description: "Your Garmin account has been unlinked." });
    },
  });

  const syncGarminMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to sync Garmin data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/garmin/status'] });
      toast({ title: "Synced successfully!" });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Please try again or reconnect your Garmin.", variant: "destructive" });
    },
  });

  const backfillGarminMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/garmin/backfill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to request historical data');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/garmin/status'] });
      toast({ 
        title: "Historical data requested!", 
        description: data.message || "Your past 30 days of data will sync shortly."
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Backfill failed", 
        description: error.message || "Please try again or reconnect your Garmin.", 
        variant: "destructive" 
      });
    },
  });

  const reprocessStrengthMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/garmin/reprocess-strength', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reprocess workouts');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts'] });
      toast({ 
        title: "Workouts processed!", 
        description: data.message || `${data.processed} strength workouts enriched with detailed exercise data.`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Reprocess failed", 
        description: error.message || "Please try again or reconnect your Garmin.", 
        variant: "destructive" 
      });
    },
  });

  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const fitbitResult = urlParams.get('fitbit');
  const garminResult = urlParams.get('garmin');

  useEffect(() => {
    if (fitbitResult === 'connected') {
      toast({ title: "Fitbit connected!", description: "Your Fitbit account has been linked successfully." });
      window.history.replaceState({}, '', '/devices');
      queryClient.invalidateQueries({ queryKey: ['/api/fitbit/status'] });
    } else if (fitbitResult === 'error') {
      toast({ title: "Connection failed", description: "Failed to connect your Fitbit account.", variant: "destructive" });
      window.history.replaceState({}, '', '/devices');
    }
  }, [fitbitResult]);

  useEffect(() => {
    if (garminResult === 'connected') {
      toast({ title: "Garmin connected!", description: "Your Garmin account has been linked successfully." });
      window.history.replaceState({}, '', '/devices');
      queryClient.invalidateQueries({ queryKey: ['/api/garmin/status'] });
    } else if (garminResult === 'error') {
      toast({ title: "Connection failed", description: "Failed to connect your Garmin account.", variant: "destructive" });
      window.history.replaceState({}, '', '/devices');
    }
  }, [garminResult]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon" data-testid="button-back-to-profile">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">Devices & Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect your fitness devices to sync activity data</p>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FitbitLogo className="w-5 h-5 text-cyan-400" />
            Fitbit Integration
          </CardTitle>
          <CardDescription>Sync your Fitbit data automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fitbitLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" data-testid="loader-fitbit" />
            </div>
          ) : fitbitStatus?.connected ? (
            <>
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-cyan-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white" data-testid="text-fitbit-connected">Connected</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-fitbit-last-sync">
                      Last sync: {fitbitStatus.lastSyncAt 
                        ? new Date(fitbitStatus.lastSyncAt).toLocaleDateString() 
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0" data-testid="badge-fitbit-active">Active</Badge>
              </div>

              {todayActivity && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <Activity className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white" data-testid="text-today-steps">{todayActivity.steps.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Steps</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white" data-testid="text-today-calories">{todayActivity.caloriesBurned.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Calories</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => syncFitbitMutation.mutate()}
                  disabled={syncFitbitMutation.isPending}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  data-testid="button-sync-fitbit"
                >
                  {syncFitbitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync Now
                </Button>
                <Button
                  onClick={() => disconnectFitbitMutation.mutate()}
                  disabled={disconnectFitbitMutation.isPending}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  data-testid="button-disconnect-fitbit"
                >
                  <Unlink className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your Fitbit to automatically sync steps, calories, heart rate, and sleep data with your NutriCore profile.
              </p>
              <Button
                onClick={() => connectFitbitMutation.mutate()}
                disabled={connectFitbitMutation.isPending}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-connect-fitbit"
              >
                {connectFitbitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FitbitLogo className="w-4 h-4 mr-2" />
                )}
                Connect Fitbit
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <GarminLogo className="w-5 h-5 text-green-400" />
            Garmin Integration
          </CardTitle>
          <CardDescription>Sync your Garmin data automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {garminLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-green-400" data-testid="loader-garmin" />
            </div>
          ) : garminStatus?.connected ? (
            <>
              {garminStatus.needsReconnect && (
                <div className="p-3 bg-amber-500/20 rounded-lg border border-amber-500/40 mb-3" data-testid="warning-garmin-reconnect">
                  <p className="text-sm font-medium text-amber-400">Session expired</p>
                  <p className="text-xs text-amber-300/80">Your Garmin session has expired. Please disconnect and reconnect to refresh your connection.</p>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${garminStatus.needsReconnect ? 'bg-amber-500/20' : 'bg-green-500/20'}`}>
                    <CheckCircle className={`w-5 h-5 ${garminStatus.needsReconnect ? 'text-amber-400' : 'text-green-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-white" data-testid="text-garmin-connected">
                      {garminStatus.needsReconnect ? 'Reconnect Required' : 'Connected'}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid="text-garmin-last-sync">
                      Last sync: {garminStatus.lastSyncAt 
                        ? new Date(garminStatus.lastSyncAt).toLocaleDateString() 
                        : 'Never'}
                    </p>
                  </div>
                </div>
                <Badge className={`border-0 ${garminStatus.needsReconnect ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`} data-testid="badge-garmin-active">
                  {garminStatus.needsReconnect ? 'Needs Reconnect' : 'Active'}
                </Badge>
              </div>

              <div className="flex gap-2">
                {garminStatus.needsReconnect ? (
                  <Button
                    onClick={() => {
                      disconnectGarminMutation.mutate();
                    }}
                    disabled={disconnectGarminMutation.isPending}
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                    data-testid="button-reconnect-garmin"
                  >
                    {disconnectGarminMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Disconnect to Reconnect
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => syncGarminMutation.mutate()}
                      disabled={syncGarminMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-sync-garmin"
                    >
                      {syncGarminMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync Now
                    </Button>
                    <Button
                      onClick={() => backfillGarminMutation.mutate()}
                      disabled={backfillGarminMutation.isPending}
                      variant="outline"
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      title="Backfill historical data"
                      data-testid="button-backfill-garmin"
                    >
                      {backfillGarminMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      onClick={() => reprocessStrengthMutation.mutate()}
                      disabled={reprocessStrengthMutation.isPending}
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      title="Enrich strength workouts with exercise details"
                      data-testid="button-reprocess-strength"
                    >
                      {reprocessStrengthMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Dumbbell className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      onClick={() => disconnectGarminMutation.mutate()}
                      disabled={disconnectGarminMutation.isPending}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      data-testid="button-disconnect-garmin"
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your Garmin to automatically sync steps, calories, heart rate, and body composition with your NutriCore profile.
              </p>
              <Button
                onClick={() => connectGarminMutation.mutate()}
                disabled={connectGarminMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-connect-garmin"
              >
                {connectGarminMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <GarminLogo className="w-4 h-4 mr-2" />
                )}
                Connect Garmin
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {(fitbitStatus?.connected || garminStatus?.connected) && (
        <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Watch className="w-5 h-5 text-amber-400" />
              Primary Device
            </CardTitle>
            <CardDescription>
              When you have multiple devices connected, the primary device's data takes priority
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {primaryDeviceLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" data-testid="loader-primary-device" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {fitbitStatus?.connected && (
                    <button
                      onClick={() => updatePrimaryDeviceMutation.mutate('fitbit')}
                      disabled={updatePrimaryDeviceMutation.isPending}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        primaryDeviceStatus?.primaryDevice === 'fitbit'
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-black/20 border-white/10 hover:border-white/30'
                      }`}
                      data-testid="button-primary-device-fitbit"
                    >
                      <div className="flex items-center gap-3">
                        <FitbitLogo className="w-5 h-5 text-cyan-400" />
                        <span className="font-medium text-white">Fitbit</span>
                      </div>
                      {primaryDeviceStatus?.primaryDevice === 'fitbit' && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-0" data-testid="badge-primary-fitbit">Primary</Badge>
                      )}
                    </button>
                  )}
                  
                  {garminStatus?.connected && (
                    <button
                      onClick={() => updatePrimaryDeviceMutation.mutate('garmin')}
                      disabled={updatePrimaryDeviceMutation.isPending}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        primaryDeviceStatus?.primaryDevice === 'garmin'
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-black/20 border-white/10 hover:border-white/30'
                      }`}
                      data-testid="button-primary-device-garmin"
                    >
                      <div className="flex items-center gap-3">
                        <GarminLogo className="w-5 h-5 text-green-400" />
                        <span className="font-medium text-white">Garmin</span>
                      </div>
                      {primaryDeviceStatus?.primaryDevice === 'garmin' && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-0" data-testid="badge-primary-garmin">Primary</Badge>
                      )}
                    </button>
                  )}
                </div>
                
                {fitbitStatus?.connected && garminStatus?.connected && (
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-both-devices-connected">
                    Both devices connected. Select your preferred source of truth for activity data.
                  </p>
                )}
                
                {primaryDeviceStatus?.primaryDevice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updatePrimaryDeviceMutation.mutate(null)}
                    disabled={updatePrimaryDeviceMutation.isPending}
                    className="w-full text-muted-foreground hover:text-white"
                    data-testid="button-clear-primary-device"
                  >
                    Clear preference (use best available)
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            Workout Logging Mode
          </CardTitle>
          <CardDescription>
            Choose how you want to log workouts based on your tracking preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutModeSelector
            value={workoutMode}
            onChange={handleWorkoutModeChange}
            showDescription={true}
            disabled={updateWorkoutModeMutation.isPending}
            label=""
          />
        </CardContent>
      </Card>
    </div>
  );
}
