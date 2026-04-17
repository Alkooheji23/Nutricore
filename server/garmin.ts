import crypto from 'crypto';
import { db } from './db';
import { oauthPendingAuth } from '@shared/schema';
import { eq, lt } from 'drizzle-orm';

const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID || '';
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET || '';

const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const GARMIN_API_BASE = 'https://apis.garmin.com';

export async function generateAuthUrl(userId: string, redirectUri: string): Promise<{ url: string; state: string }> {
  if (!GARMIN_CLIENT_ID) {
    throw new Error('Garmin credentials not configured');
  }

  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store in database for persistence across server instances
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await db.insert(oauthPendingAuth).values({
    state,
    codeVerifier,
    userId,
    provider: 'garmin',
    expiresAt,
  });
  
  // Clean up expired entries
  await db.delete(oauthPendingAuth).where(lt(oauthPendingAuth.expiresAt, new Date()));
  
  console.log('[Garmin OAuth] Redirect URI:', redirectUri);
  console.log('[Garmin OAuth] State stored in database:', state);
  
  // Build the authorization URL with OAuth 2.0 PKCE parameters
  // Request both ACTIVITY_EXPORT and HEALTH_EXPORT for full access to health data
  const params = new URLSearchParams({
    client_id: GARMIN_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
  });
  
  const authUrl = `${GARMIN_AUTH_URL}?${params.toString()}`;
  
  console.log('[Garmin OAuth] Full auth URL:', authUrl);
  
  return {
    url: authUrl,
    state,
  };
}

export async function getPendingAuth(state: string): Promise<{ codeVerifier: string; userId: string } | null> {
  const [auth] = await db.select().from(oauthPendingAuth).where(eq(oauthPendingAuth.state, state));
  
  if (!auth) {
    console.log('[Garmin OAuth] No pending auth found for state:', state);
    return null;
  }
  
  if (auth.expiresAt < new Date()) {
    console.log('[Garmin OAuth] Pending auth expired for state:', state);
    await db.delete(oauthPendingAuth).where(eq(oauthPendingAuth.state, state));
    return null;
  }
  
  // Delete after retrieving (one-time use)
  await db.delete(oauthPendingAuth).where(eq(oauthPendingAuth.state, state));
  console.log('[Garmin OAuth] Retrieved and deleted pending auth for state:', state);
  
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
}> {
  // Garmin OAuth2 PKCE requires client_secret along with code_verifier
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: GARMIN_CLIENT_ID,
      client_secret: GARMIN_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Garmin Token Exchange] Failed with status:', response.status);
    console.error('[Garmin Token Exchange] Error response:', error);
    console.error('[Garmin Token Exchange] Request details - redirect_uri:', redirectUri, 'client_id:', GARMIN_CLIENT_ID);
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7776000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  // Garmin OAuth2 requires client_secret for refresh
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: GARMIN_CLIENT_ID,
      client_secret: GARMIN_CLIENT_SECRET,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Garmin Token Refresh] Failed with status:', response.status);
    console.error('[Garmin Token Refresh] Error response:', error);
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7776000,
  };
}

async function makeApiRequest(accessToken: string, endpoint: string): Promise<any> {
  const url = `${GARMIN_API_BASE}${endpoint}`;
  console.log('[Garmin API] Making request to:', url);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  const responseText = await response.text();
  console.log('[Garmin API] Response status:', response.status);
  console.log('[Garmin API] Response body:', responseText.substring(0, 500));
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (response.status === 400 && responseText.includes('InvalidPullTokenException')) {
      throw new Error('INVALID_PULL_TOKEN');
    }
    throw new Error(`API request failed: ${response.status} - ${responseText}`);
  }
  
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
}

export interface TokenUpdateCallback {
  (newTokens: { accessToken: string; refreshToken: string; expiresIn: number }): Promise<void>;
}

export async function makeApiRequestWithRefresh(
  tokens: TokenInfo,
  endpoint: string,
  onTokenRefresh: TokenUpdateCallback
): Promise<any> {
  try {
    return await makeApiRequest(tokens.accessToken, endpoint);
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED' && tokens.refreshToken) {
      console.log('[Garmin API] Token expired, attempting refresh...');
      try {
        const newTokens = await refreshAccessToken(tokens.refreshToken);
        console.log('[Garmin API] Token refresh successful, updating storage...');
        await onTokenRefresh(newTokens);
        return await makeApiRequest(newTokens.accessToken, endpoint);
      } catch (refreshError: any) {
        console.error('[Garmin API] Token refresh failed:', refreshError);
        throw new Error('TOKEN_REFRESH_FAILED');
      }
    }
    throw error;
  }
}

export async function getUserProfile(accessToken: string): Promise<{
  userId: string;
  displayName: string;
}> {
  const data = await makeApiRequest(accessToken, '/wellness-api/rest/user/id');
  return {
    userId: data.userId || '',
    displayName: data.displayName || 'Garmin User',
  };
}

export async function getUserPermissions(accessToken: string): Promise<string[]> {
  try {
    const data = await makeApiRequest(accessToken, '/wellness-api/rest/user/permissions');
    console.log('[Garmin Permissions] Raw response:', JSON.stringify(data));
    // Response is typically array: ["ACTIVITY_EXPORT", "HEALTH_EXPORT", ...]
    if (Array.isArray(data)) {
      return data;
    }
    // Sometimes it's { permissions: [...] }
    if (data.permissions && Array.isArray(data.permissions)) {
      return data.permissions;
    }
    return [];
  } catch (error: any) {
    // Rethrow TOKEN_EXPIRED so it can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('[Garmin Permissions] Failed to fetch:', error);
    return [];
  }
}

export interface GarminDailySummary {
  steps: number;
  caloriesOut: number;
  activeMinutes: number;
  distance: number;
  floors: number;
  restingHeartRate: number | null;
  maxHeartRate: number | null;
  avgHeartRate: number | null;
  sleepMinutes: number;
  sleepStages: { deep: number; light: number; rem: number; awake: number } | null;
}

export async function getDailySummary(
  accessToken: string,
  date: string
): Promise<GarminDailySummary> {
  try {
    // Garmin Pull API uses uploadStartTimeInSeconds which filters by UPLOAD time
    // Maximum time range is 86400 seconds (24 hours)
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60); // 24 hours ago (max allowed)
    
    console.log(`[Garmin getDailySummary] Fetching dailies uploaded in last 24 hours, looking for date: ${date}`);

    const dailies = await makeApiRequest(
      accessToken,
      `/wellness-api/rest/dailies?uploadStartTimeInSeconds=${oneDayAgo}&uploadEndTimeInSeconds=${now}`
    );

    console.log('[Garmin getDailySummary] Raw dailies response:', JSON.stringify(dailies).substring(0, 1000));

    // Find the daily summary for the requested date
    let daily: any = {};
    if (Array.isArray(dailies) && dailies.length > 0) {
      // Find the entry matching the requested date, or use the first one
      const targetDate = date; // YYYY-MM-DD
      daily = dailies.find((d: any) => d.calendarDate === targetDate) || dailies[0];
      console.log(`[Garmin getDailySummary] Found ${dailies.length} daily entries, using entry for ${daily.calendarDate || 'unknown date'}`);
    } else {
      console.log('[Garmin getDailySummary] No daily entries found in response');
    }

    return {
      steps: daily.steps || 0,
      // Use total calories (active + BMR) for daily summary, not just activity calories
      caloriesOut: (daily.activeKilocalories || 0) + (daily.bmrKilocalories || 0),
      activeMinutes: daily.moderateIntensityDurationInSeconds 
        ? Math.round((daily.moderateIntensityDurationInSeconds + (daily.vigorousIntensityDurationInSeconds || 0)) / 60)
        : 0,
      distance: daily.distanceInMeters ? daily.distanceInMeters / 1000 : 0,
      floors: daily.floorsClimbed || 0,
      restingHeartRate: daily.restingHeartRateInBeatsPerMinute || null,
      maxHeartRate: daily.maxHeartRateInBeatsPerMinute || null,
      avgHeartRate: daily.averageHeartRateInBeatsPerMinute || null,
      sleepMinutes: daily.sleepingSeconds ? Math.round(daily.sleepingSeconds / 60) : 0,
      sleepStages: daily.sleepLevelsMap ? {
        deep: Math.round((daily.sleepLevelsMap.deep || 0) / 60),
        light: Math.round((daily.sleepLevelsMap.light || 0) / 60),
        rem: Math.round((daily.sleepLevelsMap.rem || 0) / 60),
        awake: Math.round((daily.sleepLevelsMap.awake || 0) / 60),
      } : null,
    };
  } catch (error) {
    console.error('[Garmin getDailySummary] Failed:', error);
    // Rethrow to let caller handle it, don't silently return zeros
    throw error;
  }
}

// Fetch sleep data from the dedicated sleeps endpoint
export async function getSleepSummary(
  accessToken: string,
  date: string
): Promise<{ sleepMinutes: number; sleepEfficiency: number | null; sleepStages: { deep: number; light: number; rem: number; awake: number } | null; timeInBed: number | null }> {
  try {
    // Garmin Pull API uses uploadStartTimeInSeconds which filters by UPLOAD time
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);
    
    console.log(`[Garmin getSleepSummary] Fetching sleep data uploaded in last 24 hours, looking for date: ${date}`);

    const sleeps = await makeApiRequest(
      accessToken,
      `/wellness-api/rest/sleeps?uploadStartTimeInSeconds=${oneDayAgo}&uploadEndTimeInSeconds=${now}`
    );

    console.log('[Garmin getSleepSummary] Raw sleeps response:', JSON.stringify(sleeps).substring(0, 1000));

    // Find sleep data for the requested date
    // Sleep data is typically assigned to the date when you woke up
    let sleep: any = null;
    if (Array.isArray(sleeps) && sleeps.length > 0) {
      // Match by calendarDate
      sleep = sleeps.find((s: any) => s.calendarDate === date);
      if (sleep) {
        console.log(`[Garmin getSleepSummary] Found sleep data for ${date}`);
      } else {
        console.log(`[Garmin getSleepSummary] No sleep data found for ${date}, available dates: ${sleeps.map((s: any) => s.calendarDate).join(', ')}`);
      }
    } else {
      console.log('[Garmin getSleepSummary] No sleep entries found in response');
    }

    if (!sleep) {
      return { sleepMinutes: 0, sleepEfficiency: null, sleepStages: null, timeInBed: null };
    }

    // Garmin provides sleep duration in seconds
    const sleepMinutes = sleep.durationInSeconds ? Math.round(sleep.durationInSeconds / 60) : 0;
    const timeInBed = sleep.unmeasurableSleepInSeconds 
      ? Math.round((sleep.durationInSeconds + sleep.unmeasurableSleepInSeconds) / 60)
      : sleepMinutes;
    
    // Calculate sleep efficiency if we have time in bed
    const sleepEfficiency = timeInBed > 0 ? Math.round((sleepMinutes / timeInBed) * 100) : null;

    // Extract sleep stages
    let sleepStages = null;
    if (sleep.sleepLevelsMap) {
      sleepStages = {
        deep: sleep.sleepLevelsMap.deep 
          ? Math.round(sleep.sleepLevelsMap.deep.reduce((sum: number, segment: any) => sum + (segment.endTimeInSeconds - segment.startTimeInSeconds), 0) / 60)
          : 0,
        light: sleep.sleepLevelsMap.light 
          ? Math.round(sleep.sleepLevelsMap.light.reduce((sum: number, segment: any) => sum + (segment.endTimeInSeconds - segment.startTimeInSeconds), 0) / 60)
          : 0,
        rem: sleep.sleepLevelsMap.rem 
          ? Math.round(sleep.sleepLevelsMap.rem.reduce((sum: number, segment: any) => sum + (segment.endTimeInSeconds - segment.startTimeInSeconds), 0) / 60)
          : 0,
        awake: sleep.sleepLevelsMap.awake 
          ? Math.round(sleep.sleepLevelsMap.awake.reduce((sum: number, segment: any) => sum + (segment.endTimeInSeconds - segment.startTimeInSeconds), 0) / 60)
          : 0,
      };
    } else if (sleep.deepSleepDurationInSeconds != null || sleep.lightSleepDurationInSeconds != null) {
      // Fallback: some Garmin responses use direct duration fields
      sleepStages = {
        deep: sleep.deepSleepDurationInSeconds ? Math.round(sleep.deepSleepDurationInSeconds / 60) : 0,
        light: sleep.lightSleepDurationInSeconds ? Math.round(sleep.lightSleepDurationInSeconds / 60) : 0,
        rem: sleep.remSleepInSeconds ? Math.round(sleep.remSleepInSeconds / 60) : 0,
        awake: sleep.awakeDurationInSeconds ? Math.round(sleep.awakeDurationInSeconds / 60) : 0,
      };
    }

    console.log(`[Garmin getSleepSummary] Parsed sleep: ${sleepMinutes} mins, efficiency: ${sleepEfficiency}%, stages:`, sleepStages);

    return { sleepMinutes, sleepEfficiency, sleepStages, timeInBed };
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('[Garmin getSleepSummary] Failed:', error);
    return { sleepMinutes: 0, sleepEfficiency: null, sleepStages: null, timeInBed: null };
  }
}

export async function getBodyComposition(
  accessToken: string,
  date: string
): Promise<{ weight: number | null }> {
  try {
    const startTime = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
    const endTime = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

    const data = await makeApiRequest(
      accessToken,
      `/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${startTime}&uploadEndTimeInSeconds=${endTime}`
    );

    if (Array.isArray(data) && data.length > 0) {
      const weightInGrams = data[0].weightInGrams;
      return { weight: weightInGrams ? weightInGrams / 1000 : null };
    }

    return { weight: null };
  } catch (error: any) {
    // Rethrow TOKEN_EXPIRED so it can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('[Garmin getBodyComposition] Failed:', error);
    return { weight: null };
  }
}

export interface GarminActivity {
  activityId: string;
  summaryId: string | null; // Server-assigned ID for FIT file downloads
  activityName: string;
  activityType: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  activeKilocalories: number;
  distanceInMeters: number | null;
  averageHeartRateInBeatsPerMinute: number | null;
  maxHeartRateInBeatsPerMinute: number | null;
  averagePaceInMinutesPerKilometer: number | null;
  elevationGainInMeters: number | null;
  averagePowerInWatts: number | null;
}

export async function getActivities(
  accessToken: string,
  date?: string
): Promise<GarminActivity[]> {
  try {
    // Garmin Pull API uses uploadStartTimeInSeconds which filters by UPLOAD time
    // Maximum time range is 86400 seconds (24 hours)
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60); // 24 hours ago (max allowed)

    console.log(`[Garmin getActivities] Fetching activities uploaded in last 24 hours${date ? `, filtering for date: ${date}` : ' (all dates)'}`);
    const data = await makeApiRequest(
      accessToken,
      `/wellness-api/rest/activities?uploadStartTimeInSeconds=${oneDayAgo}&uploadEndTimeInSeconds=${now}`
    );

    console.log('[Garmin getActivities] Raw response:', JSON.stringify(data).substring(0, 1000));

    if (Array.isArray(data)) {
      // If date is provided, filter to only include activities from that date
      // Otherwise, return ALL activities from the last 24 hours of uploads
      let filtered = data;
      if (date) {
        filtered = data.filter((activity: any) => {
          if (!activity.startTimeInSeconds) return false;
          const activityDate = new Date(activity.startTimeInSeconds * 1000).toISOString().split('T')[0];
          return activityDate === date;
        });
        console.log(`[Garmin getActivities] Found ${data.length} total activities, ${filtered.length} matching date ${date}`);
      } else {
        console.log(`[Garmin getActivities] Found ${data.length} total activities (returning all)`);
      }
      
      return filtered.map((activity: any) => {
        // Log raw activity data to see what IDs Garmin provides
        console.log(`[Garmin Activity] Raw IDs - activityId: ${activity.activityId}, summaryId: ${activity.summaryId}, activityUUID: ${activity.activityUUID}`);
        return {
          activityId: String(activity.activityId || ''),
          summaryId: activity.summaryId ? String(activity.summaryId) : null,
          activityName: activity.activityName || activity.activityType || 'Workout',
          activityType: mapGarminActivityType(activity.activityType),
          startTimeInSeconds: activity.startTimeInSeconds || 0,
          durationInSeconds: activity.durationInSeconds || 0,
          activeKilocalories: activity.activeKilocalories || 0,
          distanceInMeters: activity.distanceInMeters || null,
          averageHeartRateInBeatsPerMinute: activity.averageHeartRateInBeatsPerMinute || null,
          maxHeartRateInBeatsPerMinute: activity.maxHeartRateInBeatsPerMinute || null,
          averagePaceInMinutesPerKilometer: activity.averagePaceInMinutesPerKilometer || null,
          elevationGainInMeters: activity.elevationGainInMeters || null,
          averagePowerInWatts: activity.averagePowerInWatts || null,
        };
      });
    }

    return [];
  } catch (error: any) {
    // Rethrow TOKEN_EXPIRED so it can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.error('[Garmin getActivities] Failed:', error);
    return [];
  }
}

function mapGarminActivityType(garminType: string): string {
  const typeMap: Record<string, string> = {
    'RUNNING': 'running',
    'CYCLING': 'cycling',
    'WALKING': 'walking',
    'SWIMMING': 'swimming',
    'STRENGTH_TRAINING': 'strength',
    'HIKING': 'hiking',
    'YOGA': 'yoga',
    'PILATES': 'pilates',
    'INDOOR_CYCLING': 'cycling',
    'TREADMILL_RUNNING': 'running',
    'ELLIPTICAL': 'cardio',
    'STAIR_CLIMBING': 'cardio',
    'ROWING': 'rowing',
  };
  return typeMap[garminType] || 'other';
}

async function downloadFitInternal(accessToken: string, activityId: string): Promise<Buffer | null> {
  // Garmin Health API OAuth 2.0 - FIT file download
  // Correct endpoint: GET /wellness-api/rest/activityFile?id={activity_id}
  const url = `${GARMIN_API_BASE}/wellness-api/rest/activityFile?id=${activityId}`;
  console.log(`[Garmin FIT Download] Requesting: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/octet-stream',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errorText = await response.text().catch(() => 'No error body');
    console.error(`[Garmin FIT Download] Failed with status ${response.status}: ${errorText.substring(0, 500)}`);
    // Throw error with details so it can be captured upstream
    throw new Error(`HTTP_${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log(`[Garmin FIT Download] Received ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}

// Download FIT file using callbackURL provided in webhook (preferred method)
export async function downloadFitFromCallback(accessToken: string, callbackUrl: string): Promise<Buffer | null> {
  console.log(`[Garmin FIT Download] Using callback URL: ${callbackUrl}`);
  
  const response = await fetch(callbackUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.garmin.activity+fit',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errorText = await response.text().catch(() => 'No error body');
    console.error(`[Garmin FIT Callback Download] Failed with status ${response.status}: ${errorText.substring(0, 500)}`);
    throw new Error(`HTTP_${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log(`[Garmin FIT Callback Download] Received ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}

// Download FIT with token refresh using callbackURL (preferred method)
export async function downloadFitFromCallbackWithRefresh(
  tokens: TokenInfo,
  callbackUrl: string,
  onTokenRefresh: TokenUpdateCallback
): Promise<Buffer | null> {
  try {
    return await downloadFitFromCallback(tokens.accessToken, callbackUrl);
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED' && tokens.refreshToken) {
      console.log('[Garmin FIT Callback Download] Token expired, attempting refresh...');
      try {
        const newTokens = await refreshAccessToken(tokens.refreshToken);
        console.log('[Garmin FIT Callback Download] Token refresh successful');
        await onTokenRefresh(newTokens);
        return await downloadFitFromCallback(newTokens.accessToken, callbackUrl);
      } catch (refreshError: any) {
        console.error('[Garmin FIT Callback Download] Token refresh failed:', refreshError);
        throw new Error('TOKEN_REFRESH_FAILED');
      }
    }
    throw error;
  }
}

export async function downloadActivityFit(
  accessToken: string,
  activityId: string
): Promise<Buffer | null> {
  try {
    console.log(`[Garmin downloadActivityFit] Downloading FIT for activity ${activityId}`);
    const buffer = await downloadFitInternal(accessToken, activityId);
    if (buffer) {
      console.log(`[Garmin downloadActivityFit] Downloaded ${buffer.length} bytes for activity ${activityId}`);
    }
    return buffer;
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    // Re-throw with error details for upstream handling
    console.error('[Garmin downloadActivityFit] Failed:', error.message);
    throw error;
  }
}

export async function downloadActivityFitWithRefresh(
  tokens: TokenInfo,
  activityId: string,
  onTokenRefresh: TokenUpdateCallback
): Promise<Buffer | null> {
  try {
    console.log(`[Garmin downloadActivityFit] Downloading FIT for activity ${activityId}`);
    return await downloadFitInternal(tokens.accessToken, activityId);
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED' && tokens.refreshToken) {
      console.log('[Garmin downloadActivityFit] Token expired, attempting refresh...');
      try {
        const newTokens = await refreshAccessToken(tokens.refreshToken);
        console.log('[Garmin downloadActivityFit] Token refresh successful, updating storage...');
        await onTokenRefresh(newTokens);
        return await downloadFitInternal(newTokens.accessToken, activityId);
      } catch (refreshError: any) {
        console.error('[Garmin downloadActivityFit] Token refresh failed:', refreshError);
        throw new Error('TOKEN_REFRESH_FAILED');
      }
    }
    // Re-throw error so it can be captured with full details
    console.error('[Garmin downloadActivityFit] Failed:', error.message);
    throw error;
  }
}

export interface SyncedGarminData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number;
  floors: number;
  restingHeartRate: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  sleepMinutes: number;
  sleepEfficiency: number | null;
  sleepStages: { deep: number; light: number; rem: number; awake: number } | null;
  timeInBed: number | null;
  weight: number | null;
  activities: GarminActivity[];
}

export async function syncDailyData(
  accessToken: string,
  date: string
): Promise<SyncedGarminData> {
  console.log('[Garmin syncDailyData] Starting sync for date:', date);
  
  let summary: GarminDailySummary = {
    steps: 0,
    caloriesOut: 0,
    activeMinutes: 0,
    distance: 0,
    floors: 0,
    restingHeartRate: null,
    maxHeartRate: null,
    avgHeartRate: null,
    sleepMinutes: 0,
    sleepStages: null,
  };
  
  let bodyComp = { weight: null as number | null };
  let sleepData = { sleepMinutes: 0, sleepEfficiency: null as number | null, sleepStages: null as { deep: number; light: number; rem: number; awake: number } | null, timeInBed: null as number | null };
  
  try {
    summary = await getDailySummary(accessToken, date);
  } catch (error: any) {
    // Rethrow auth-related errors so they can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_PULL_TOKEN') {
      throw error;
    }
    console.error('[Garmin syncDailyData] Failed to get daily summary:', error.message);
    // Continue with zeros if daily summary fails for non-auth reasons
  }
  
  // Fetch sleep data from dedicated sleeps endpoint
  try {
    sleepData = await getSleepSummary(accessToken, date);
    console.log(`[Garmin syncDailyData] Sleep data: ${sleepData.sleepMinutes} mins, efficiency: ${sleepData.sleepEfficiency}%`);
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_PULL_TOKEN') {
      throw error;
    }
    console.error('[Garmin syncDailyData] Failed to get sleep data:', error.message);
  }
  
  try {
    bodyComp = await getBodyComposition(accessToken, date);
  } catch (error: any) {
    // Rethrow auth-related errors so they can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_PULL_TOKEN') {
      throw error;
    }
    console.error('[Garmin syncDailyData] Failed to get body composition:', error.message);
    // Continue with null weight if body comp fails for non-auth reasons
  }
  
  // Fetch ALL workout activities uploaded in the last 24 hours (not filtered by date)
  // This ensures we capture workouts from any day that were recently synced to Garmin
  let activities: GarminActivity[] = [];
  try {
    activities = await getActivities(accessToken); // No date filter - get all recent uploads
    console.log(`[Garmin syncDailyData] Found ${activities.length} activities from recent uploads`);
  } catch (error: any) {
    // Rethrow auth-related errors so they can be handled by retry logic
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_PULL_TOKEN') {
      throw error;
    }
    console.error('[Garmin syncDailyData] Failed to get activities:', error.message);
  }

  const result = {
    steps: summary.steps,
    caloriesBurned: summary.caloriesOut,
    activeMinutes: summary.activeMinutes,
    distance: summary.distance,
    floors: summary.floors,
    restingHeartRate: summary.restingHeartRate,
    averageHeartRate: summary.avgHeartRate,
    maxHeartRate: summary.maxHeartRate,
    sleepMinutes: sleepData.sleepMinutes,
    sleepEfficiency: sleepData.sleepEfficiency,
    sleepStages: sleepData.sleepStages,
    timeInBed: sleepData.timeInBed,
    weight: bodyComp.weight,
    activities,
  };
  
  console.log('[Garmin syncDailyData] Final result:', JSON.stringify(result));
  return result;
}

// Request backfill of historical data from Garmin
// This tells Garmin to push historical data to our configured webhooks
// Note: Garmin backfill uses healthapi.garmin.com base URL and POST method
const GARMIN_HEALTH_API_BASE = 'https://healthapi.garmin.com';

export async function requestBackfill(
  accessToken: string,
  dataTypes: ('dailies' | 'activities' | 'sleeps' | 'bodyComps')[],
  startDate: string,
  endDate: string
): Promise<{ success: boolean; message: string; results: any[] }> {
  const results: any[] = [];
  const startTime = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const endTime = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  
  console.log(`[Garmin Backfill] Requesting backfill from ${startDate} to ${endDate}`);
  console.log(`[Garmin Backfill] Unix timestamps: ${startTime} to ${endTime}`);
  console.log(`[Garmin Backfill] Data types: ${dataTypes.join(', ')}`);
  
  // Map our data types to Garmin API endpoints
  // Backfill uses healthapi.garmin.com with POST method
  const endpointMap: Record<string, string> = {
    'dailies': '/wellness-api/rest/backfill/dailies',
    'activities': '/wellness-api/rest/backfill/activities',
    'sleeps': '/wellness-api/rest/backfill/sleeps',
    'bodyComps': '/wellness-api/rest/backfill/bodyComps',
  };
  
  for (const dataType of dataTypes) {
    const endpoint = endpointMap[dataType];
    if (!endpoint) continue;
    
    try {
      // Try healthapi.garmin.com first (official backfill endpoint)
      let url = `${GARMIN_HEALTH_API_BASE}${endpoint}?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`;
      console.log(`[Garmin Backfill] Requesting ${dataType} from:`, url);
      
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      // If healthapi fails, try apis.garmin.com as fallback
      if (!response.ok && response.status === 401) {
        url = `${GARMIN_API_BASE}${endpoint}?summaryStartTimeInSeconds=${startTime}&summaryEndTimeInSeconds=${endTime}`;
        console.log(`[Garmin Backfill] Fallback: trying ${url}`);
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
      
      const responseText = await response.text();
      console.log(`[Garmin Backfill] ${dataType} response status:`, response.status);
      console.log(`[Garmin Backfill] ${dataType} response:`, responseText.substring(0, 500));
      
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          data = responseText;
        }
        results.push({ dataType, success: true, data });
      } else {
        results.push({ dataType, success: false, error: responseText, status: response.status });
      }
    } catch (error: any) {
      console.error(`[Garmin Backfill] ${dataType} error:`, error.message);
      results.push({ dataType, success: false, error: error.message });
    }
  }
  
  const allSuccess = results.every(r => r.success);
  const someSuccess = results.some(r => r.success);
  
  return {
    success: allSuccess,
    message: allSuccess 
      ? 'Backfill requested successfully. Data will arrive via webhooks within a few minutes.'
      : someSuccess
        ? 'Some backfill requests succeeded. Data will arrive via webhooks shortly.'
        : 'Backfill requests failed. This may require using Garmin\'s web tool at healthapi.garmin.com/tools/login',
    results,
  };
}
