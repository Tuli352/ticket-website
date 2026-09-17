import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

export async function verifyAdmin(username, password) {
  const result = await pool.query(
    `SELECT * FROM admins WHERE username = $1`,
    [username]
  );
  const admin = result.rows[0];
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  return ok ? admin : null;
}

export function issueToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username }, JWT_SECRET, {
    expiresIn: "12h",
  });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token." });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}
