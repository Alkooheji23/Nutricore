import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { trackUserEvent } from "./analytics";

const FREE_ACCESS_END_DATE = new Date("2026-01-11T00:00:00Z");
const DEMO_END_DATE = new Date("2026-01-11T00:00:00Z");
const VALID_DEMO_CODE = process.env.DEMO_CODE || "NUTRICORE_FOCUS_2025";

export function isFreeAccessPeriod(): boolean {
  return new Date() < FREE_ACCESS_END_DATE;
}

export function getFreeAccessEndDate(): Date {
  return FREE_ACCESS_END_DATE;
}

export function isValidDemoCode(code: string): boolean {
  return code === VALID_DEMO_CODE && new Date() < DEMO_END_DATE;
}

export function getDemoEndDate(): Date {
  return DEMO_END_DATE;
}


const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
      sameSite: "lax", // Use lax for iOS PWA compatibility (none gets purged)
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const userId = claims["sub"];
  
  // Check if user exists before upsert to differentiate signup vs login
  const existingUser = await storage.getUser(userId);
  const isNewUser = !existingUser;
  
  await storage.upsertUser({
    id: userId,
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    subscriptionType: isFreeAccessPeriod() ? "premium" : "trial",
    trialEndsAt: FREE_ACCESS_END_DATE,
  });
  
  // Track auth events
  const subscriptionStatus = isFreeAccessPeriod() ? 'premium' : 'trial';
  if (isNewUser) {
    trackUserEvent('user_signed_up', userId, subscriptionStatus);
  }
  trackUserEvent('user_logged_in', userId, subscriptionStatus);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    if (!claims) {
      return verified(new Error("Authentication failed: no claims available"), undefined);
    }
    
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/chat",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    // Track logout before clearing session
    const user = req.user as any;
    const userId = user?.claims?.sub;
    if (userId) {
      trackUserEvent('user_logged_out', userId);
    }
    
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Debug: Log session and auth state
  const hasSession = !!req.session;
  const hasSessionId = !!(req.session as any)?.id;
  const isAuthd = req.isAuthenticated();
  const hasUser = !!user;
  const hasExpiresAt = !!user?.expires_at;
  
  console.log(`[Auth Debug] Session: ${hasSession}, SessionID: ${hasSessionId}, isAuthenticated: ${isAuthd}, hasUser: ${hasUser}, hasExpiresAt: ${hasExpiresAt}`);

  if (!req.isAuthenticated() || !user?.expires_at) {
    console.log(`[Auth Debug] Failing auth check - isAuthenticated: ${isAuthd}, expires_at: ${user?.expires_at}`);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  // Add 60 second buffer to refresh tokens before they expire
  if (now <= user.expires_at - 60) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Explicitly save the session after token refresh to persist new tokens
    // Wait for save completion before proceeding to avoid losing tokens
    if (req.session) {
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Error saving session after token refresh:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    return next();
  } catch (error: any) {
    // If token refresh fails due to invalid_grant, the refresh token itself is expired/revoked
    // We need to destroy the session and force re-authentication
    if (error?.error === 'invalid_grant') {
      console.error("Refresh token expired or revoked - destroying session and forcing re-login");
      // Destroy the session to force a clean re-authentication
      if (req.session) {
        req.session.destroy((err) => {
          if (err) console.error("Error destroying session:", err);
        });
      }
      res.status(401).json({ 
        message: "Session expired", 
        code: "SESSION_EXPIRED",
        requiresReauth: true 
      });
      return;
    } else {
      console.error("Token refresh failed:", error);
    }
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const requireTermsAccepted: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser?.termsAccepted) {
      return res.status(403).json({ 
        message: "Terms and conditions must be accepted before using this feature",
        code: "TERMS_NOT_ACCEPTED"
      });
    }
    return next();
  } catch (error) {
    console.error("Error checking terms acceptance:", error);
    return res.status(500).json({ message: "Failed to verify terms acceptance" });
  }
};
