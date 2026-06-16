import jwt from "jsonwebtoken";
import { pool } from "../db/index";
import { getCachedSession, setCachedSession } from "../db/redis";

const JWT_SECRET = process.env.JWT_SECRET!;

// Helper to parse cookies easily
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    list[parts.shift()!.trim()] = decodeURI(parts.join("="));
  });
  return list;
}

// Interfaces matching database structures
export interface User {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at?: string;
}

// Auth Context Authentication Middleware using Redis & PostgreSQL
export async function authenticateJWT(req: any, res: any, next: any) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Missing session token cookie" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const userId = parseInt(decoded.sub, 10);
    if (isNaN(userId)) {
      return res.status(401).json({ error: "Unauthorized: Invalid session payload" });
    }

    // Attempt cache read
    let user = await getCachedSession(userId);
    if (!user) {
      // Query PostgreSQL pool
      const dbUserRes = await pool.query(
        "SELECT id, google_id, email, display_name, avatar_url FROM users WHERE id = $1",
        [userId]
      );
      if (dbUserRes.rows.length === 0) {
        return res.status(401).json({ error: "Unauthorized: User record missing" });
      }
      user = dbUserRes.rows[0];
      // Save session in cache for 5 minutes
      await setCachedSession(userId, user);
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session cookie" });
  }
}

// Lightweight auth check for upload (doesn't attach to req.user but validates token)
export function authenticateJWT_upload(req: any, res: any, next: any) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Login required to upload" });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid session" });
  }
}
