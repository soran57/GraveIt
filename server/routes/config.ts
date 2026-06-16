import { Router } from "express";

const router = Router();

// 1) GET /api/config — Config endpoint to share Paddle config with frontend safely
router.get("/", (req: any, res: any) => {
  res.json({
    paddleClientToken: process.env.PADDLE_CLIENT_TOKEN || null,
    paddlePrices: {
      small: process.env.PADDLE_PRICE_SMALL || null,
      medium: process.env.PADDLE_PRICE_MEDIUM || null,
      large: process.env.PADDLE_PRICE_LARGE || null,
    }
  });
});

export default router;
