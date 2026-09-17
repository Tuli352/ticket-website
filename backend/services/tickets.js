import { pool } from "../config/db.js";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

function generateTicketCode() {
  return `NEYO-${randomUUID().split("-")[0].toUpperCase()}`;
}

export async function createTicketsForOrder(orderId, quantity) {
  const result = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  const order = result.rows[0];
  if (!order) throw new Error("Order not found when issuing tickets.");

  const tickets = [];
  for (let i = 0; i < quantity; i++) {
    const code = generateTicketCode();
    const qrData = await QRCode.toDataURL(code);
    await pool.query(
      `INSERT INTO tickets (order_id, ticket_code, qr_data) VALUES ($1, $2, $3)`,
      [orderId, code, qrData]
    );
    tickets.push({ code, qrData });
  }

  await sendTicketEmail(order, tickets);
  return tickets;
}

async function sendTicketEmail(order, tickets) {
  if (!process.env.SMTP_HOST) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const attachments = tickets.map((t, idx) => ({
    filename: `ticket-${idx + 1}.png`,
    content: t.qrData.split(",")[1],
    encoding: "base64",
  }));

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "tickets@example.com",
    to: order.customer_email,
    subject: "Your Ne-Yo Live ticket(s)",
    text: `Hi ${order.customer_name}, your ${tickets.length} ticket(s): ${tickets
      .map((t) => t.code)
      .join(", ")}. Present the QR code at entry.`,
    attachments,
  });
}
