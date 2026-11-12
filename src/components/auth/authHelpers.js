// Browser helpers shared by the sign-in / sign-up / verify / reset pages.

const AUTH_PAGES = /^\/(login|signup|verify-email|forgot-password)(\/|\?|$)/;

/** Only same-site paths ("/account", "/checkout?x=1") are allowed as ?next= targets. */
export function safeNext(value, fallback = '/account') {
  if (typeof value !== 'string' || !value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\r\n\t]/.test(value) || AUTH_PAGES.test(value)) return fallback;
  return value;
}

/** Appends ?next= to an auth page link when there is somewhere to go back to. */
export function withNext(path, next) {
  return next && next !== '/account' ? `${path}?next=${encodeURIComponent(next)}` : path;
}

// The address waiting for a code is kept in sessionStorage (not in the URL).
const PENDING_KEY = 'auth_pending_email';
export function setPendingEmail(email) {
  try { sessionStorage.setItem(PENDING_KEY, email); } catch {}
}
export function getPendingEmail() {
  try { return sessionStorage.getItem(PENDING_KEY) || ''; } catch { return ''; }
}
export function clearPendingEmail() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
}
