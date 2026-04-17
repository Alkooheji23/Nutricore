import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
      sameSite: "none", // Required for mobile browser app switching
    },
  });
}

interface FirebaseUserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

async function upsertFirebaseUser(userData: FirebaseUserData) {
  const { uid, email, displayName, photoURL } = userData;
  
  const existingUser = await storage.getUser(uid);
  
  const nameParts = displayName?.split(' ') || [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(' ') || null;
  
  if (existingUser) {
    await storage.updateUserProfile(uid, {
      email: email,
      firstName: existingUser.firstName || firstName,
      lastName: existingUser.lastName || lastName,
      profileImageUrl: existingUser.profileImageUrl || photoURL || null,
    });
  } else {
    await storage.upsertUser({
      id: uid,
      email: email || '',
      firstName,
      lastName,
      profileImageUrl: photoURL || null,
      subscriptionType: isFreeAccessPeriod() ? "premium" : "trial",
      trialEndsAt: FREE_ACCESS_END_DATE,
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/firebase", async (req, res) => {
    console.log("[Firebase Auth] Received auth request:", req.body?.email);
    try {
      const { uid, email, displayName, photoURL } = req.body;
      
      if (!uid || !email) {
        console.log("[Firebase Auth] Missing uid or email");
        return res.status(400).json({ message: "User ID and email required" });
      }
      
      console.log("[Firebase Auth] Upserting user:", email);
      await upsertFirebaseUser({ uid, email, displayName, photoURL });
      
      (req.session as any).user = {
        id: uid,
        email: email,
        claims: {
          sub: uid,
          email: email,
          name: displayName,
          picture: photoURL,
        }
      };
      
      console.log("[Firebase Auth] Saving session for:", email);
      req.session.save((err) => {
        if (err) {
          console.error("[Firebase Auth] Session save error:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        console.log("[Firebase Auth] Session saved successfully for:", email);
        res.json({ success: true, userId: uid });
      });
    } catch (error: any) {
      console.error("[Firebase Auth] Error:", error);
      res.status(500).json({ message: "Authentication failed", error: error.message });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const sessionUser = (req.session as any)?.user;
  
  if (!sessionUser?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  (req as any).user = {
    claims: sessionUser.claims
  };
  
  return next();
};

export const requireTermsAccepted: RequestHandler = async (req, res, next) => {
  const sessionUser = (req.session as any)?.user;
  
  if (!sessionUser?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const dbUser = await storage.getUser(sessionUser.id);
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
