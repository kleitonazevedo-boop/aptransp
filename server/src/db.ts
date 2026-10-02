import pg from "pg";

const { Pool } = pg;

const required = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variável obrigatória ausente: ${key}`);
  }
}

export const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function checkDatabase() {
  const result = await pool.query<{ now: Date; database: string }>(
    "SELECT NOW() AS now, current_database() AS database",
  );
  return result.rows[0];
}
