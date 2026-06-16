import { Pool } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("CRITICAL: DATABASE_URL is not set in environment.");
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  // Configure sensible defaults for connection limits
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected database client error in pool:", err);
});

// A standard query helper
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Log queries in debug mode if needed
  if (process.env.DEBUG_DB === "true") {
    console.log(`[Query] executed: ${text.slice(0, 100)}... (Duration: ${duration}ms, Rows: ${res.rowCount})`);
  }
  return res;
}

export async function initDB() {
  let retries = 5;
  while (retries > 0) {
    try {
      // Test connection
      await pool.query("SELECT 1");
      console.log("PostgreSQL connection established successfully.");
      break;
    } catch (err: any) {
      console.warn(`PostgreSQL not ready, retrying in 2 seconds... (${retries} attempts left). Error: ${err.message}`);
      retries -= 1;
      if (retries === 0) {
        console.error("Could not connect to PostgreSQL. Exiting.");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Load and apply schema
  try {
    const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schemaSql);
    console.log("Database schema initialized/verified successfully.");

  } catch (err: any) {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  }
}
