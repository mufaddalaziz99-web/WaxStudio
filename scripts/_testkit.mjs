// Tiny test harness for the API test scripts. They MUTATE data — run only against a local database.
import './_env.mjs';
import { dbConfig } from './_env.mjs';
import pg from 'pg';
import crypto from 'node:crypto';

export const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

const url = new URL(dbConfig().connectionString);
if (!['localhost', '127.0.0.1'].includes(url.hostname) && !process.env.ALLOW_REMOTE_TESTS) {
  console.error(`Refusing to run: DATABASE_URL points at ${url.hostname}. Tests mutate data — use a local database.`);
  process.exit(1);
}

export const db = new pg.Pool(dbConfig());
export const uuid = () => crypto.randomUUID();

let passed = 0;
let failed = 0;
export async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
export function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'expected equal'}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
export async function done() {
  await db.end();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

export async function http(path, { method = 'GET', body, headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

export async function getProduct() {
  const { rows: [p] } = await db.query(`SELECT * FROM products WHERE is_featured ORDER BY sort_order LIMIT 1`);
  const { rows: variants } = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order', [p.id]);
  return { product: p, variants };
}

export const ADDRESS = {
  name: 'Test Buyer', phone: '9876543210', email: 'buyer@example.test', line1: '12 Test Street', line2: 'Test Area',
  landmark: '', city: 'Mumbai', state: 'Maharashtra', pincode: '400001',
};

/** Places an order through the API (COD by default). */
export async function placeOrder({ items, paymentMethod = 'cod', clientRequestId = uuid(), address = ADDRESS, couponCode = null }) {
  const quote = await http('/api/shipping/quote', { method: 'POST', body: { pincode: address.pincode, items } });
  const shippingOptionId = quote.data?.options?.[0]?.id || 'flat_standard';
  return http('/api/orders', {
    method: 'POST',
    body: { clientRequestId, items, address, shippingOptionId, paymentMethod, couponCode, gift: { isGift: false, wrap: false, message: '' } },
  });
}

export async function stockOf(variantId) {
  const { rows: [v] } = await db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]);
  return v.stock;
}

export async function serverUp() {
  try {
    await fetch(`${BASE}/api/auth/me`);
  } catch {
    console.error(`Dev server not reachable at ${BASE}. Start it with: npm run dev`);
    process.exit(1);
  }
}
