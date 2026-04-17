import crypto from 'crypto';

const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID!;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET!;
const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API_BASE = 'https://api.fitbit.com';

const pendingAuths = new Map<string, { codeVerifier: string; userId: string; expiresAt: number }>();

export function generateAuthUrl(userId: string, redirectUri: string): { url: string; state: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  
  pendingAuths.set(state, {
    codeVerifier,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  
  const keysToDelete: string[] = [];
  pendingAuths.forEach((value, key) => {
    if (value.expiresAt < Date.now()) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => pendingAuths.delete(key));
  
  const params = new URLSearchParams({
    client_id: FITBIT_CLIENT_ID,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'activity heartrate sleep profile',
    redirect_uri: redirectUri,
    state: state,
  });
  
  return {
    url: `${FITBIT_AUTH_URL}?${params.toString()}`,
    state,
  };
}

export function getPendingAuth(state: string): { codeVerifier: string; userId: string } | null {
  const auth = pendingAuths.get(state);
  if (!auth || auth.expiresAt < Date.now()) {
    pendingAuths.delete(state);
    return null;
  }
  pendingAuths.delete(state);
  return { codeVerifier: auth.codeVerifier, userId: auth.userId };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  scope: string;
}> {
  const basicAuth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Fitbit token exchange failed:', error);
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userId: data.user_id,
    scope: data.scope,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const basicAuth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Fitbit token refresh failed:', error);
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function makeApiRequest(accessToken: string, endpoint: string): Promise<any> {
  const response = await fetch(`${FITBIT_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error(`API request failed: ${response.status}`);
  }
  
  return response.json();
}

export async function getUserProfile(accessToken: string): Promise<{
  displayName: string;
  avatar: string;
  memberSince: string;
}> {
  const data = await makeApiRequest(accessToken, '/1/user/-/profile.json');
  return {
    displayName: data.user.displayName,
    avatar: data.user.avatar,
    memberSince: data.user.memberSince,
  };
}

export interface FitbitActivity {
  logId: string;
  activityName: string;
  activityType: string;
  startTime: string;
  duration: number;
  caloriesBurned: number;
  distance: number | null;
  averageHeartRate: number | null;
  steps: number | null;
}

export async function getActivitySummary(accessToken: string, date: string): Promise<{
  steps: number;
  caloriesOut: number;
  activeMinutes: number;
  distance: number;
  floors: number;
  activities: Array<{ type: string; duration: number; intensity: string; caloriesBurned: number }>;
  detailedActivities: FitbitActivity[];
}> {
  const data = await makeApiRequest(accessToken, `/1/user/-/activities/date/${date}.json`);
  
  const summary = data.summary || {};
  const distances = summary.distances || [];
  const totalDistance = distances.find((d: any) => d.activity === 'total')?.distance || 0;
  
  // Extract individual activities with type, duration, and intensity
  const rawActivities = data.activities || [];
  const activities = rawActivities.map((a: any) => ({
    type: a.name || a.activityName || 'Activity',
    duration: Math.round((a.duration || 0) / 60000), // Convert ms to minutes
    intensity: a.averageHeartRate > 140 ? 'high' : a.averageHeartRate > 100 ? 'medium' : 'low',
    caloriesBurned: a.calories || 0,
  }));
  
  // Extract detailed activities for storing in wearable_activities
  const detailedActivities: FitbitActivity[] = rawActivities.map((a: any) => ({
    logId: String(a.logId || a.activityId || `${date}-${a.name}-${a.startTime}`),
    activityName: a.name || a.activityName || 'Activity',
    activityType: mapFitbitActivityType(a.activityTypeId, a.name),
    startTime: a.startTime || date,
    duration: Math.round((a.duration || 0) / 60000), // Convert ms to minutes
    caloriesBurned: a.calories || 0,
    distance: a.distance || null,
    averageHeartRate: a.averageHeartRate || null,
    steps: a.steps || null,
  }));
  
  return {
    steps: summary.steps || 0,
    caloriesOut: summary.caloriesOut || 0,
    activeMinutes: (summary.veryActiveMinutes || 0) + (summary.fairlyActiveMinutes || 0),
    distance: totalDistance,
    floors: summary.floors || 0,
    activities,
    detailedActivities,
  };
}

function mapFitbitActivityType(activityTypeId: number | undefined, activityName: string): string {
  const nameLower = (activityName || '').toLowerCase();
  
  if (nameLower.includes('run') || nameLower.includes('jog')) return 'running';
  if (nameLower.includes('walk')) return 'walking';
  if (nameLower.includes('bike') || nameLower.includes('cycl')) return 'cycling';
  if (nameLower.includes('swim')) return 'swimming';
  if (nameLower.includes('yoga')) return 'yoga';
  if (nameLower.includes('weight') || nameLower.includes('strength')) return 'strength_training';
  if (nameLower.includes('hiit') || nameLower.includes('interval')) return 'hiit';
  if (nameLower.includes('elliptical')) return 'elliptical';
  if (nameLower.includes('treadmill')) return 'treadmill';
  if (nameLower.includes('rowing') || nameLower.includes('row')) return 'rowing';
  if (nameLower.includes('sport')) return 'sports';
  
  return 'workout';
}

export async function getHeartRateSummary(accessToken: string, date: string): Promise<{
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  zones: Array<{ name: string; minutes: number; caloriesOut: number }>;
}> {
  try {
    const data = await makeApiRequest(accessToken, `/1/user/-/activities/heart/date/${date}/1d.json`);
    
    const heartData = data['activities-heart']?.[0]?.value || {};
    const zones = (heartData.heartRateZones || []).map((zone: any) => ({
      name: zone.name,
      minutes: zone.minutes || 0,
      caloriesOut: zone.caloriesOut || 0,
    }));
    
    // Calculate max HR from zones data (highest zone with minutes > 0)
    let maxHeartRate: number | null = null;
    for (const zone of zones.reverse()) {
      if (zone.minutes > 0) {
        maxHeartRate = zone.name === 'Peak' ? 180 : zone.name === 'Cardio' ? 160 : zone.name === 'Fat Burn' ? 140 : 100;
        break;
      }
    }
    
    return {
      restingHeartRate: heartData.restingHeartRate || null,
      averageHeartRate: null, // Fitbit doesn't provide daily average directly
      maxHeartRate,
      zones: zones.reverse(), // Put back in original order
    };
  } catch (error) {
    return { restingHeartRate: null, averageHeartRate: null, maxHeartRate: null, zones: [] };
  }
}

export async function getSleepSummary(accessToken: string, date: string): Promise<{
  totalMinutesAsleep: number;
  totalTimeInBed: number;
  efficiency: number;
  stages: { deep: number; light: number; rem: number; awake: number } | null;
}> {
  try {
    const data = await makeApiRequest(accessToken, `/1.2/user/-/sleep/date/${date}.json`);
    
    const summary = data.summary || {};
    const stages = summary.stages || null;
    
    return {
      totalMinutesAsleep: summary.totalMinutesAsleep || 0,
      totalTimeInBed: summary.totalTimeInBed || 0,
      efficiency: summary.efficiency || 0,
      stages: stages ? {
        deep: stages.deep || 0,
        light: stages.light || 0,
        rem: stages.rem || 0,
        awake: stages.wake || 0,
      } : null,
    };
  } catch (error) {
    return { totalMinutesAsleep: 0, totalTimeInBed: 0, efficiency: 0, stages: null };
  }
}

export async function getHrvSummary(accessToken: string, date: string): Promise<{
  rmssd: number | null;
  score: number | null;
}> {
  try {
    // HRV data requires premium Fitbit subscription and specific scope
    const data = await makeApiRequest(accessToken, `/1/user/-/hrv/date/${date}.json`);
    
    const hrvData = data.hrv?.[0]?.value || {};
    
    return {
      rmssd: hrvData.dailyRmssd || null,
      score: hrvData.deepRmssd ? Math.round((hrvData.deepRmssd / 100) * 100) : null, // Normalize to 0-100
    };
  } catch (error) {
    // HRV data may not be available for all users
    return { rmssd: null, score: null };
  }
}

export interface SyncedDailyData {
  // Movement
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number;
  floors: number;
  activities: Array<{ type: string; duration: number; intensity: string; caloriesBurned: number }>;
  detailedActivities: FitbitActivity[];
  
  // Heart rate
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  heartRateZones: Array<{ name: string; minutes: number; caloriesOut: number }>;
  
  // HRV
  hrvRmssd: number | null;
  hrvScore: number | null;
  
  // Sleep
  sleepMinutes: number;
  sleepEfficiency: number;
  sleepStages: { deep: number; light: number; rem: number; awake: number } | null;
  timeInBed: number;
}

export async function syncDailyData(accessToken: string, date: string): Promise<SyncedDailyData> {
  const [activity, heartRate, sleep, hrv] = await Promise.all([
    getActivitySummary(accessToken, date),
    getHeartRateSummary(accessToken, date),
    getSleepSummary(accessToken, date),
    getHrvSummary(accessToken, date),
  ]);
  
  return {
    // Movement
    steps: activity.steps,
    caloriesBurned: activity.caloriesOut,
    activeMinutes: activity.activeMinutes,
    distance: activity.distance,
    floors: activity.floors,
    activities: activity.activities,
    detailedActivities: activity.detailedActivities,
    
    // Heart rate
    restingHeartRate: heartRate.restingHeartRate,
    averageHeartRate: heartRate.averageHeartRate,
    maxHeartRate: heartRate.maxHeartRate,
    heartRateZones: heartRate.zones,
    
    // HRV
    hrvRmssd: hrv.rmssd,
    hrvScore: hrv.score,
    
    // Sleep
    sleepMinutes: sleep.totalMinutesAsleep,
    sleepEfficiency: sleep.efficiency,
    sleepStages: sleep.stages,
    timeInBed: sleep.totalTimeInBed,
  };
}
