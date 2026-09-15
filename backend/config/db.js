import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Render provides DATABASE_URL for PostgreSQL. Individual PG* variables
// are also supported for local development.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Render external URLs require TLS. Internal URLs work without it;
      // rejectUnauthorized:false also works with Render's self-signed certs.
      ssl: process.env.DATABASE_URL.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST || process.env.DB_HOST || "localhost",
      port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
      user: process.env.PGUSER || process.env.DB_USER || "postgres",
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.PGDATABASE || process.env.DB_NAME || "neyo_tickets",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

export const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});
