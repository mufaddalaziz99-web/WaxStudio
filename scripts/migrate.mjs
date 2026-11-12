// Applies db/migrations/*.sql once each, in filename order, each inside a transaction.
import './_env.mjs';
import { dbConfig } from './_env.mjs';
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const client = new pg.Client(dbConfig({ unpooled: true }));
await client.connect();
try {
  const { rows: [{ server_encoding }] } = await client.query('SHOW server_encoding');
  if (server_encoding !== 'UTF8') {
    throw new Error(`Refusing to migrate: database encoding is ${server_encoding}, expected UTF8`);
  }
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const dir = path.resolve('db/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`Applying ${file} ... `);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('ok');
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('FAILED');
      throw e;
    }
  }
  console.log(applied ? `${applied} migration(s) applied.` : 'Database is up to date.');
} finally {
  await client.end();
}
