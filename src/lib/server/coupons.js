import 'server-only';
import { one, query } from './db';
import { badRequest } from './http';
import { normalizePhone } from '../rules';

/** Discount on the items total only — never on shipping or the COD fee. */
export function computeDiscount(coupon, itemsTotal) {
  let d = coupon.type === 'percent' ? Math.floor((itemsTotal * coupon.value) / 100) : coupon.value;
  if (coupon.type === 'percent' && coupon.max_discount) d = Math.min(d, coupon.max_discount);
  return Math.max(0, Math.min(d, itemsTotal));
}

/** Throws a 400 with a customer-friendly reason when the coupon cannot be used. */
async function assertUsable(coupon, { itemsTotal, email, phone }, client) {
  if (!coupon || !coupon.is_active) throw badRequest('This coupon code is not valid.', 'coupon_invalid');
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) throw badRequest('This coupon is not active yet.', 'coupon_not_started');
  if (coupon.ends_at && new Date(coupon.ends_at) <= now) throw badRequest('This coupon has expired.', 'coupon_expired');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    throw badRequest('This coupon has reached its usage limit.', 'coupon_exhausted');
  }
  if (itemsTotal < coupon.min_order) {
    throw badRequest(`Add items worth ₹${coupon.min_order - itemsTotal} more to use this coupon.`, 'coupon_min_order', { minOrder: coupon.min_order });
  }
  if (coupon.first_order_only) {
    const e = String(email || '').trim().toLowerCase();
    const p = normalizePhone(phone);
    if (!e && !p) throw badRequest('Enter your email and phone to use this first-order coupon.', 'coupon_needs_contact');
    const prior = await one(
      `SELECT 1 FROM orders WHERE (($1 <> '' AND lower(email) = $1) OR ($2 <> '' AND phone = $2))
         AND (payment_status = 'paid' OR (payment_method = 'cod' AND fulfillment_status <> 'cancelled'))
       LIMIT 1`,
      [e, p],
      client,
    );
    if (prior) throw badRequest('This coupon is only for your first order.', 'coupon_first_order');
  }
}

/** Read-only check used by POST /api/coupons/check. */
export async function checkCoupon({ code, itemsTotal, email, phone }) {
  const coupon = await one('SELECT * FROM coupons WHERE upper(code) = upper($1)', [code.trim()]);
  await assertUsable(coupon, { itemsTotal, email, phone });
  return {
    code: coupon.code,
    description: coupon.description,
    discount: computeDiscount(coupon, itemsTotal),
    type: coupon.type,
    value: coupon.value,
  };
}

/**
 * Inside placeOrder's transaction: lock the coupon row so the usage limit cannot be
 * overshot, validate, and count the use.
 */
export async function applyCouponLocked(client, code, ctx) {
  const coupon = await one('SELECT * FROM coupons WHERE upper(code) = upper($1) FOR UPDATE', [code.trim()], client);
  await assertUsable(coupon, ctx, client);
  const discount = computeDiscount(coupon, ctx.itemsTotal);
  await query('UPDATE coupons SET used_count = used_count + 1, updated_at = now() WHERE id = $1', [coupon.id], client);
  return { coupon, discount };
}
