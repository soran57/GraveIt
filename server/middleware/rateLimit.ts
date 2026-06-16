import rateLimit from "express-rate-limit";

const IS_PROD = process.env.NODE_ENV === "production";

// General API Rate Limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PROD ? 200 : 100000, // Relax in dev mode
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down, Caretaker." },
});

// Stricter limiter for write/upload operations
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 30 : 10000, // Relax in dev mode
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before trying again." },
});

// Upload-specific limiter — 20 uploads per hour per IP
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached. Try again in an hour." },
});
