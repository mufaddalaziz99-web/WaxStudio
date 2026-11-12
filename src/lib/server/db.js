import 'server-only';
import pg from 'pg';

// Return BIGINT/NUMERIC as JS numbers (money is whole rupees in INTEGER columns anyway).
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const globalForPg = globalThis;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const ssl = process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false } : undefined;
  return new pg.Pool({ connectionString, ssl, max: Number(process.env.DATABASE_POOL_MAX || 5), idleTimeoutMillis: 30_000 });
}

export function getPool() {
  if (!globalForPg.__pgPool) globalForPg.__pgPool = createPool();
  return globalForPg.__pgPool;
}

/** Run a query on the pool, or on `client` when given (inside a transaction). */
export async function query(text, params = [], client) {
  return (client || getPool()).query(text, params);
}
export async function one(text, params = [], client) {
  const { rows } = await query(text, params, client);
  return rows[0] || null;
}
export async function many(text, params = [], client) {
  const { rows } = await query(text, params, client);
  return rows;
}

/**
 * BEGIN / COMMIT / ROLLBACK around fn(client).
 * Rule: never make an external HTTP call (Razorpay, Shiprocket, email) inside fn.
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
