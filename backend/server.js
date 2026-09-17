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

// Rate-limit payment-initiating endpoints against traffic spikes / abuse.
const paymentLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use("/api/payments", paymentLimiter);

// Rate-limit admin login against brute-forcing.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use("/api/admin/login", loginLimiter);

app.use("/api", apiRoutes);

// Runs every 5 minutes: flips sales to "closed" once the window has
// passed. This only changes a status flag — orders, payments, and
// tickets are never deleted, so refunds/reconciliation stay possible.
cron.schedule("*/5 * * * *", async () => {
  const [[settings]] = await pool.query(
    `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
  );
  if (settings && settings.status === "open" && new Date() > new Date(settings.sales_close_at)) {
    await pool.query(`UPDATE event_settings SET status = 'closed' WHERE id = ?`, [settings.id]);
    console.log(`[cron] Sales closed for event_settings id=${settings.id}`);
  }
});

// Also expire stale ticket reservations so inventory frees up.
cron.schedule("* * * * *", async () => {
  const [expired] = await pool.query(
    `SELECT * FROM orders WHERE status = 'reserved' AND reserved_until < NOW()`
  );
  for (const order of expired) {
    await pool.query(`UPDATE orders SET status = 'expired' WHERE id = ?`, [order.id]);
    await pool.query(
      `UPDATE ticket_types SET reserved_quantity = reserved_quantity - ? WHERE id = ?`,
      [order.quantity, order.ticket_type_id]
    );
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
