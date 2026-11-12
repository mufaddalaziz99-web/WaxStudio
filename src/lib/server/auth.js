import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { one, query } from './db';
import { HttpError, badRequest, forbidden, unauthorized } from './http';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set (32+ chars)');
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 11);
}
export async function verifyPassword(pw, hash) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

export async function createSessionToken(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Sets the signed httpOnly session cookie (call from a route handler / server action). */
export async function setSessionCookie(userId) {
  const token = await createSessionToken(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function readSessionUserId() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload.sub || null;
  } catch {
    return null;
  }
}

const USER_COLUMNS = 'id, email, name, phone, avatar_url, is_admin, email_verified_at, password_hash IS NOT NULL AS has_password, created_at';

/** The signed-in user (fresh from DB) or null. Guest checkout is allowed, so this never throws. */
export async function getSessionUser() {
  const id = await readSessionUserId();
  if (!id) return null;
  return one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (!user.is_admin) throw forbidden('Admins only');
  return user;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name, phone: u.phone, avatarUrl: u.avatar_url,
    isAdmin: u.is_admin, verified: Boolean(u.email_verified_at), hasPassword: u.has_password,
  };
}

// ---- 6-digit codes (email verification + password reset) ----
function hashCode(code) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(code).digest('hex');
}

export async function issueCode(userId, purpose = 'verify') {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await query(`UPDATE email_verifications SET consumed_at = now()
               WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`, [userId, purpose]);
  await query(
    `INSERT INTO email_verifications (user_id, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes')`,
    [userId, purpose, hashCode(code)],
  );
  return code;
}

/** Validates and consumes a code. Throws a 400 on mismatch / expiry / too many attempts. */
export async function consumeCode(userId, purpose, code) {
  const row = await one(
    `SELECT id, code_hash, attempts, expires_at FROM email_verifications
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose],
  );
  if (!row || new Date(row.expires_at) < new Date()) throw badRequest('This code has expired. Request a new one.', 'code_expired');
  if (row.attempts >= 5) throw badRequest('Too many attempts. Request a new code.', 'code_locked');
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hashCode(code)));
  if (!ok) {
    await query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw badRequest('That code is not right. Check the email and try again.', 'code_invalid');
  }
  await query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [row.id]);
}

// ---- Google Sign-In (ID token from Google Identity Services) ----
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(400, 'Google Sign-In is not configured', 'google_disabled');
  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    if (!payload.email || payload.email_verified === false) throw new Error('email not verified');
    return { sub: payload.sub, email: String(payload.email).toLowerCase(), name: payload.name || '', picture: payload.picture || null };
  } catch {
    throw badRequest('Google sign-in failed. Please try again.', 'google_invalid');
  }
}
