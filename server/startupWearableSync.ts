import { storage } from './storage';
import { syncDailyData, refreshAccessToken } from './garmin';

/**
 * On server startup, pull today's data from Garmin for all connected users.
 * Recovers data missed while the server was down (Replit restarts, etc.).
 */
export async function runStartupWearableSync() {
  // Small delay so DB and auth are fully ready
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('[StartupSync] Running startup wearable sync...');
  const today = new Date().toISOString().split('T')[0];

  let synced = 0;
  let failed = 0;

  try {
    const connections = await storage.getAllActiveSmartwatchConnections();
    const garminConnections = connections.filter(c => c.provider === 'garmin' && c.accessToken);

    console.log(`[StartupSync] Found ${garminConnections.length} active Garmin connections`);

    for (const conn of garminConnections) {
      try {
        let accessToken = conn.accessToken!;

        // Refresh token if expired
        if (conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) < new Date() && conn.refreshToken) {
          try {
            const refreshed = await refreshAccessToken(conn.refreshToken);
            accessToken = refreshed.accessToken;
            await storage.updateSmartwatchConnection(conn.id, {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
            });
          } catch {
            console.warn(`[StartupSync] Token refresh failed for connection ${conn.id}, skipping`);
            continue;
          }
        }

        const data = await syncDailyData(accessToken, today);

        const hasData = data.steps > 0 || data.caloriesBurned > 0 || data.activeMinutes > 0 || data.sleepMinutes > 0;
        if (!hasData) {
          console.log(`[StartupSync] No data yet for user ${conn.userId}, skipping`);
          synced++;
          continue;
        }

        await storage.upsertDeviceMetricsRaw({
          userId: conn.userId,
          date: today,
          sourceDevice: 'garmin',
          steps: data.steps,
          caloriesBurned: data.caloriesBurned,
          activeMinutes: data.activeMinutes,
          distance: data.distance,
          floors: data.floors,
          restingHeartRate: data.restingHeartRate,
          averageHeartRate: data.averageHeartRate,
          maxHeartRate: data.maxHeartRate,
          sleepMinutes: data.sleepMinutes,
          sleepEfficiency: data.sleepEfficiency,
          sleepStages: data.sleepStages,
          timeInBed: data.timeInBed,
          isEvaluationData: false,
        });

        await storage.resolveAndSaveDailyActivity(conn.userId, today);

        await storage.updateSmartwatchConnection(conn.id, { lastSyncAt: new Date() });
        synced++;
        console.log(`[StartupSync] Synced today's data for user ${conn.userId}`);
      } catch (err: any) {
        console.error(`[StartupSync] Failed for connection ${conn.id}:`, err.message);
        failed++;
      }
    }
  } catch (err) {
    console.error('[StartupSync] Error fetching connections:', err);
  }

  console.log(`[StartupSync] Complete: synced=${synced}, failed=${failed}`);
}
