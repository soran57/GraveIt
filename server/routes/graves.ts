import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/index";
import { 
  getCachedViewport, 
  setCachedViewport, 
  incrMapVersion, 
  bufferGraveView, 
  redis,
  canIncrementViews
} from "../db/redis";
import { authenticateJWT, parseCookies } from "../middleware/auth";
import { writeLimiter } from "../middleware/rateLimit";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// Helper function to check if a grid spot is vacant
async function isSpotVacant(x: number, y: number, width: number, height: number): Promise<boolean> {
  const checkQuery = `
    SELECT 1 FROM graves 
    WHERE 
      x_coord < $1 AND ($2 < x_coord + width) AND 
      y_coord < $3 AND ($4 < y_coord + height)
    LIMIT 1
  `;
  const res = await pool.query(checkQuery, [
    x + width,
    x,
    y + height,
    y
  ]);
  return res.rows.length === 0;
}

// 1) GET /api/graves — Fetches graves inside viewport with Redis caching
router.get("/", async (req, res) => {
  const minX = parseInt(req.query.min_x as string, 10);
  const maxX = parseInt(req.query.max_x as string, 10);
  const minY = parseInt(req.query.min_y as string, 10);
  const maxY = parseInt(req.query.max_y as string, 10);

  // Resolve user identity if logged in to inject has_flowered state
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];
  let userId: number | null = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      userId = parseInt(decoded.sub, 10);
    } catch (err) {}
  }

  const getUserLikes = async () => {
    if (userId && !isNaN(userId)) {
      try {
        const likesRes = await pool.query("SELECT grave_id FROM grave_flowers WHERE user_id = $1", [userId]);
        return likesRes.rows.map((r: any) => r.grave_id);
      } catch (err) {
        console.error("Error fetching user likes:", err);
      }
    }
    return [];
  };

  if (isNaN(minX) || isNaN(maxX) || isNaN(minY) || isNaN(maxY)) {
    // Return all plots for stability when coordinates are missing
    try {
      const allGravesRes = await pool.query(`
        SELECT g.id, g.user_id, u.display_name AS owner_name, u.avatar_url, 
               g.x_coord, g.y_coord, g.size_type, g.width, g.height, 
               g.epitaph_title, g.epitaph_text, g.image_url, g.style_index, 
               g.created_at, g.color, g.views,
               (SELECT COUNT(*)::int FROM grave_flowers WHERE grave_id = g.id) AS flowers
        FROM graves g
        INNER JOIN users u ON g.user_id = u.id
        ORDER BY g.created_at DESC
      `);
      const userLikedGraveIds = await getUserLikes();
      const graves = allGravesRes.rows.map((g: any) => ({
        ...g,
        has_flowered: userLikedGraveIds.includes(g.id),
      }));
      return res.json(graves);
    } catch (err: any) {
      console.error("Database query failed:", err.message);
      return res.status(500).json({ error: "Failed to fetch graves database records." });
    }
  }

  try {
    // Try viewport cache in Redis
    const cached = await getCachedViewport(minX, maxX, minY, maxY);
    if (cached !== null) {
      const userLikedGraveIds = await getUserLikes();
      const graves = cached.map((g: any) => ({
        ...g,
        has_flowered: userLikedGraveIds.includes(g.id),
      }));
      return res.json(graves);
    }

    // Query Postgres leveraging compounds indexing on coordinates
    const queryText = `
      SELECT g.id, g.user_id, u.display_name AS owner_name, u.avatar_url, 
             g.x_coord, g.y_coord, g.size_type, g.width, g.height, 
             g.epitaph_title, g.epitaph_text, g.image_url, g.style_index, 
             g.created_at, g.color, g.views,
             (SELECT COUNT(*)::int FROM grave_flowers WHERE grave_id = g.id) AS flowers
      FROM graves g
      INNER JOIN users u ON g.user_id = u.id
      WHERE 
        g.x_coord + g.width > $1 AND g.x_coord < $2 AND
        g.y_coord + g.height > $3 AND g.y_coord < $4
      LIMIT 500
    `;
    const result = await pool.query(queryText, [minX, maxX, minY, maxY]);

    // Save result to Redis cache (expires in 5 seconds)
    await setCachedViewport(minX, maxX, minY, maxY, result.rows);

    const userLikedGraveIds = await getUserLikes();
    const graves = result.rows.map((g: any) => ({
      ...g,
      has_flowered: userLikedGraveIds.includes(g.id),
    }));
    res.json(graves);
  } catch (err: any) {
    console.error("Viewport graves fetch error:", err.message);
    res.status(500).json({ error: "Cemetery grid coordinate query failed." });
  }
});

// 2) POST /api/graves/confirm — Staking a grave after coordinates validation in SERIALIZABLE transaction
router.post("/confirm", writeLimiter, authenticateJWT, async (req: any, res: any) => {
  const { x_coord, y_coord, transaction_id } = req.body;
  const user = req.user;

  if (x_coord === undefined || y_coord === undefined) {
    return res.status(400).json({ error: "Missing grid coordinates." });
  }

  const paddleToken = process.env.PADDLE_CLIENT_TOKEN;
  let final_size_type = req.body.size_type;
  let final_epitaph_title = req.body.epitaph_title;
  let final_epitaph_text = req.body.epitaph_text || "";
  let final_image_url = req.body.image_url || "";
  let final_style_index = req.body.style_index !== undefined ? req.body.style_index : 0;
  let final_color = req.body.color || "#4b4b4b";

  const client = await pool.connect();
  try {
    // Start serializable transaction to prevent race conditions during overlap checks
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // If Paddle is configured, transaction_id is STRICTLY required and must be verified
    if (paddleToken) {
      if (!transaction_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Payment transaction ID is required." });
      }

      // Check if this transaction_id is already used for another grave
      const duplicateGrave = await client.query(
        "SELECT id FROM graves WHERE transaction_id = $1",
        [transaction_id]
      );
      if (duplicateGrave.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This payment has already been used to place a grave." });
      }

      // Fetch payment record
      const paymentRes = await client.query(
        "SELECT user_id, size_type, epitaph_title, epitaph_text, image_url, style_index, color FROM payments WHERE transaction_id = $1 AND status = 'completed'",
        [transaction_id]
      );
      if (paymentRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Valid, completed payment transaction not found." });
      }

      const payment = paymentRes.rows[0];
      if (payment.user_id !== user.id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Unauthorized transaction owner." });
      }

      // Use details from the paid transaction
      final_size_type = payment.size_type;
      final_epitaph_title = payment.epitaph_title;
      final_epitaph_text = payment.epitaph_text || "";
      final_image_url = payment.image_url || "";
      final_style_index = payment.style_index !== undefined ? payment.style_index : 0;
      final_color = payment.color || "#4b4b4b";
    } else {
      // Fallback: Paddle not configured. Allow manual creation, but check params
      if (!final_size_type || !final_epitaph_title) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Missing required core parameters for manual grave stake." });
      }
    }

    // Enforce limits on text fields to prevent abuse/errors
    if (final_epitaph_title && final_epitaph_title.length > 50) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Epitaph name cannot exceed 50 characters." });
    }
    if (final_epitaph_text && final_epitaph_text.length > 1000) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Inscription cannot exceed 1000 characters." });
    }
    if (final_image_url && final_image_url.length > 1024) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Image URL cannot exceed 1024 characters." });
    }
    if (final_color && final_color.length > 7) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Color hex cannot exceed 7 characters." });
    }

    let width = 1;
    let height = 1;

    switch (final_size_type) {
      case "small":
        width = 1;
        height = 1;
        break;
      case "medium":
        width = 2;
        height = 2;
        break;
      case "large":
        width = 3;
        height = 3;
        break;
      default:
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid grave size category." });
    }

    // Anti-overlap algorithm matching AABB intersection (A overlaps with B)
    const checkQuery = `
      SELECT id FROM graves 
      WHERE 
        x_coord < $1 AND ($2 < x_coord + width) AND 
        y_coord < $3 AND ($4 < y_coord + height)
      FOR UPDATE
    `;
    
    const overlapsRes = await client.query(checkQuery, [
      x_coord + width,
      x_coord,
      y_coord + height,
      y_coord
    ]);

    if (overlapsRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Coordinate Placement overlap detected! This cemetery plot is already claimed.",
      });
    }

    // Safe to insert the new grave record
    const insertQuery = `
      INSERT INTO graves (user_id, x_coord, y_coord, size_type, width, height, epitaph_title, epitaph_text, image_url, style_index, color, views, transaction_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12)
      RETURNING id
    `;
    const insertRes = await client.query(insertQuery, [
      user.id,
      x_coord,
      y_coord,
      final_size_type,
      width,
      height,
      final_epitaph_title,
      final_epitaph_text,
      final_image_url,
      final_style_index,
      final_color,
      transaction_id || null
    ]);

    await client.query("COMMIT");

    // Invalidate viewport caches globally by incrementing map version
    await incrMapVersion();

    res.status(201).json({
      status: "success",
      grave_id: insertRes.rows[0].id,
      message: "Grave eternally staked on GraveIt Cemetery grid.",
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Grave confirm transaction failed:", err.message);
    res.status(500).json({ error: "Database transaction block failed." });
  } finally {
    client.release();
  }
});

// 3) GET /api/graves/mine — Returns ALL graves owned by the authenticated user
// Note: This must be mounted BEFORE any /:id paths to prevent conflicts!
router.get("/mine", authenticateJWT, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT g.id, g.user_id, u.display_name AS owner_name, u.avatar_url,
              g.x_coord, g.y_coord, g.size_type, g.width, g.height,
              g.epitaph_title, g.epitaph_text, g.image_url, g.style_index,
              g.created_at, g.color, g.views,
              (SELECT COUNT(*)::int FROM grave_flowers WHERE grave_id = g.id) AS flowers
       FROM graves g
       INNER JOIN users u ON g.user_id = u.id
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    const userLikedGraveIds = (await pool.query("SELECT grave_id FROM grave_flowers WHERE user_id = $1", [req.user.id])).rows.map((r: any) => r.grave_id);
    const results = result.rows.map((g: any) => ({
      ...g,
      has_flowered: userLikedGraveIds.includes(g.id),
    }));
    res.json(results);
  } catch (err: any) {
    console.error("Failed to fetch user graves:", err.message);
    res.status(500).json({ error: "Failed to fetch your cemetery plots." });
  }
});

// 4) GET /api/graves/:id — Fetches details of a single grave and its flower status
router.get("/:id", async (req: any, res: any) => {
  const graveId = parseInt(req.params.id, 10);
  if (isNaN(graveId)) {
    return res.status(400).json({ error: "Invalid grave ID" });
  }
  try {
    const result = await pool.query(
      `SELECT g.id, g.user_id, u.display_name AS owner_name, u.avatar_url,
              g.x_coord, g.y_coord, g.size_type, g.width, g.height,
              g.epitaph_title, g.epitaph_text, g.image_url, g.style_index,
              g.created_at, g.color, g.views,
              (SELECT COUNT(*)::int FROM grave_flowers WHERE grave_id = g.id) AS flowers
       FROM graves g
       INNER JOIN users u ON g.user_id = u.id
       WHERE g.id = $1`,
      [graveId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Grave not found" });
    }

    const grave = result.rows[0];

    // Determine if flowered by current user
    let hasFlowered = false;
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["graveit_session"];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
        const userId = parseInt(decoded.sub, 10);
        if (!isNaN(userId)) {
          const checkLike = await pool.query(
            "SELECT 1 FROM grave_flowers WHERE grave_id = $1 AND user_id = $2",
            [graveId, userId]
          );
          hasFlowered = checkLike.rows.length > 0;
        }
      } catch (err) {}
    }

    res.json({ ...grave, has_flowered: hasFlowered });
  } catch (err: any) {
    console.error("Failed to fetch grave by ID:", err.message);
    res.status(500).json({ error: "Failed to retrieve grave details." });
  }
});

// 5) POST /api/graves/:id/visit — Increments visit views with rate limiting and Redis write-behind
router.post("/:id/visit", async (req: any, res: any) => {
  const graveId = parseInt(req.params.id, 10);
  if (isNaN(graveId)) {
    return res.status(400).json({ error: "Invalid grave ID" });
  }

  // Resolve visitor identity (Use user sub if session cookie exists, else client IP)
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["graveit_session"];
  let visitorId = req.ip || "anonymous";
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      visitorId = `user_${decoded.sub}`;
    } catch (err) {}
  }

  try {
    // Check rate limit (10-minute cooldown per visitor per grave)
    const allowed = await canIncrementViews(graveId, visitorId);
    if (allowed) {
      await bufferGraveView(graveId);
    }

    // Get current database views count
    const dbRes = await pool.query("SELECT views FROM graves WHERE id = $1", [graveId]);
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: "Grave not found" });
    }

    // Add any pending Redis views to the returned views count so client gets immediate feedback
    const pendingCountStr = await redis.hget("grave:views:pending", graveId.toString());
    const pendingCount = pendingCountStr ? parseInt(pendingCountStr, 10) : 0;
    const totalViews = (dbRes.rows[0].views || 0) + pendingCount;

    res.json({
      status: "success",
      id: graveId,
      views: totalViews,
    });
  } catch (err: any) {
    console.error("Grave visit counter error:", err.message);
    res.status(500).json({ error: "Failed to increment grave visit views." });
  }
});

// 6) POST /api/graves/:id/flower — Toggles flower status on a grave
router.post("/:id/flower", writeLimiter, authenticateJWT, async (req: any, res: any) => {
  const graveId = parseInt(req.params.id, 10);
  if (isNaN(graveId)) {
    return res.status(400).json({ error: "Invalid grave ID" });
  }
  const user = req.user;

  // Prevent anonymous accounts from laying flowers to avoid bot abuse.
  // Returning 401 forces the frontend to open the Google Sign-In modal.
  if (user.google_id && user.google_id.startsWith("anon_")) {
    return res.status(401).json({ error: "Only Google-verified keepers can lay flowers." });
  }

  try {
    const graveCheck = await pool.query("SELECT id FROM graves WHERE id = $1", [graveId]);

    if (graveCheck.rows.length === 0) {
      return res.status(404).json({ error: "Grave not found" });
    }

    const checkFlower = await pool.query(
      "SELECT 1 FROM grave_flowers WHERE grave_id = $1 AND user_id = $2",
      [graveId, user.id]
    );

    let flowered = false;
    if (checkFlower.rows.length > 0) {
      await pool.query(
        "DELETE FROM grave_flowers WHERE grave_id = $1 AND user_id = $2",
        [graveId, user.id]
      );
      flowered = false;
    } else {
      await pool.query(
        "INSERT INTO grave_flowers (grave_id, user_id) VALUES ($1, $2)",
        [graveId, user.id]
      );
      flowered = true;
    }

    // Invalidate viewport caches globally
    await incrMapVersion();

    const countRes = await pool.query(
      "SELECT (SELECT COUNT(*)::int FROM grave_flowers WHERE grave_id = $1) AS flowers",
      [graveId]
    );
    const totalFlowers = countRes.rows[0].flowers || 0;

    res.json({
      status: "success",
      id: graveId,
      has_flowered: flowered,
      flowers: totalFlowers,
    });
  } catch (err: any) {
    console.error("Grave flower toggle error:", err.message);
    res.status(500).json({ error: "Failed to toggle flower on grave." });
  }
});

// 7) DELETE /api/graves/:id — Permanently removes a grave owned by the authenticated user
router.delete("/:id", authenticateJWT, async (req: any, res: any) => {
  const graveId = parseInt(req.params.id, 10);
  if (isNaN(graveId)) {
    return res.status(400).json({ error: "Invalid grave ID." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM graves WHERE id = $1 AND user_id = $2 RETURNING id, epitaph_title",
      [graveId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Grave not found or you are not its keeper." });
    }

    // Invalidate viewport caches so the removed grave disappears from the map
    await incrMapVersion();

    res.json({
      status: "success",
      message: `Plot #${result.rows[0].id} (${result.rows[0].epitaph_title}) has been released to the void.`,
    });
  } catch (err: any) {
    console.error("Grave deletion failed:", err.message);
    res.status(500).json({ error: "Failed to release grave plot." });
  }
});

export default router;
