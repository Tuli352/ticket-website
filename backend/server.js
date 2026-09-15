import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import cron from "node-cron";
import { pool } from "./config/db.js";
import apiRoutes from "./routes/api.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const paymentLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use("/api/payments", paymentLimiter);

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "neyo-tickets-api", database: "postgresql" });
});

app.use("/api", apiRoutes);

// Runs every 5 minutes: close sales after the event window.
cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
    );
    const settings = result.rows[0];
    if (settings && settings.status === "open" && new Date() > new Date(settings.sales_close_at)) {
      await pool.query(`UPDATE event_settings SET status = 'closed' WHERE id = $1`, [settings.id]);
      console.log(`[cron] Sales closed for event_settings id=${settings.id}`);
    }
  } catch (err) {
    console.error("[cron] Sales-close job failed:", err);
  }
});

// Expire stale ticket reservations so inventory is released.
cron.schedule("* * * * *", async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM orders WHERE status = 'reserved' AND reserved_until < NOW()`
    );
    for (const order of result.rows) {
      await pool.query(`UPDATE orders SET status = 'expired' WHERE id = $1`, [order.id]);
      await pool.query(
        `UPDATE ticket_types SET reserved_quantity = reserved_quantity - $1 WHERE id = $2`,
        [order.quantity, order.ticket_type_id]
      );
    }
  } catch (err) {
    console.error("[cron] Reservation-expiry job failed:", err);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
