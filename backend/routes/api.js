import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../config/db.js";
import { stkPush, parseCallback } from "../services/mpesa.js";
import { createPayment, markPaymentResult, getOrderStatus } from "../services/payments.js";
import { verifyAdmin, issueToken, requireAdmin } from "../services/auth.js";

const router = express.Router();
const RESERVATION_MINUTES = 10;

// --- Sales window gate: every purchase-affecting route checks the backend
// clock, not the browser countdown, so nobody can bypass it client-side.
async function requireSalesOpen(req, res, next) {
  const [[settings]] = await pool.query(
    `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
  );
  if (!settings || new Date() > new Date(settings.sales_close_at) || settings.status === "closed") {
    return res.status(410).json({ error: "Sales are closed." });
  }
  next();
}

// GET /api/event — public info for the countdown + ticket tiers
router.get("/event", async (req, res) => {
  const [[settings]] = await pool.query(
    `SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`
  );
  const [types] = await pool.query(
    `SELECT id, name, price, (total_quantity - sold_quantity - reserved_quantity) AS available
     FROM ticket_types`
  );
  res.json({ settings, ticketTypes: types });
});

// POST /api/orders — reserve tickets, create a pending order
router.post("/orders", requireSalesOpen, async (req, res) => {
  const { name, phone, email, ticketTypeId, quantity } = req.body;
  if (!name || !phone || !email || !ticketTypeId || !quantity) {
    return res.status(400).json({ error: "Missing fields." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[type]] = await conn.query(
      `SELECT * FROM ticket_types WHERE id = ? FOR UPDATE`,
      [ticketTypeId]
    );
    const available = type.total_quantity - type.sold_quantity - type.reserved_quantity;
    if (available < quantity) {
      await conn.rollback();
      return res.status(409).json({ error: "Not enough tickets available." });
    }

    const orderId = randomUUID();
    const total = Number(type.price) * quantity;
    const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

    await conn.query(
      `INSERT INTO orders (id, customer_name, customer_phone, customer_email,
        ticket_type_id, quantity, unit_price, total_amount, status, reserved_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', ?)`,
      [orderId, name, phone, email, ticketTypeId, quantity, type.price, total, reservedUntil]
    );
    await conn.query(
      `UPDATE ticket_types SET reserved_quantity = reserved_quantity + ? WHERE id = ?`,
      [quantity, ticketTypeId]
    );

    await conn.commit();
    res.json({ orderId, totalAmount: total, reservedUntil });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Could not create order." });
  } finally {
    conn.release();
  }
});

// POST /api/payments/mpesa — initiate STK Push
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
    await pool.query(`UPDATE orders SET status = 'pending_payment' WHERE id = ?`, [orderId]);
    res.json({ checkoutRequestId: stk.CheckoutRequestID });
  } catch (err) {
    res.status(502).json({ error: "STK push failed. Try again or use another payment method." });
  }
});

// POST /api/mpesa/callback — Safaricom posts the result here.
// No sales-window gate: a payment already in flight must still be able
// to confirm even if it completes right as the window closes.
router.post("/mpesa/callback", async (req, res) => {
  const result = parseCallback(req.body);
  if (result) {
    await markPaymentResult({
      checkoutRequestId: result.checkoutRequestId,
      success: result.success,
      providerReference: result.mpesaReceiptNumber || null,
      rawCallback: req.body,
    });
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" }); // ack to Safaricom
});

// GET /api/payments/order/:orderId/status — frontend polls this
router.get("/payments/order/:orderId/status", async (req, res) => {
  const order = await getOrderStatus(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found." });
  res.json({ status: order.status });
});

// POST /api/payments/card — hand off to your card processor (Stripe/Paystack)
router.post("/payments/card", requireSalesOpen, async (req, res) => {
  const { orderId } = req.body;
  const order = await getOrderStatus(orderId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const paymentId = await createPayment({
    orderId,
    method: "card",
    amount: order.total_amount,
  });
  // TODO: create a Checkout Session with your processor and return its URL.
  res.json({ paymentId, message: "Wire this to your card processor's checkout session." });
});

// POST /api/payments/bank — return account details + unique reference
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

// GET /api/tickets/:orderId — fetch issued tickets for a paid order
router.get("/tickets/:orderId", async (req, res) => {
  const [tickets] = await pool.query(`SELECT ticket_code, qr_data, issued_at FROM tickets WHERE order_id = ?`, [
    req.params.orderId,
  ]);
  res.json(tickets);
});

// --- Admin ---

// POST /api/admin/login — issues a JWT, used as Bearer token on every other /admin/* call.
// Rate-limited by paymentLimiter's sibling below in server.js? No — add its own limiter there.
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  const admin = await verifyAdmin(username, password);
  if (!admin) return res.status(401).json({ error: "Invalid credentials." });
  res.json({ token: issueToken(admin), username: admin.username });
});

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.*, t.name AS ticket_type_name FROM orders o
     JOIN ticket_types t ON t.id = o.ticket_type_id
     ORDER BY o.created_at DESC`
  );
  res.json(orders);
});

router.get("/admin/summary", requireAdmin, async (req, res) => {
  const [[revenue]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
            COALESCE(SUM(quantity), 0) AS tickets_sold
     FROM orders WHERE status = 'paid'`
  );
  const [[pendingMpesa]] = await pool.query(
    `SELECT COUNT(*) AS count FROM payments WHERE method = 'mpesa' AND status IN ('initiated','pending')`
  );
  const [[pendingBank]] = await pool.query(
    `SELECT COUNT(*) AS count FROM payments WHERE method = 'bank' AND status = 'initiated'`
  );
  const [[settings]] = await pool.query(`SELECT * FROM event_settings ORDER BY id DESC LIMIT 1`);
  res.json({
    revenue: revenue.total_revenue,
    ticketsSold: revenue.tickets_sold,
    pendingMpesa: pendingMpesa.count,
    pendingBank: pendingBank.count,
    salesStatus: settings?.status,
  });
});

router.get("/admin/payments", requireAdmin, async (req, res) => {
  const [payments] = await pool.query(
    `SELECT p.*, o.customer_name, o.customer_phone FROM payments p
     JOIN orders o ON o.id = p.order_id ORDER BY p.created_at DESC`
  );
  res.json(payments);
});

router.get("/admin/tickets", requireAdmin, async (req, res) => {
  const [tickets] = await pool.query(
    `SELECT tk.*, o.customer_name, o.customer_email FROM tickets tk
     JOIN orders o ON o.id = tk.order_id ORDER BY tk.issued_at DESC`
  );
  res.json(tickets);
});

// Closes sales without touching any stored data.
router.post("/admin/close-sales", requireAdmin, async (req, res) => {
  await pool.query(`UPDATE event_settings SET status = 'closed' WHERE status = 'open'`);
  res.json({ closed: true });
});

export default router;
