import path from "path";
import express from "express";
import app from "./app";
import { initDB, pool } from "./db/index";
import { redis, flushGraveViews, stopViewsFlushScheduler } from "./db/redis";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startServer() {
  // Initialize Database schemas
  await initDB();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`GraveIt Server running elegantly on http://0.0.0.0:${PORT}`);
  });

  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    // Force exit after 10s if shutdown hangs
    const forceExitTimeout = setTimeout(() => {
      console.error("Graceful shutdown timed out. Force exiting.");
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(async () => {
      console.log("HTTP server closed.");

      console.log("Stopping background view count scheduler...");
      stopViewsFlushScheduler();

      console.log("Flushing pending view counts to PostgreSQL...");
      try {
        await flushGraveViews();
        console.log("View counts flushed successfully.");
      } catch (err) {
        console.error("Error flushing views during shutdown:", err);
      }

      console.log("Closing PostgreSQL connection pool...");
      try {
        await pool.end();
        console.log("PostgreSQL connection pool closed.");
      } catch (err) {
        console.error("Error closing PostgreSQL pool:", err);
      }

      console.log("Closing Redis connection...");
      try {
        await redis.quit();
        console.log("Redis connection closed.");
      } catch (err) {
        console.error("Error closing Redis connection:", err);
      }

      console.log("Graceful shutdown completed successfully. Exiting.");
      clearTimeout(forceExitTimeout);
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();
