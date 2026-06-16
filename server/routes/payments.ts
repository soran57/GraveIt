import { Router } from "express";
import crypto from "crypto";
import { pool } from "../db/index";

const router = Router();
const IS_PROD = process.env.NODE_ENV === "production";

// 1) POST /api/webhooks/paddle — Paddle webhook verification and transaction processing
router.post("/webhooks/paddle", async (req: any, res: any) => {
  const signatureHeader = req.headers["paddle-signature"];
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return res.status(400).send("Signature header missing");
  }
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (IS_PROD) {
      console.error("PADDLE_WEBHOOK_SECRET is not set in production.");
      return res.status(500).send("Webhook secret unconfigured");
    }
  }

  // 1. Parse the header (format: ts=TIMESTAMP;h1=SIGNATURE)
  const parts = signatureHeader.split(";");
  const tsPart = parts.find((p) => p.startsWith("ts="));
  const h1Part = parts.find((p) => p.startsWith("h1="));

  if (!tsPart || !h1Part) {
    return res.status(400).send("Invalid signature format");
  }

  const ts = tsPart.split("=")[1];
  const h1 = h1Part.split("=")[1];

  // Replay attack prevention: verify timestamp is within a 5-minute window (300 seconds)
  const timestamp = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
    return res.status(400).send("Timestamp expired or invalid");
  }

  if (webhookSecret) {
    // 2. Concatenate ts:rawBody (using rawBody populated by the custom express.json verify middleware)
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : req.body.toString("utf8");
    const signedData = `${ts}:${rawBody}`;

    // 3. Compute HMAC-SHA256
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedData)
      .digest("hex");

    // 4. Constant-time comparison
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(h1),
        Buffer.from(expectedSignature)
      );
      if (!isValid) {
        return res.status(400).send("Invalid signature");
      }
    } catch (err) {
      return res.status(400).send("Signature verification failed");
    }
  }

  try {
    const rawBodyStr = req.rawBody ? req.rawBody.toString("utf8") : req.body.toString("utf8");
    const payload = JSON.parse(rawBodyStr);
    if (payload.event_type !== "transaction.completed") {
      return res.send("Ignored event type: " + payload.event_type);
    }

    const transaction = payload.data;
    if (transaction.status !== "completed") {
      return res.send("Transaction status not completed: " + transaction.status);
    }

    const transaction_id = transaction.id;

    // Idempotency check: verify if this transaction has already been processed as a payment
    const duplicatePayment = await pool.query(
      "SELECT id FROM payments WHERE transaction_id = $1",
      [transaction_id]
    );
    if (duplicatePayment.rows.length > 0) {
      return res.json({
        status: "success",
        message: "Payment already processed"
      });
    }

    const custom = transaction.custom_data;
    if (!custom) {
      return res.status(400).send("Missing custom_data on transaction");
    }

    const userId = parseInt(custom.user_id, 10);
    const sizeType = custom.size_type as "small" | "medium" | "large";
    const epitaphTitle = custom.epitaph_title;
    const epitaphText = custom.epitaph_text || "";
    const imageUrl = custom.image_url || "";
    const color = custom.color || "#4b4b4b";
    const styleIndex = parseInt(custom.style_index, 10) || 0;

    if (isNaN(userId) || !sizeType || !epitaphTitle) {
      return res.status(400).send("Invalid custom_data parameters");
    }

    const insertQuery = `
      INSERT INTO payments (transaction_id, user_id, size_type, epitaph_title, epitaph_text, image_url, style_index, color, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
      RETURNING id
    `;
    const insertRes = await pool.query(insertQuery, [
      transaction_id,
      userId,
      sizeType,
      epitaphTitle,
      epitaphText,
      imageUrl,
      styleIndex,
      color
    ]);

    res.json({
      status: "success",
      payment_id: insertRes.rows[0].id,
      message: "Payment recorded successfully."
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
    res.status(500).send("Internal server error processing webhook payload");
  }
});

// 2) GET /api/payments/status — Checks if a grave has been processed by transaction ID
router.get("/payments/status", async (req: any, res: any) => {
  const transactionId = req.query.transaction_id;
  if (!transactionId || typeof transactionId !== "string") {
    return res.status(400).json({ error: "Missing transaction_id query parameter." });
  }

  try {
    // First, check if a grave already exists with this transaction ID
    const graveRes = await pool.query(
      "SELECT id FROM graves WHERE transaction_id = $1",
      [transactionId]
    );
    if (graveRes.rows.length > 0) {
      return res.json({ status: "placed", grave_id: graveRes.rows[0].id });
    }

    // Second, check if the payment is recorded in the payments table
    const paymentRes = await pool.query(
      "SELECT id FROM payments WHERE transaction_id = $1 AND status = 'completed'",
      [transactionId]
    );
    if (paymentRes.rows.length > 0) {
      return res.json({ status: "completed" });
    }

    res.json({ status: "pending" });
  } catch (err: any) {
    console.error("Payment status check error:", err.message);
    res.status(500).json({ error: "Failed to query transaction status." });
  }
});

export default router;
