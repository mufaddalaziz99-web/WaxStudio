// Starts a local Postgres (embedded-postgres) on port 5433 and keeps it running.
// Usage: npm run db:local   (Ctrl+C to stop)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';

const databaseDir = path.resolve('.pgdata');
const DB_NAME = 'ecommerce26';
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

const fresh = !existsSync(path.join(databaseDir, 'PG_VERSION'));
if (fresh) {
  console.log('Initialising local Postgres in .pgdata ...');
  await pg.initialise();
}
await pg.start();
const client = pg.getPgClient();
await client.connect();
const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
await client.end();
if (!rows.length) {
  await pg.createDatabase(DB_NAME);
  console.log(`Created database ${DB_NAME}`);
}
console.log(`Postgres running: postgres://postgres:postgres@localhost:5433/${DB_NAME}`);
console.log('Press Ctrl+C to stop.');

const stop = async () => { try { await pg.stop(); } finally { process.exit(0); } };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
