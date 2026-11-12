import 'server-only';
import { many, one, query } from './db';
import { env } from './env';
import { badRequest } from './http';
import { addHistory } from './orderHelpers';
import { refundPayment } from './razorpay';

export async function refundedSoFar(orderId) {
  const r = await one(`SELECT COALESCE(sum(amount), 0)::int AS n FROM refunds WHERE order_id = $1 AND status <> 'failed'`, [orderId]);
  return r.n;
}

async function syncPaymentStatus(orderId) {
  const order = await one('SELECT total, payment_status FROM orders WHERE id = $1', [orderId]);
  const done = await refundedSoFar(orderId);
  if (done <= 0) return;
  const status = done >= order.total ? 'refunded' : 'partially_refunded';
  await query(`UPDATE orders SET payment_status = $2, refund_required = CASE WHEN $2 = 'refunded' THEN false ELSE refund_required END, updated_at = now() WHERE id = $1`, [orderId, status]);
}

/**
 * Full or partial refund through Razorpay, or recorded manually (bank transfer / UPI / COD).
 */
export async function createRefund(order, { amount, reason = '', manual = false, by = 'admin' }) {
  const already = await refundedSoFar(order.id);
  const refundable = order.total - already;
  if (amount > refundable) throw badRequest(`At most ₹${refundable} can be refunded.`, 'refund_too_large');
  if (!['paid', 'partially_refunded'].includes(order.payment_status)) {
    throw badRequest('Only paid orders can be refunded.', 'not_paid');
  }
  let rzpId = null;
  let status = 'processed';
  if (!manual) {
    if (order.payment_method !== 'razorpay' || !order.razorpay_payment_id) throw badRequest('This order was not paid online; record a manual refund instead.', 'not_online');
    if (!env.hasRazorpay) throw badRequest('Razorpay is not configured.', 'razorpay_unavailable');
    const r = await refundPayment(order.razorpay_payment_id, amount, { order_number: order.order_number, reason: reason.slice(0, 200) });
    rzpId = r.id;
    status = r.status === 'processed' ? 'processed' : 'pending';
  }
  const refund = await one(
    `INSERT INTO refunds (order_id, amount, razorpay_refund_id, status, reason, is_manual, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (razorpay_refund_id) DO UPDATE SET updated_at = now() RETURNING *`,
    [order.id, amount, rzpId, status, reason || null, manual, by],
  );
  await syncPaymentStatus(order.id);
  await addHistory(null, order.id, order.fulfillment_status, `Refund ₹${amount} ${manual ? 'recorded' : 'initiated'}${reason ? ` — ${reason}` : ''}`, by, true);
  return refund;
}

export async function refundRemaining(order, { reason, by }) {
  const remaining = order.total - (await refundedSoFar(order.id));
  if (remaining <= 0) return null;
  return createRefund(order, { amount: remaining, reason, by });
}

/** refund.* webhook events keep our refunds table in sync. */
export async function applyRefundWebhook(entity) {
  const status = entity.status === 'processed' ? 'processed' : entity.status === 'failed' ? 'failed' : 'pending';
  const order = await one('SELECT * FROM orders WHERE razorpay_payment_id = $1', [entity.payment_id]);
  if (!order) return { matched: false };
  const amount = Math.round(Number(entity.amount) / 100);
  await query(
    `INSERT INTO refunds (order_id, amount, razorpay_refund_id, status, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,'webhook')
     ON CONFLICT (razorpay_refund_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
    [order.id, amount, entity.id, status, entity.notes?.reason || 'Refund via Razorpay'],
  );
  await syncPaymentStatus(order.id);
  return { matched: true };
}

export async function listRefunds(orderId) {
  return many('SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at', [orderId]);
}
