// Loads .env.local then .env (like Next.js) for standalone scripts.
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
for (const f of ['.env.local', '.env']) if (existsSync(f)) config({ path: f, quiet: true });

export function dbConfig({ unpooled = false } = {}) {
  const connectionString = (unpooled && process.env.DATABASE_URL_UNPOOLED) || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local.');
    process.exit(1);
  }
  const ssl = process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false } : undefined;
  return { connectionString, ssl };
}
