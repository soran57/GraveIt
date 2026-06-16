import { Router } from "express";
import express from "express";
import { uploadLimiter } from "../middleware/rateLimit";
import { authenticateJWT_upload } from "../middleware/auth";
import { storageProvider } from "../db/storage";

const router = Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Helper to inspect magic bytes of the image buffer
function verifyImageSignature(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // WEBP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

// 1) POST /api/upload — Secure file upload endpoint with magic byte validation
router.post("/", uploadLimiter, authenticateJWT_upload, express.raw({ type: ALLOWED_TYPES, limit: "5mb" }), async (req: any, res: any) => {
  const contentType = req.headers["content-type"];
  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WEBP" });
  }

  const body = req.body;
  if (!body || !body.length) {
    return res.status(400).json({ error: "No file data received" });
  }

  if (body.length > MAX_FILE_SIZE) {
    return res.status(400).json({ error: "File too large. Maximum 5MB allowed." });
  }

  // Inspect the file buffer to verify magic bytes
  const detectedMime = verifyImageSignature(body);
  if (!detectedMime) {
    return res.status(400).json({ error: "Invalid file signature. File is not a valid image." });
  }

  // Ensure Content-Type matches the magic bytes
  const isJpegMatch = contentType === "image/jpeg" && detectedMime === "image/jpeg";
  const isNormalMatch = contentType === detectedMime;
  if (!isNormalMatch && !isJpegMatch) {
    return res.status(400).json({ error: "Content-Type header does not match file signature." });
  }

  const ext = detectedMime.split("/")[1] === "jpeg" ? "jpg" : detectedMime.split("/")[1];
  const filename = `grave_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const fileUrl = await storageProvider.uploadFile(body, contentType, filename);
    res.json({
      status: "success",
      url: fileUrl,
      filename,
    });
  } catch (err: any) {
    console.error("Image upload failed:", err.message);
    res.status(500).json({ error: "Failed to upload image file." });
  }
});

export default router;
