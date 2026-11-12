import 'server-only';
import { many, one, query } from './db';
import { env } from './env';
import { badRequest, notFound } from './http';
import { getSettings } from './settings';
import { getOrderWithDetails } from './orders';
import { refundedSoFar } from './refunds';
import { addHistory } from './orderHelpers';

// ---------------------------------------------------------------------------
// Admin: dashboard + orders. Thin route handlers in src/app/api/admin call these.
// ---------------------------------------------------------------------------

/** Orders that count as revenue: paid (not refunded), or COD that is not cancelled. */
const REVENUE_WHERE = `o.fulfillment_status <> 'cancelled'
  AND (o.payment_status IN ('paid','partially_refunded') OR (o.payment_method = 'cod' AND o.payment_status = 'pending'))`;

const IST_TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

const ORDER_LIST_COLUMNS = `o.id, o.order_number, o.created_at, o.name, o.email, o.phone, o.total, o.payment_method,
  o.payment_status, o.fulfillment_status, o.refund_required, o.shiprocket_error, o.awb_code, o.courier_name,
  o.is_gift, o.expired, (o.shipping_address->>'city') AS city, (o.shipping_address->>'pincode') AS pincode,
  (SELECT COALESCE(sum(i.quantity), 0)::int FROM order_items i WHERE i.order_id = o.id) AS item_count`;

export async function getDashboard() {
  const settings = await getSettings();
  const threshold = Number(settings.checkout.lowStockThreshold) || 0;

  const stats = await one(
    `SELECT
       count(*) FILTER (WHERE o.created_at >= ${IST_TODAY})::int AS today_orders,
       COALESCE(sum(o.total) FILTER (WHERE o.created_at >= ${IST_TODAY}), 0)::int AS today_revenue,
       count(*) FILTER (WHERE o.created_at >= ${IST_TODAY} - interval '6 days')::int AS week_orders,
       COALESCE(sum(o.total) FILTER (WHERE o.created_at >= ${IST_TODAY} - interval '6 days'), 0)::int AS week_revenue,
       count(*)::int AS month_orders,
       COALESCE(sum(o.total), 0)::int AS month_revenue
     FROM orders o
     WHERE o.created_at >= ${IST_TODAY} - interval '29 days' AND ${REVENUE_WHERE}`,
  );

  const [toPack, refundRequired, shiprocketErrors, openIssues, recent] = await Promise.all([
    many(`SELECT ${ORDER_LIST_COLUMNS} FROM orders o WHERE o.fulfillment_status = 'confirmed' ORDER BY o.created_at LIMIT 50`),
    many(`SELECT ${ORDER_LIST_COLUMNS} FROM orders o WHERE o.refund_required = true ORDER BY o.created_at DESC LIMIT 50`),
    many(`SELECT ${ORDER_LIST_COLUMNS} FROM orders o WHERE o.shiprocket_error IS NOT NULL
            AND o.fulfillment_status NOT IN ('cancelled','delivered') ORDER BY o.created_at DESC LIMIT 50`),
    many(`SELECT i.id, i.type, i.description, i.created_at, i.order_id, o.order_number, o.name
            FROM order_issues i JOIN orders o ON o.id = i.order_id WHERE i.status = 'open' ORDER BY i.created_at LIMIT 50`),
    many(`SELECT ${ORDER_LIST_COLUMNS} FROM orders o ORDER BY o.created_at DESC LIMIT 10`),
  ]);

  const lowStock = await many(
    `SELECT p.id AS product_id, p.name AS product_name, v.id AS variant_id, v.name AS variant_name, v.stock
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE NOT p.is_hidden AND NOT v.is_hidden AND v.stock < $1
     UNION ALL
     SELECT p.id, p.name, NULL, NULL, p.stock
       FROM products p
      WHERE NOT p.is_hidden AND p.stock < $1
        AND NOT EXISTS (SELECT 1 FROM product_variants x WHERE x.product_id = p.id AND NOT x.is_hidden)
     ORDER BY stock, product_name LIMIT 100`,
    [threshold],
  );

  const counts = await one(
    `SELECT
       (SELECT count(*) FROM reviews WHERE status = 'pending')::int AS pending_reviews,
       (SELECT count(*) FROM contact_messages WHERE NOT handled)::int AS unhandled_messages,
       (SELECT count(*) FROM orders WHERE fulfillment_status = 'placed' AND payment_status = 'pending')::int AS awaiting_payment,
       (SELECT count(*) FROM orders WHERE fulfillment_status IN ('packed','shipped','out_for_delivery'))::int AS in_transit,
       (SELECT count(*) FROM stock_alerts WHERE notified_at IS NULL)::int AS pending_stock_alerts`,
  );

  return { stats, toPack, refundRequired, shiprocketErrors, openIssues, lowStock, lowStockThreshold: threshold, recent, counts };
}

/**
 * Paginated order search.
 * @param {{ status?, payment?, method?, q?, from?, to?, attention?, page?, pageSize? }} f
 */
export async function listOrders(f = {}) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('$?', `$${params.length}`));
  };
  if (f.status) add('o.fulfillment_status = $?', f.status);
  if (f.payment) add('o.payment_status = $?', f.payment);
  if (f.method) add('o.payment_method = $?', f.method);
  if (f.from) add('o.created_at >= $?::timestamptz', f.from);
  if (f.to) add('o.created_at <= $?::timestamptz', f.to);
  if (f.attention === 'refund') where.push('o.refund_required');
  if (f.attention === 'shiprocket') where.push("o.shiprocket_error IS NOT NULL AND o.fulfillment_status NOT IN ('cancelled','delivered')");
  if (f.q) {
    const q = String(f.q).trim();
    const digits = q.replace(/\D/g, '');
    params.push(`%${q.toLowerCase()}%`);
    const p = `$${params.length}`;
    const parts = [`lower(o.order_number) LIKE ${p}`, `lower(o.name) LIKE ${p}`, `lower(o.email) LIKE ${p}`, `lower(COALESCE(o.awb_code,'')) LIKE ${p}`];
    if (digits.length >= 4) {
      params.push(`%${digits.slice(-10)}%`);
      parts.push(`o.phone LIKE $${params.length}`);
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = Math.min(Math.max(Number(f.pageSize) || 25, 1), 200);
  const page = Math.max(Number(f.page) || 1, 1);
  const { n } = await one(`SELECT count(*)::int AS n FROM orders o ${whereSql}`, params);
  const orders = await many(
    `SELECT ${ORDER_LIST_COLUMNS} FROM orders o ${whereSql} ORDER BY o.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );
  return { orders, total: n, page, pageSize };
}

/** Full order for the admin detail page (private history, shipment events, refunds, issues). */
export async function getAdminOrder(id) {
  const order = await getOrderWithDetails(id, { includePrivateHistory: true });
  if (!order) return null;
  order.history = await many(
    'SELECT id, status, note, actor, is_public, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at, id',
    [id],
  );
  order.shipment_events = await many(
    'SELECT id, awb, status, raw_status, location, event_time, created_at FROM shipment_events WHERE order_id = $1 ORDER BY COALESCE(event_time, created_at), id',
    [id],
  );
  order.refunded_amount = await refundedSoFar(id);
  order.customer_orders = order.user_id
    ? (await one('SELECT count(*)::int AS n FROM orders WHERE user_id = $1', [order.user_id])).n
    : (await one('SELECT count(*)::int AS n FROM orders WHERE lower(email) = lower($1)', [order.email])).n;
  delete order.razorpay_signature;
  return {
    order,
    integrations: { shiprocket: env.hasShiprocket, razorpay: env.hasRazorpay },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a route [id] param; a malformed id is simply "not found". */
export function parseId(id, what = 'Item') {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw notFound(`${what} not found`);
  return id;
}

export async function requireOrder(id) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [id]);
  if (!order) throw notFound('Order not found');
  return order;
}

/** Admin note and/or manually entered courier + AWB + tracking URL. */
export async function patchOrder(id, input) {
  const order = await requireOrder(id);
  const sets = [];
  const params = [id];
  const set = (col, v) => {
    params.push(v === '' ? null : v);
    sets.push(`${col} = $${params.length}`);
  };
  if (input.admin_note !== undefined) set('admin_note', input.admin_note);
  const tracking = ['courier_name', 'awb_code', 'tracking_url'].filter((k) => input[k] !== undefined);
  for (const k of tracking) set(k, input[k]);
  if (!sets.length) return order;
  const updated = await one(`UPDATE orders SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, params);
  if (tracking.length && (updated.awb_code !== order.awb_code || updated.courier_name !== order.courier_name)) {
    const label = [updated.courier_name, updated.awb_code && `AWB ${updated.awb_code}`].filter(Boolean).join(' · ');
    if (label) await addHistory(null, id, updated.fulfillment_status, `Tracking updated: ${label}`, 'admin', false);
  }
  return updated;
}

/** Validates the "Mark as paid (manual)" preconditions. */
export function assertManualPayable(order) {
  if (order.payment_method !== 'razorpay' || order.payment_status !== 'pending' || order.fulfillment_status !== 'placed') {
    throw badRequest('Only unpaid online orders awaiting payment can be marked as paid.', 'not_payable');
  }
}

/** Orders for packing slips, in the order requested. */
export async function ordersByIds(ids) {
  const rows = await many('SELECT * FROM orders WHERE id = ANY($1::uuid[])', [ids]);
  const items = await many('SELECT * FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY name, variant_name', [ids]);
  const byId = new Map(rows.map((r) => [r.id, { ...r, items: [] }]));
  for (const i of items) byId.get(i.order_id)?.items.push(i);
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function setOrderShiprocketError(id, message) {
  await query('UPDATE orders SET shiprocket_error = $2, updated_at = now() WHERE id = $1', [id, message ? String(message).slice(0, 500) : null]);
}
