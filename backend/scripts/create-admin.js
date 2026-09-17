// Usage: node scripts/create-admin.js <username> <password>
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "../config/db.js";

dotenv.config();

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error("Usage: node scripts/create-admin.js <username> <password>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
await pool.query(
  `INSERT INTO admins (username, password_hash) VALUES (?, ?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
  [username, hash]
);
console.log(`Admin "${username}" ready.`);
process.exit(0);
