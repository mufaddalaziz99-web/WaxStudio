import 'server-only';
import { after } from 'next/server';
import { many, one, query, withTransaction } from './db';
import {
  consumeCode, hashPassword, issueCode, publicUser, setSessionCookie, verifyGoogleIdToken, verifyPassword,
} from './auth';
import { sendVerificationCodeEmail } from './orderEmails';
import { HttpError, badRequest, conflict, notFound, unauthorized } from './http';

// Customer accounts: sign-up / verification / login / reset / Google, profile, saved addresses,
// and the cart + wishlist mirror. Route handlers in src/app/api/{auth,account} stay thin.

const USER_COLUMNS = 'id, email, name, phone, avatar_url, is_admin, email_verified_at, password_hash IS NOT NULL AS has_password, created_at';
const MAX_ADDRESSES = 20;

export async function getUserById(id) {
  return one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

function findByEmail(email) {
  return one('SELECT id, email, name, password_hash, email_verified_at, google_sub FROM users WHERE lower(email) = lower($1)', [email]);
}

/** Email the code after the response is sent (uniform timing; a mail hiccup never fails the request). */
function mailCode(email, code, purpose) {
  after(() => sendVerificationCodeEmail(email, code, purpose).catch((e) => console.error('[auth] code email failed', e.message)));
}

// bcrypt against a throwaway hash when the email is unknown, so login timing does not reveal accounts.
let dummyHash;
async function burnPasswordCheck(password) {
  dummyHash ||= hashPassword('not-a-real-password-' + Math.random());
  await verifyPassword(password, await dummyHash).catch(() => false);
}

async function signIn(userId) {
  await setSessionCookie(userId);
  return { user: publicUser(await getUserById(userId)) };
}

// ---------------------------------------------------------------------------
// Sign-up, verification, login
// ---------------------------------------------------------------------------

export async function signup({ name, email, password }) {
  const existing = await findByEmail(email);
  if (existing?.email_verified_at) {
    throw conflict('An account with this email already exists. Please sign in.', 'email_taken');
  }
  const hash = await hashPassword(password);
  let userId;
  if (existing) {
    // Unverified account: whoever proves ownership of the inbox with the new code gets it.
    await query('UPDATE users SET name = $2, password_hash = $3, updated_at = now() WHERE id = $1', [existing.id, name, hash]);
    userId = existing.id;
  } else {
    try {
      const row = await one('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id', [email, name, hash]);
      userId = row.id;
    } catch (e) {
      if (e.code === '23505') throw conflict('An account with this email already exists. Please sign in.', 'email_taken');
      throw e;
    }
  }
  const code = await issueCode(userId, 'verify');
  mailCode(email, code, 'verify');
  return { ok: true, email, needsVerification: true };
}

export async function verifyEmail({ email, code }) {
  const user = await findByEmail(email);
  if (!user) throw badRequest('That code is not right. Check the email and try again.', 'code_invalid');
  await consumeCode(user.id, 'verify', code);
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1', [user.id]);
  return signIn(user.id);
}

/** Always succeeds from the caller's point of view (no account-existence leak). */
export async function resendVerification({ email }) {
  const user = await findByEmail(email);
  if (user && !user.email_verified_at) {
    const code = await issueCode(user.id, 'verify');
    mailCode(user.email, code, 'verify');
  }
  return { ok: true };
}

export async function login({ email, password }) {
  const user = await findByEmail(email);
  if (!user || !user.password_hash) {
    await burnPasswordCheck(password);
    throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password.', 'invalid_credentials');
  }
  if (!user.email_verified_at) {
    const code = await issueCode(user.id, 'verify');
    mailCode(user.email, code, 'verify');
    throw new HttpError(403, 'Please verify your email. We have sent you a new code.', 'email_unverified', { email: user.email });
  }
  return signIn(user.id);
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordReset({ email }) {
  const user = await findByEmail(email);
  if (user) {
    const code = await issueCode(user.id, 'reset');
    mailCode(user.email, code, 'reset');
  }
  return { ok: true };
}

export async function resetPassword({ email, code, password }) {
  const user = await findByEmail(email);
  if (!user) throw badRequest('That code is not right. Check the email and try again.', 'code_invalid');
  await consumeCode(user.id, 'reset', code);
  const hash = await hashPassword(password);
  await query(
    `UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`,
    [user.id, hash],
  );
  return signIn(user.id);
}

// ---------------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------------

export async function googleSignIn({ credential }) {
  const g = await verifyGoogleIdToken(credential);
  let user = await one('SELECT id FROM users WHERE google_sub = $1', [g.sub]);
  if (!user) {
    const byEmail = await findByEmail(g.email);
    if (byEmail) {
      // Google proved the inbox. If the account was never verified, drop any password set by
      // whoever started that sign-up, so an unverified password cannot hijack the account.
      await query(
        `UPDATE users SET google_sub = $2,
           password_hash = CASE WHEN email_verified_at IS NULL THEN NULL ELSE password_hash END,
           email_verified_at = COALESCE(email_verified_at, now()),
           avatar_url = COALESCE(avatar_url, $3),
           name = CASE WHEN name = '' THEN $4 ELSE name END,
           updated_at = now()
         WHERE id = $1`,
        [byEmail.id, g.sub, g.picture, g.name],
      );
      user = { id: byEmail.id };
    } else {
      try {
        user = await one(
          `INSERT INTO users (email, name, google_sub, avatar_url, email_verified_at)
           VALUES ($1, $2, $3, $4, now()) RETURNING id`,
          [g.email, g.name, g.sub, g.picture],
        );
      } catch (e) {
        if (e.code !== '23505') throw e;
        user = await one('SELECT id FROM users WHERE google_sub = $1 OR lower(email) = lower($2) LIMIT 1', [g.sub, g.email]);
        if (!user) throw e;
      }
    }
  }
  return signIn(user.id);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfile(userId, { name, phone }) {
  const sets = ['name = $2', 'updated_at = now()'];
  const params = [userId, name];
  if (phone !== undefined) {
    params.push(phone || null);
    sets.push(`phone = $${params.length}`);
  }
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params);
  const user = await getUserById(userId);
  if (!user) throw unauthorized();
  return publicUser(user);
}

// ---------------------------------------------------------------------------
// Saved cart + wishlist (mirrored by AccountSync)
// ---------------------------------------------------------------------------

export async function getSaved(userId) {
  const row = await one('SELECT saved_cart, saved_wishlist FROM users WHERE id = $1', [userId]);
  return {
    cart: Array.isArray(row?.saved_cart) ? row.saved_cart : [],
    wishlist: Array.isArray(row?.saved_wishlist) ? row.saved_wishlist : [],
  };
}

export async function putSaved(userId, { cart, wishlist }) {
  const sets = [];
  const params = [userId];
  if (cart !== undefined) {
    params.push(JSON.stringify(cart));
    sets.push(`saved_cart = $${params.length}::jsonb`);
  }
  if (wishlist !== undefined) {
    params.push(JSON.stringify([...new Set(wishlist)]));
    sets.push(`saved_wishlist = $${params.length}::jsonb`);
  }
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
  return getSaved(userId);
}

// ---------------------------------------------------------------------------
// Saved addresses (one default per user)
// ---------------------------------------------------------------------------

export function mapAddress(a) {
  return {
    id: a.id, name: a.name, phone: a.phone, email: a.email || '', line1: a.line1, line2: a.line2 || '',
    landmark: a.landmark || '', city: a.city, state: a.state, pincode: a.pincode, isDefault: a.is_default,
  };
}

export async function listAddresses(userId) {
  const rows = await many('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [userId]);
  return rows.map(mapAddress);
}

export async function createAddress(userId, a) {
  return withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const { rows: [{ n }] } = await client.query('SELECT count(*)::int AS n FROM addresses WHERE user_id = $1', [userId]);
    if (n >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses.`, 'too_many_addresses');
    const makeDefault = a.isDefault || n === 0;
    if (makeDefault) await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    const { rows: [row] } = await client.query(
      `INSERT INTO addresses (user_id, name, phone, email, line1, line2, landmark, city, state, pincode, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [userId, a.name, a.phone, a.email || null, a.line1, a.line2 || '', a.landmark || '', a.city, a.state, a.pincode, makeDefault],
    );
    return mapAddress(row);
  });
}

/** Full edit (all fields) or `{ isDefault: true }` alone to make it the default. */
export async function updateAddress(userId, id, a) {
  return withTransaction(async (client) => {
    const { rows: [existing] } = await client.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
    if (!existing) throw notFound('Address not found');
    if (a.isDefault) await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1 AND id <> $2', [userId, id]);
    let row;
    if (a.line1 !== undefined) {
      ({ rows: [row] } = await client.query(
        `UPDATE addresses SET name = $3, phone = $4, email = $5, line1 = $6, line2 = $7, landmark = $8, city = $9,
           state = $10, pincode = $11, is_default = $12
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId, a.name, a.phone, a.email || null, a.line1, a.line2 || '', a.landmark || '', a.city, a.state, a.pincode,
          a.isDefault ? true : existing.is_default],
      ));
    } else {
      ({ rows: [row] } = await client.query(
        'UPDATE addresses SET is_default = $3 WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId, a.isDefault ? true : existing.is_default],
      ));
    }
    return mapAddress(row);
  });
}

export async function deleteAddress(userId, id) {
  return withTransaction(async (client) => {
    const { rows: [gone] } = await client.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default', [id, userId]);
    if (!gone) throw notFound('Address not found');
    if (gone.is_default) {
      await client.query(
        `UPDATE addresses SET is_default = true WHERE id = (
           SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
        [userId],
      );
    }
    return { ok: true };
  });
}
