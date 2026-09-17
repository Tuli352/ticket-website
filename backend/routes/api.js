import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../config/db.js";
import { stkPush, parseCallback } from "../services/mpesa.js";
import { createPayment, markPaymentResult, getOrderStatus } from "../services/payments.js";
import { verifyAdmin, issueToken, requireAdmin } from "../services/auth.js";

const router = express.Router();
const RESERVATION_MINUTES = 10;

async function requireSalesOpen(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
    );
    const settings = result.rows[0];
    if (!settings || new Date() > new Date(settings.sales_close_at) || settings.status === "closed") {
      return res.status(410).json({ error: "Sales are closed." });
    }
    next();
  } catch (err) {
    console.error("Sales-window check failed:", err);
    res.status(500).json({ error: "Could not verify sales status." });
  }
}

router.get("/event", async (req, res) => {
  try {
    const settingsResult = await pool.query(
      `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
    );
    const typesResult = await pool.query(
      `SELECT id, name, price, (total_quantity - sold_quantity - reserved_quantity) AS available
       FROM ticket_types`
    );
    res.json({ settings: settingsResult.rows[0] || null, ticketTypes: typesResult.rows });
  } catch (err) {
    console.error("GET /event failed:", err);
    res.status(500).json({ error: "Could not load event." });
  }
});

router.post("/orders", requireSalesOpen, async (req, res) => {
  const { name, phone, email, ticketTypeId, quantity } = req.body;
  if (!name || !phone || !email || !ticketTypeId || !quantity) {
    return res.status(400).json({ error: "Missing fields." });
  }

  const qty = Number(quantity);
  const typeId = Number(ticketTypeId);
  if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(typeId) || typeId < 1) {
    return res.status(400).json({ error: "Invalid ticket type or quantity." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const typeResult = await client.query(
      `SELECT * FROM ticket_types WHERE id = $1 FOR UPDATE`,
      [typeId]
    );
    const type = typeResult.rows[0];
    if (!type) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Ticket type not found." });
    }

    const available = type.total_quantity - type.sold_quantity - type.reserved_quantity;
    if (available < qty) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Not enough tickets available." });
    }

    const orderId = randomUUID();
    const total = Number(type.price) * qty;
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    await client.query(
      `INSERT INTO orders (id, customer_name, customer_phone, customer_email,
        ticket_type_id, quantity, unit_price, total_amount, status, reserved_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'reserved', $9)`,
      [orderId, name, phone, email, typeId, qty, type.price, total, reservedUntil]
    );
    await client.query(
      `UPDATE ticket_types SET reserved_quantity = reserved_quantity + $1 WHERE id = $2`,
      [qty, typeId]
    );

    await client.query("COMMIT");
    res.json({ orderId, totalAmount: total, reservedUntil });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /orders failed:", err);
    res.status(500).json({ error: "Could not create order." });
  } finally {
    client.release();
  }
});

router.post("/payments/mpesa", requireSalesOpen, async (req, res) => {
  const { orderId, phone } = req.body;
  const order = await getOrderStatus(orderId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  try {
    const stk = await stkPush({ phone, amount: order.total_amount, orderId });
    await createPayment({
      orderId,
      method: "mpesa",
      amount: order.total_amount,
      checkoutRequestId: stk.CheckoutRequestID,
    });
    await pool.query(`UPDATE orders SET status = 'pending_payment' WHERE id = $1`, [orderId]);
    res.json({ checkoutRequestId: stk.CheckoutRequestID });
  } catch (err) {
    console.error("M-Pesa payment failed:", err);
    res.status(502).json({ error: "STK push failed. Try again or use another payment method." });
  }
});

router.post("/mpesa/callback", async (req, res) => {
  try {
    const result = parseCallback(req.body);
    if (result) {
      await markPaymentResult({
        checkoutRequestId: result.checkoutRequestId,
        success: result.success,
        providerReference: result.mpesaReceiptNumber || null,
        rawCallback: req.body,
      });
    }
  } catch (err) {
    console.error("M-Pesa callback processing failed:", err);
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.get("/payments/order/:orderId/status", async (req, res) => {
  const order = await getOrderStatus(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found." });
  res.json({ status: order.status });
});

router.post("/payments/card", requireSalesOpen, async (req, res) => {
  const { orderId } = req.body;
  const order = await getOrderStatus(orderId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const paymentId = await createPayment({
    orderId,
    method: "card",
    amount: order.total_amount,
  });
  res.json({ paymentId, message: "Wire this to your card processor's checkout session." });
});

router.post("/payments/bank", requireSalesOpen, async (req, res) => {
  const { orderId } = req.body;
  const order = await getOrderStatus(orderId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  await createPayment({ orderId, method: "bank", amount: order.total_amount });
  res.json({
    accountName: "Your Registered Business Name",
    accountNumber: "0000000000",
    bankName: "Your Bank",
    reference: orderId,
    amount: order.total_amount,
    note: "Payment is matched manually or via your aggregator's PesaLink webhook.",
  });
});

router.get("/tickets/:orderId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ticket_code, qr_data, issued_at, checked_in FROM tickets WHERE order_id = $1`,
      [req.params.orderId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /tickets failed:", err);
    res.status(500).json({ error: "Could not load tickets." });
  }
});

// --- Admin ---
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await verifyAdmin(username, password);
    if (!admin) return res.status(401).json({ error: "Invalid credentials." });
    res.json({ token: issueToken(admin), username: admin.username });
  } catch (err) {
    console.error("Admin login failed:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT o.*, t.name AS ticket_type_name FROM orders o
     JOIN ticket_types t ON t.id = o.ticket_type_id
     ORDER BY o.created_at DESC`
  );
  res.json(result.rows);
});

router.get("/admin/summary", requireAdmin, async (req, res) => {
  const revenueResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
            COALESCE(SUM(quantity), 0) AS tickets_sold
     FROM orders WHERE status = 'paid'`
  );
  const pendingMpesaResult = await pool.query(
    `SELECT COUNT(*) AS count FROM payments WHERE method = 'mpesa' AND status IN ('initiated','pending')`
  );
  const pendingBankResult = await pool.query(
    `SELECT COUNT(*) AS count FROM payments WHERE method = 'bank' AND status = 'initiated'`
  );
  const settingsResult = await pool.query(`SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`);
  const revenue = revenueResult.rows[0];
  res.json({
    revenue: revenue.total_revenue,
    ticketsSold: revenue.tickets_sold,
    pendingMpesa: pendingMpesaResult.rows[0].count,
    pendingBank: pendingBankResult.rows[0].count,
    salesStatus: settingsResult.rows[0]?.status,
  });
});

router.get("/admin/payments", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, o.customer_name, o.customer_phone FROM payments p
     JOIN orders o ON o.id = p.order_id ORDER BY p.created_at DESC`
  );
  res.json(result.rows);
});

router.get("/admin/tickets", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT tk.*, o.customer_name, o.customer_email FROM tickets tk
     JOIN orders o ON o.id = tk.order_id ORDER BY tk.issued_at DESC`
  );
  res.json(result.rows);
});

router.post("/admin/close-sales", requireAdmin, async (req, res) => {
  await pool.query(`UPDATE event_settings SET status = 'closed' WHERE status = 'open'`);
  res.json({ closed: true });
});

export default router;
