import Redis from "ioredis";
import dotenv from "dotenv";
import { pool } from "./index";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("Redis connection established successfully.");
});

redis.on("error", (err) => {
  console.error("Unexpected Redis client error:", err);
});

// Memory caching for graves:version to minimize Redis hits
let cachedVersion: number | null = null;
let lastVersionFetch = 0;
const VERSION_CACHE_TTL = 1000; // 1 second in-memory cache for the map version

/**
 * Gets the current version of the digital cemetery map.
 * Keeps version in Redis and buffers locally for 1s.
 */
export async function getMapVersion(): Promise<number> {
  const now = Date.now();
  if (cachedVersion !== null && now - lastVersionFetch < VERSION_CACHE_TTL) {
    return cachedVersion;
  }

  try {
    const verStr = await redis.get("graves:version");
    if (!verStr) {
      // Initialize if missing
      await redis.set("graves:version", "1");
      cachedVersion = 1;
    } else {
      cachedVersion = parseInt(verStr, 10);
    }
    lastVersionFetch = now;
    return cachedVersion;
  } catch (err) {
    console.error("Redis error getting map version, falling back to 1:", err);
    return 1;
  }
}

/**
 * Increments the map version, invalidating all viewport caches.
 */
export async function incrMapVersion(): Promise<number> {
  try {
    const newVer = await redis.incr("graves:version");
    cachedVersion = newVer;
    lastVersionFetch = Date.now();
    return newVer;
  } catch (err) {
    console.error("Redis error incrementing map version:", err);
    return 1;
  }
}

/**
 * Gets viewport cache for specific coordinates and current map version
 */
export async function getCachedViewport(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): Promise<any[] | null> {
  try {
    const ver = await getMapVersion();
    const key = `graves:viewport:v${ver}:${minX}:${maxX}:${minY}:${maxY}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Redis error reading viewport cache:", err);
  }
  return null;
}

/**
 * Caches viewport results with a short 5-second TTL
 */
export async function setCachedViewport(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  data: any[]
): Promise<void> {
  try {
    const ver = await getMapVersion();
    const key = `graves:viewport:v${ver}:${minX}:${maxX}:${minY}:${maxY}`;
    await redis.setex(key, 5, JSON.stringify(data));
  } catch (err) {
    console.error("Redis error setting viewport cache:", err);
  }
}

/**
 * Checks and locks view increments for a unique visitor (cooldown 10 minutes)
 */
export async function canIncrementViews(
  graveId: number,
  userOrIp: string
): Promise<boolean> {
  const key = `visit:limit:${graveId}:${userOrIp}`;
  try {
    // NX: Set if not exists, EX 600: 10 minutes TTL
    const acquired = await redis.set(key, "1", "EX", 600, "NX");
    return acquired === "OK";
  } catch (err) {
    console.error("Redis error checking visit limit:", err);
    return true; // Fallback to true if Redis fails (favor user experience)
  }
}

/**
 * Increments a views counter in Redis pending hash buffer (Write-Behind)
 */
export async function bufferGraveView(graveId: number): Promise<void> {
  try {
    await redis.hincrby("grave:views:pending", graveId.toString(), 1);
  } catch (err) {
    console.error("Redis error buffering views:", err);
    // Fallback directly to PG if Redis write-behind fails
    try {
      await pool.query("UPDATE graves SET views = views + 1 WHERE id = $1", [graveId]);
    } catch (pgErr) {
      console.error("PostgreSQL fallback direct increment failed:", pgErr);
    }
  }
}

/**
 * Transactionally flushes views collected in Redis to PostgreSQL.
 * Uses atomic rename to ensure no clicks are lost during the operation.
 */
export async function flushGraveViews(): Promise<void> {
  const lockKey = "lock:flush:views";
  let hasLock = false;
  try {
    // Try to acquire distributed lock for 25 seconds
    const lockAcquired = await redis.set(lockKey, "1", "EX", 25, "NX");
    if (lockAcquired !== "OK") {
      return; // Another instance is currently flushing
    }
    hasLock = true;

    const pendingExists = await redis.exists("grave:views:pending");
    if (!pendingExists) return;

    // 1. Atomically rename the key so new incoming clicks write to a fresh pending hash
    await redis.rename("grave:views:pending", "grave:views:processing");

    // 2. Fetch all values from processing hash
    const viewsMap = await redis.hgetall("grave:views:processing");

    // 3. Clear the processing hash
    await redis.del("grave:views:processing");

    const entries = Object.entries(viewsMap);
    if (entries.length === 0) return;

    // 4. Connect to PostgreSQL and update all records inside a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [idStr, countStr] of entries) {
        const id = parseInt(idStr, 10);
        const count = parseInt(countStr, 10);
        if (isNaN(id) || isNaN(count)) continue;

        await client.query(
          "UPDATE graves SET views = COALESCE(views, 0) + $1 WHERE id = $2",
          [count, id]
        );
      }
      await client.query("COMMIT");
      console.log(`[Write-Behind] Flushed ${entries.length} grave view counters to PostgreSQL.`);
    } catch (pgErr) {
      await client.query("ROLLBACK");
      console.error("PostgreSQL transaction failed during views flush, returning views to Redis:", pgErr);
      // Fallback: put them back in the pending hash so we don't lose the counts
      for (const [idStr, countStr] of entries) {
        await redis.hincrby("grave:views:pending", idStr, parseInt(countStr, 10));
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    // If it's just that the key didn't exist during rename (race), it's fine. Otherwise log it.
    if (!err.message.includes("ERR no such key")) {
      console.error("Error executing views flush write-behind:", err);
    }
  } finally {
    if (hasLock) {
      await redis.del(lockKey).catch((delErr) => {
        console.error("Failed to release views flush lock:", delErr);
      });
    }
  }
}

/**
 * Gets a cached user session from Redis
 */
export async function getCachedSession(userId: number): Promise<any | null> {
  try {
    const key = `user:session:${userId}`;
    const data = await redis.get(key);
    if (data) return JSON.parse(data);
  } catch (err) {
    console.error("Redis error reading session cache:", err);
  }
  return null;
}

/**
 * Caches a user session for 5 minutes
 */
export async function setCachedSession(userId: number, user: any): Promise<void> {
  try {
    const key = `user:session:${userId}`;
    await redis.setex(key, 300, JSON.stringify(user));
  } catch (err) {
    console.error("Redis error setting session cache:", err);
  }
}

/**
 * Clears a cached user session (e.g. after profile update or logout)
 */
export async function clearCachedSession(userId: number): Promise<void> {
  try {
    const key = `user:session:${userId}`;
    await redis.del(key);
  } catch (err) {
    console.error("Redis error clearing session cache:", err);
  }
}

// Start the Write-Behind flush interval (every 30 seconds)
let flushInterval: NodeJS.Timeout | null = setInterval(() => {
  flushGraveViews().catch((err) => {
    console.error("Background views flush error:", err);
  });
}, 30000);

/**
 * Clears the background views flush interval.
 */
export function stopViewsFlushScheduler() {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}
