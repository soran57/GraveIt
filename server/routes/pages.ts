import { Router } from "express";
import path from "path";
import { pool } from "../db/index";
import { redis } from "../db/redis";

const router = Router();

// Helper for static document path resolution based on environment
const getDocPath = (filename: string) => {
  const isProd = process.env.NODE_ENV === "production";
  return path.join(process.cwd(), isProd ? "dist" : "public", filename);
};

// 1) GET /health — Health check endpoint
router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const pingResult = await redis.ping();
    res.json({
      status: "ok",
      db: "ok",
      redis: pingResult === "PONG" ? "ok" : "error",
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
    });
  } catch (err: any) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// Standalone Static Document Pages for Merchant of Record Approval (Paddle)
router.get("/terms", (req, res) => {
  res.sendFile(getDocPath("terms.html"));
});

router.get("/privacy", (req, res) => {
  res.sendFile(getDocPath("privacy.html"));
});

router.get("/refund", (req, res) => {
  res.sendFile(getDocPath("refund.html"));
});

router.get("/pricing", (req, res) => {
  res.sendFile(getDocPath("pricing.html"));
});

export default router;
