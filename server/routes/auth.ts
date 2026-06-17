import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db/index";
import { redis, getCachedSession, setCachedSession, clearCachedSession } from "../db/redis";
import { parseCookies } from "../middleware/auth";
import { writeLimiter } from "../middleware/rateLimit";

const router = Router();
const IS_PROD = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET!;


// 1) GET /api/auth/me — Retrieve authenticated user with Redis caching support
router.get("/me", async (req: any, res: any) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];

  if (!token) {
    return res.json({ user: null });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const userId = parseInt(decoded.sub, 10);
    if (isNaN(userId)) return res.json({ user: null });

    let user = await getCachedSession(userId);
    if (!user) {
      const dbUserRes = await pool.query(
        "SELECT id, google_id, email, display_name, avatar_url FROM users WHERE id = $1",
        [userId]
      );
      if (dbUserRes.rows.length === 0) return res.json({ user: null });
      user = dbUserRes.rows[0];
      await setCachedSession(userId, user);
    }
    res.json({ user });
  } catch (err) {
    res.json({ user: null });
  }
});

// 2) POST /api/auth/logout — Logs out user by clearing cookie and Redis cache
router.post("/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      const userId = parseInt(decoded.sub, 10);
      if (!isNaN(userId)) {
        await clearCachedSession(userId);
      }
    } catch (err) {}
  }

  res.setHeader(
    "Set-Cookie",
    `graveit_session=; Path=/; HttpOnly; ${IS_PROD ? "Secure; " : ""}SameSite=Lax; Max-Age=0`
  );
  res.json({ status: "success", message: "Logged out eternally." });
});

// 3) GET /api/auth/google/login — Redirects user to Google Consent Screen
router.get("/google/login", async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

  if (!googleClientId) {
    console.error("GOOGLE_CLIENT_ID is not configured. Cannot proceed with Google OAuth.");
    return res.status(500).send("Google OAuth is not configured on this server.");
  }

  // Generate cryptographically random state and store in Redis with 10-minute TTL
  const state = crypto.randomBytes(16).toString("hex");
  await redis.setex(`oauth:state:${state}`, 600, "1");

  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/google/callback`);
  const scope = encodeURIComponent("openid email profile");
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
});

// 4) GET /api/auth/google/callback — Handle Auth Code exchange and JWT cookie setting
router.get("/google/callback", async (req: any, res: any) => {
  const { code, state } = req.query;
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

  // Verify state to prevent CSRF
  if (!state || typeof state !== "string") {
    return res.status(400).send("Security violation: OAuth state parameter is missing.");
  }

  const stateKey = `oauth:state:${state}`;
  const stateValid = await redis.exists(stateKey);
  if (!stateValid) {
    return res.status(400).send("Invalid or expired OAuth state. Please try logging in again.");
  }
  await redis.del(stateKey); // consume the state — one-time use

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    return res.status(500).send("OAuth credentials not configured.");
  }

  try {
    // 1. Fetch access token from Google
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // 2. Fetch User Profile
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileResponse.json();

    // 3. Keep database synchronized and get user ID
    const dbUserRes = await pool.query(
      `INSERT INTO users (google_id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE 
       SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url
       RETURNING id`,
      [
        profileData.id,
        profileData.email,
        profileData.name || "Ethereal Ghost",
        profileData.picture || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profileData.id}`,
      ]
    );
    const dbUser = dbUserRes.rows[0];
    
    // Invalidate Redis session cache
    await clearCachedSession(dbUser.id);

    // 4. Issue custom cookie token valid for 24 hours
    const sessionToken = jwt.sign({ sub: dbUser.id.toString() }, JWT_SECRET, { expiresIn: "24h" });
    res.setHeader(
      "Set-Cookie",
      `graveit_session=${sessionToken}; Path=/; HttpOnly; ${IS_PROD ? "Secure; " : ""}SameSite=Lax; Max-Age=86400`
    );

    res.redirect("/?auth=success");
  } catch (error: any) {
    console.error("Google Auth Flow Failure:", error);
    res.status(500).send(IS_PROD ? "Authentication failed. Please try again." : `OAuth Handshake Failure: ${error.message}`);
  }
});

// 5) POST /api/auth/anonymous — Creates an anonymous user session with a caretaker name
router.post("/anonymous", writeLimiter, async (req: any, res: any) => {
  const { display_name } = req.body;
  const name = (display_name && display_name.trim()) ? display_name.trim() : "Ethereal Ghost";

  if (name.length > 50) {
    return res.status(400).json({ error: "Caretaker name cannot exceed 50 characters." });
  }

  // Generate cryptographically random IDs to satisfy NOT NULL constraints in DB
  const anonId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const googleId = `anon_${anonId}`;
  const email = `${googleId}@graveit.rip`;
  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name)}`;

  try {
    const dbUserRes = await pool.query(
      `INSERT INTO users (google_id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [googleId, email, name, avatarUrl]
    );
    const dbUser = dbUserRes.rows[0];

    const sessionToken = jwt.sign({ sub: dbUser.id.toString() }, JWT_SECRET, { expiresIn: "24h" });
    res.setHeader(
      "Set-Cookie",
      `graveit_session=${sessionToken}; Path=/; HttpOnly; ${IS_PROD ? "Secure; " : ""}SameSite=Lax; Max-Age=86400`
    );

    res.json({
      id: dbUser.id,
      google_id: googleId,
      email: email,
      display_name: name,
      avatar_url: avatarUrl
    });
  } catch (error: any) {
    console.error("Anonymous user creation failure:", error);
    res.status(500).json({ error: "Failed to create anonymous keeper session." });
  }
});

export default router;

