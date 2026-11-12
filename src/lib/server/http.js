import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, code = 'error', extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (msg, code = 'bad_request', extra) => new HttpError(400, msg, code, extra);
export const unauthorized = (msg = 'Please sign in', code = 'unauthorized') => new HttpError(401, msg, code);
export const forbidden = (msg = 'Not allowed', code = 'forbidden') => new HttpError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'not_found') => new HttpError(404, msg, code);
export const conflict = (msg, code = 'conflict', extra) => new HttpError(409, msg, code, extra);

export function json(data, init) {
  return NextResponse.json(data, init);
}

/**
 * Wraps a route handler: HttpError -> { error, code } with its status,
 * ZodError -> 400 naming the first bad field, anything else -> 500.
 */
export function route(handler) {
  return async (req, ctx) => {
    try {
      const res = await handler(req, ctx);
      return res instanceof Response ? res : NextResponse.json(res ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        const field = issue?.path?.join('.') || 'body';
        return NextResponse.json(
          { error: `${field}: ${issue?.message || 'Invalid value'}`, code: 'validation', field,
            fields: [...new Set(e.issues.map((i) => i.path.join('.')))] },
          { status: 400 },
        );
      }
      console.error('[route error]', req?.method, req?.url, e);
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'server_error' }, { status: 500 });
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw badRequest('Invalid JSON body', 'invalid_json');
  }
}

export function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// ---- Per-IP in-memory rate limit (per server instance) ----
const buckets = globalThis.__rateBuckets || (globalThis.__rateBuckets = new Map());

/** Throws 429 when `key` exceeded `limit` hits within `windowMs`. */
export function rateLimit(req, name, limit, windowMs) {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  if (b.count > limit) {
    throw new HttpError(429, 'Too many requests. Please wait a moment and try again.', 'rate_limited');
  }
}
