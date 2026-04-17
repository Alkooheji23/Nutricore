import cron, { ScheduledTask } from 'node-cron';
import { storage } from './storage';
import { refreshAccessToken as refreshGarminToken } from './garmin';
import { refreshAccessToken as refreshFitbitToken } from './fitbit';

let cronJob: ScheduledTask | null = null;

async function refreshTokensForAllConnections() {
  console.log('[TokenRefresh] Starting proactive token refresh...');
  
  try {
    const connections = await storage.getAllActiveSmartwatchConnections();
    console.log(`[TokenRefresh] Found ${connections.length} active connections`);
    
    let refreshed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const connection of connections) {
      try {
        if (!connection.refreshToken) {
          console.log(`[TokenRefresh] No refresh token for ${connection.provider} connection ${connection.id}, skipping`);
          skipped++;
          continue;
        }
        
        const now = new Date();
        const tokenExpiry = connection.tokenExpiresAt;
        
        const shouldRefresh = !tokenExpiry || 
          (tokenExpiry.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;
        
        if (!shouldRefresh) {
          console.log(`[TokenRefresh] Token for ${connection.provider} connection ${connection.id} still valid, skipping`);
          skipped++;
          continue;
        }
        
        console.log(`[TokenRefresh] Refreshing token for ${connection.provider} connection ${connection.id}`);
        
        if (connection.provider === 'garmin') {
          const newTokens = await refreshGarminToken(connection.refreshToken);
          await storage.updateSmartwatchConnection(connection.id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
            lastSyncAt: new Date(),
          });
          refreshed++;
          console.log(`[TokenRefresh] Successfully refreshed Garmin token for connection ${connection.id}`);
        } else if (connection.provider === 'fitbit') {
          const newTokens = await refreshFitbitToken(connection.refreshToken);
          await storage.updateSmartwatchConnection(connection.id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
            lastSyncAt: new Date(),
          });
          refreshed++;
          console.log(`[TokenRefresh] Successfully refreshed Fitbit token for connection ${connection.id}`);
        } else {
          console.log(`[TokenRefresh] Unknown provider ${connection.provider}, skipping`);
          skipped++;
        }
      } catch (error: any) {
        console.error(`[TokenRefresh] Failed to refresh token for ${connection.provider} connection ${connection.id}:`, error.message);
        failed++;
        
        if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been revoked')) {
          console.log(`[TokenRefresh] Token revoked for connection ${connection.id}, marking as inactive`);
          await storage.updateSmartwatchConnection(connection.id, { isActive: false });
        }
      }
    }
    
    console.log(`[TokenRefresh] Complete: refreshed=${refreshed}, skipped=${skipped}, failed=${failed}`);
  } catch (error) {
    console.error('[TokenRefresh] Error during token refresh job:', error);
  }
}

export async function startTokenRefreshScheduler() {
  if (cronJob) {
    console.log('[TokenRefresh] Already running, skipping duplicate start');
    return;
  }

  console.log('[TokenRefresh] Starting token refresh scheduler');

  cronJob = cron.schedule('0 4 * * *', async () => {
    console.log('[TokenRefresh] Daily token refresh job starting (4:00 AM UTC)');
    await refreshTokensForAllConnections();
  }, {
    timezone: 'UTC'
  });

  console.log('[TokenRefresh] Scheduled for daily at 04:00 UTC');
}

export function stopTokenRefreshScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[TokenRefresh] Stopped');
  }
}

export async function triggerTokenRefreshManually() {
  console.log('[TokenRefresh] Manual token refresh triggered');
  await refreshTokensForAllConnections();
}
