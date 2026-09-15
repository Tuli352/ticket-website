import { pool } from "../config/db.js";
import { createTicketsForOrder } from "./tickets.js";

export async function createPayment({ orderId, method, amount, checkoutRequestId = null }) {
  const result = await pool.query(
    `INSERT INTO payments (order_id, method, amount, status, checkout_request_id)
     VALUES ($1, $2, $3, 'initiated', $4)
     RETURNING id`,
    [orderId, method, amount, checkoutRequestId]
  );
  return result.rows[0].id;
}

// Idempotent: if the order is already paid, ignore repeat callbacks.
export async function markPaymentResult({
  checkoutRequestId,
  success,
  providerReference,
  rawCallback,
}) {
  const paymentResult = await pool.query(
    `SELECT * FROM payments WHERE checkout_request_id = $1`,
    [checkoutRequestId]
  );
  const payment = paymentResult.rows[0];
  if (!payment) return null;

  const orderResult = await pool.query(`SELECT * FROM orders WHERE id = $1`, [
    payment.order_id,
  ]);
  const order = orderResult.rows[0];
  if (!order) return null;
  if (order.status === "paid") return { alreadyPaid: true };

  await pool.query(
    `UPDATE payments SET status = $1, provider_reference = $2, raw_callback = $3
     WHERE id = $4`,
    [
      success ? "success" : "failed",
      providerReference,
      JSON.stringify(rawCallback),
      payment.id,
    ]
  );

  if (success) {
    await pool.query(
      `UPDATE orders SET status = 'paid' WHERE id = $1`,
      [order.id]
    );
    await pool.query(
      `UPDATE ticket_types SET sold_quantity = sold_quantity + $1, reserved_quantity = reserved_quantity - $2
       WHERE id = $3`,
      [order.quantity, order.quantity, order.ticket_type_id]
    );
    await createTicketsForOrder(order.id, order.quantity);
  } else {
    await pool.query(`UPDATE orders SET status = 'failed' WHERE id = $1`, [
      order.id,
    ]);
    await pool.query(
      `UPDATE ticket_types SET reserved_quantity = reserved_quantity - $1 WHERE id = $2`,
      [order.quantity, order.ticket_type_id]
    );
  }

  return { alreadyPaid: false, success };
}

export async function getOrderStatus(orderId) {
  const result = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return result.rows[0] || null;
}
