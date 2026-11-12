// npm run admin:create -- <email> <password> <name>
// The only way to grant is_admin. Creates the user if missing, otherwise promotes it.
import './_env.mjs';
import { dbConfig } from './_env.mjs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ') || 'Admin';
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run admin:create -- <email> <password (8+ chars)> <name>');
  process.exit(1);
}
const client = new pg.Client(dbConfig());
await client.connect();
const hash = await bcrypt.hash(password, 11);
const { rows } = await client.query(
  `INSERT INTO users (email, name, password_hash, is_admin, email_verified_at)
   VALUES ($1, $2, $3, true, now())
   ON CONFLICT (lower(email)) DO UPDATE
     SET is_admin = true, password_hash = EXCLUDED.password_hash,
         email_verified_at = COALESCE(users.email_verified_at, now()), updated_at = now()
   RETURNING id, email`,
  [email.trim().toLowerCase(), name, hash],
);
console.log(`Admin ready: ${rows[0].email} (${rows[0].id})`);
await client.end();
