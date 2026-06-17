import express from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import { apiLimiter } from "./middleware/rateLimit";

// Route imports
import authRouter from "./routes/auth";
import gravesRouter from "./routes/graves";
import paymentsRouter from "./routes/payments";
import uploadRouter from "./routes/upload";
import configRouter from "./routes/config";
import pagesRouter from "./routes/pages";

const app = express();
const IS_PROD = process.env.NODE_ENV === "production";

// Trust first proxy (Cloudflare → Caddy → Express) so rate limiting
// uses the real client IP from X-Forwarded-For, not the proxy's IP.
if (IS_PROD) {
  app.set("trust proxy", 1);
}

// Security headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              "https://cdn.paddle.com",
              "https://static.cloudflareinsights.com",
              "https://public.profitwell.com"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.paddle.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: [
              "'self'",
              "data:",
              "https://api.dicebear.com",
              "https://*.googleusercontent.com",
              "https://cdn.paddle.com"
            ],
            connectSrc: [
              "'self'",
              "https://graveit.rip",
              "wss://graveit.rip",
              "https://*.paddle.com",
              "https://cdn.paddle.com",
              "https://cloudflareinsights.com"
            ],
            frameSrc: [
              "'self'",
              "https://checkout.paddle.com",
              "https://sandbox-checkout.paddle.com",
              "https://buy.paddle.com"
            ]
          },
        }
      : false,
  })
);

// Mount API limiter globally on /api/ routes (excluding high-frequency public map coordinate GET requests)
app.use("/api/", (req, res, next) => {
  if (req.method === "GET" && req.originalUrl.split("?")[0] === "/api/graves") {
    return next();
  }
  apiLimiter(req, res, next);
});

// Custom express.json to capture raw body for Paddle signature verification
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      if (req.originalUrl && req.originalUrl.startsWith("/api/webhooks")) {
        req.rawBody = buf;
      }
    },
  })
);

// File uploads directory setup and static routing
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// Mount Routers
app.use("/api/auth", authRouter);
app.use("/api/graves", gravesRouter);
app.use("/api", paymentsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/config", configRouter);
app.use("/", pagesRouter);

// Global error handler middleware to catch unhandled exceptions and prevent leak of internal details
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled Application Error:", err);
  const status = err.status || err.statusCode || 500;
  const message = IS_PROD ? "An unexpected error occurred on the server." : err.message;
  res.status(status).json({
    error: message,
    ...(!IS_PROD ? { stack: err.stack } : {}),
  });
});

export default app;
