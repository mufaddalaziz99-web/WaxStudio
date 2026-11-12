import 'server-only';
import { many, one, query, withTransaction } from './db';
import { PAYMENT_HOLD_MINUTES } from '../rules';

// ---------------------------------------------------------------------------
// Shared order state helpers. Every payment path (browser verify, Razorpay webhook,
// expiry sweep, admin) converges on markOrderPaid / cancelAndRestock, which lock the
// order row and are idempotent — an order can never be paid or restocked twice.
// ---------------------------------------------------------------------------

export async function addHistory(client, orderId, status, note = null, actor = 'system', isPublic = true) {
  await query(
    'INSERT INTO order_status_history (order_id, status, note, actor, is_public) VALUES ($1, $2, $3, $4, $5)',
    [orderId, status, note, actor, isPublic],
    client,
  );
}

/** Lock product rows then variant rows in id order (deadlock-safe). */
export async function lockStockRows(client, lines) {
  const productIds = [...new Set(lines.map((l) => l.productId || l.product_id).filter(Boolean))].sort();
  const variantIds = [...new Set(lines.map((l) => l.variantId || l.variant_id).filter(Boolean))].sort();
  const products = productIds.length
    ? await many('SELECT * FROM products WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [productIds], client)
    : [];
  const variants = variantIds.length
    ? await many('SELECT * FROM product_variants WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [variantIds], client)
    : [];
  return { products: new Map(products.map((p) => [p.id, p])), variants: new Map(variants.map((v) => [v.id, v])) };
}

/** Put the order's items back into stock. Caller holds the order lock. */
async function restockItems(client, orderId) {
  const items = await many('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1', [orderId], client);
  await lockStockRows(client, items);
  for (const it of items) {
    if (it.variant_id) {
      await query('UPDATE product_variants SET stock = stock + $2 WHERE id = $1', [it.variant_id, it.quantity], client);
    } else if (it.product_id) {
      await query('UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1', [it.product_id, it.quantity], client);
    }
  }
  return items.map((i) => i.product_id);
}

/**
 * Try to take the order's items out of stock again (payment landed after expiry).
 * Returns true when every line could be reserved; otherwise changes nothing.
 */
async function reReserveItems(client, orderId) {
  const items = await many('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = $1', [orderId], client);
  const { products, variants } = await lockStockRows(client, items);
  for (const it of items) {
    const row = it.variant_id ? variants.get(it.variant_id) : products.get(it.product_id);
    if (!row || row.stock < it.quantity) return false;
  }
  for (const it of items) {
    if (it.variant_id) {
      await query('UPDATE product_variants SET stock = stock - $2 WHERE id = $1', [it.variant_id, it.quantity], client);
    } else {
      await query('UPDATE products SET stock = stock - $2, updated_at = now() WHERE id = $1', [it.product_id, it.quantity], client);
    }
  }
  return true;
}

/**
 * The single "payment succeeded" transition. Idempotent and row-locked.
 * @returns {{ transitioned: boolean, order: object, outcome: 'paid'|'already_paid'|'restored'|'refund_required' }}
 * Only `transitioned === true` should trigger follow-up work (Shiprocket push, emails, cart clear).
 */
export async function markOrderPaid(orderId, { paymentId, signature = null, source = 'checkout' }) {
  return withTransaction(async (client) => {
    const order = await one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId], client);
    if (!order) throw new Error(`markOrderPaid: order ${orderId} not found`);

    if (order.payment_status === 'paid' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded') {
      return { transitioned: false, order, outcome: 'already_paid' };
    }

    const label = source === 'webhook' ? 'webhook' : source === 'admin' ? 'admin' : 'checkout';

    if (order.fulfillment_status === 'cancelled') {
      // Payment arrived after the order was released (15-minute expiry) or cancelled.
      const restored = order.expired ? await reReserveItems(client, order.id) : false;
      if (restored) {
        const updated = await one(
          `UPDATE orders SET payment_status = 'paid', fulfillment_status = 'confirmed', expired = false,
             cancel_reason = NULL, cancelled_by = NULL, cancelled_at = NULL,
             razorpay_payment_id = $2, razorpay_signature = COALESCE($3, razorpay_signature),
             paid_at = now(), updated_at = now()
           WHERE id = $1 RETURNING *`,
          [order.id, paymentId, signature],
          client,
        );
        if (updated.coupon_id) await query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [updated.coupon_id], client);
        await addHistory(client, order.id, 'confirmed', `Payment received after expiry (${label}); order restored`, source);
        return { transitioned: true, order: updated, outcome: 'restored' };
      }
      const updated = await one(
        `UPDATE orders SET payment_status = 'paid', refund_required = true, razorpay_payment_id = $2,
           razorpay_signature = COALESCE($3, razorpay_signature), paid_at = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [order.id, paymentId, signature],
        client,
      );
      await addHistory(client, order.id, 'cancelled', `Payment received (${label}) but the order was already cancelled and stock is gone — REFUND REQUIRED`, source, false);
      return { transitioned: false, order: updated, outcome: 'refund_required' };
    }

    const nextStatus = order.fulfillment_status === 'placed' ? 'confirmed' : order.fulfillment_status;
    const updated = await one(
      `UPDATE orders SET payment_status = 'paid', fulfillment_status = $2, razorpay_payment_id = $3,
         razorpay_signature = COALESCE($4, razorpay_signature), paid_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [order.id, nextStatus, paymentId, signature],
      client,
    );
    await addHistory(client, order.id, nextStatus, `Payment received (${label})`, source);
    return { transitioned: true, order: updated, outcome: 'paid' };
  });
}

/**
 * Cancel an order and return its stock. Idempotent: an already-cancelled order is a no-op.
 * Does NOT talk to Razorpay/Shiprocket — callers do that after commit.
 */
export async function cancelAndRestock(orderId, { reason, actor = 'system', expired = false, restock = true, client: outer } = {}) {
  const run = async (client) => {
    const order = await one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId], client);
    if (!order || order.fulfillment_status === 'cancelled') return { cancelled: false, order };
    if (order.fulfillment_status === 'delivered') return { cancelled: false, order };
    let productIds = [];
    if (restock) productIds = await restockItems(client, order.id);
    if (order.coupon_id) {
      await query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = $1', [order.coupon_id], client);
    }
    const updated = await one(
      `UPDATE orders SET fulfillment_status = 'cancelled', expired = $2, cancel_reason = $3, cancelled_by = $4,
         cancelled_at = now(), payment_status = CASE WHEN payment_status = 'pending' AND $2 THEN 'failed' ELSE payment_status END,
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [order.id, expired, reason || null, actor],
      client,
    );
    await addHistory(client, order.id, 'cancelled', reason || (expired ? 'Payment not completed in time' : 'Cancelled'), actor);
    return { cancelled: true, order: updated, productIds };
  };
  return outer ? run(outer) : withTransaction(run);
}

/** Cancels online orders still placed + pending after the payment hold. Returns released orders. */
export async function releaseExpiredOrders() {
  const expired = await many(
    `SELECT id FROM orders WHERE payment_method = 'razorpay' AND fulfillment_status = 'placed'
       AND payment_status = 'pending' AND created_at < now() - ($1 || ' minutes')::interval
     ORDER BY created_at LIMIT 100`,
    [String(PAYMENT_HOLD_MINUTES)],
  );
  const released = [];
  const productIds = new Set();
  for (const { id } of expired) {
    try {
      const r = await cancelAndRestock(id, { reason: 'Payment not completed within 15 minutes', expired: true, actor: 'system' });
      if (r.cancelled) {
        released.push(r.order);
        r.productIds?.forEach((p) => productIds.add(p));
      }
    } catch (e) {
      console.error('[expiry] failed to release', id, e.message);
    }
  }
  if (released.length) {
    const { refreshProducts } = await import('./revalidate');
    await refreshProducts([...productIds]).catch(() => {});
    const { sendPaymentFailedEmail } = await import('./orderEmails');
    for (const o of released) sendPaymentFailedEmail(o.id).catch((e) => console.error('[expiry] email', e.message));
  }
  return released;
}

let lastSweep = globalThis.__lastExpirySweep || 0;
let sweeping = null;

/**
 * Lazy, throttled sweep (at most once a minute per instance). Called wherever stock is read.
 * Returns a promise; callers that don't need to wait may ignore it.
 */
export function maybeReleaseExpiredOrders() {
  const now = Date.now();
  if (sweeping) return sweeping;
  if (now - lastSweep < 60_000) return Promise.resolve([]);
  lastSweep = globalThis.__lastExpirySweep = now;
  sweeping = releaseExpiredOrders()
    .catch((e) => {
      console.error('[expiry] sweep failed', e.message);
      return [];
    })
    .finally(() => {
      sweeping = null;
    });
  return sweeping;
}
