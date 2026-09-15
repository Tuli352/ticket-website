import { pool } from "../config/db.js";
import { createTicketsForOrder } from "./tickets.js";

export async function createPayment({ orderId, method, amount, checkoutRequestId = null }) {
  const [res] = await pool.query(
    `INSERT INTO payments (order_id, method, amount, status, checkout_request_id)
     VALUES (?, ?, ?, 'initiated', ?)`,
    [orderId, method, amount, checkoutRequestId]
  );
  return res.insertId;
}

// Idempotent: if the order is already paid, ignore repeat callbacks.
export async function markPaymentResult({
  checkoutRequestId,
  success,
  providerReference,
  rawCallback,
}) {
  const [[payment]] = await pool.query(
    `SELECT * FROM payments WHERE checkout_request_id = ?`,
    [checkoutRequestId]
  );
  if (!payment) return null;

  const [[order]] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
    payment.order_id,
  ]);
  if (order.status === "paid") return { alreadyPaid: true };

  await pool.query(
    `UPDATE payments SET status = ?, provider_reference = ?, raw_callback = ?
     WHERE id = ?`,
    [
      success ? "success" : "failed",
      providerReference,
      JSON.stringify(rawCallback),
      payment.id,
    ]
  );

  if (success) {
    await pool.query(
      `UPDATE orders SET status = 'paid' WHERE id = ?`,
      [order.id]
    );
    await pool.query(
      `UPDATE ticket_types SET sold_quantity = sold_quantity + ?, reserved_quantity = reserved_quantity - ?
       WHERE id = ?`,
      [order.quantity, order.quantity, order.ticket_type_id]
    );
    await createTicketsForOrder(order.id, order.quantity);
  } else {
    await pool.query(`UPDATE orders SET status = 'failed' WHERE id = ?`, [
      order.id,
    ]);
    await pool.query(
      `UPDATE ticket_types SET reserved_quantity = reserved_quantity - ? WHERE id = ?`,
      [order.quantity, order.ticket_type_id]
    );
  }

  return { alreadyPaid: false, success };
}

export async function getOrderStatus(orderId) {
  const [[order]] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [
    orderId,
  ]);
  return order || null;
}
