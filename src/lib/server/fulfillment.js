import 'server-only';
import { many, one, query } from './db';
import { env } from './env';
import { getSettings } from './settings';
import { createOrder as srCreateOrder } from './shiprocket';
import { sendOrderConfirmationEmails } from './orderEmails';
import { bumpProductStat } from './insights';
import { lineKey } from '../cartLine';

/**
 * Create the order in Shiprocket (no courier booked yet). Claimed via shiprocket_order_id
 * so it runs once; errors are stored on the order for the admin to retry.
 */
export async function pushOrderToShiprocket(orderId) {
  if (!env.hasShiprocket) return { skipped: 'not_configured' };
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order || order.shiprocket_order_id || order.fulfillment_status === 'cancelled' || order.fulfillment_status === 'placed') {
    return { skipped: 'not_applicable' };
  }
  const items = await many('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  const settings = await getSettings();
  const a = order.shipping_address;
  const pkg = order.shipping_option?.package || {};
  const payload = {
    order_id: order.order_number,
    order_date: new Date(order.created_at).toISOString().slice(0, 16).replace('T', ' '),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: a.name.split(' ')[0],
    billing_last_name: a.name.split(' ').slice(1).join(' ') || '.',
    billing_address: a.line1,
    billing_address_2: [a.line2, a.landmark].filter(Boolean).join(', '),
    billing_city: a.city,
    billing_pincode: a.pincode,
    billing_state: a.state,
    billing_country: 'India',
    billing_email: order.email,
    billing_phone: order.phone,
    shipping_is_billing: true,
    order_items: items.map((i) => ({
      name: i.variant_name ? `${i.name} (${i.variant_name})` : i.name,
      sku: i.sku || i.id.slice(0, 8),
      units: i.quantity,
      // Gift orders leave prices out of the parcel paperwork.
      selling_price: order.is_gift ? 0 : i.price,
      hsn: i.hsn_code || undefined,
    })),
    payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: order.shipping_fee,
    total_discount: order.discount,
    sub_total: order.payment_method === 'cod' ? order.total : order.items_total - order.discount,
    length: pkg.length || settings.shipping.defaultLengthCm,
    breadth: pkg.breadth || settings.shipping.defaultBreadthCm,
    height: pkg.height || settings.shipping.defaultHeightCm,
    weight: pkg.weightKg || 0.3,
  };
  try {
    const res = await srCreateOrder(payload);
    await query(
      `UPDATE orders SET shiprocket_order_id = $2, shiprocket_shipment_id = $3, shiprocket_error = NULL, updated_at = now()
       WHERE id = $1 AND shiprocket_order_id IS NULL`,
      [orderId, String(res.order_id), res.shipment_id ? String(res.shipment_id) : null],
    );
    return { ok: true, shiprocketOrderId: res.order_id };
  } catch (e) {
    console.error('[shiprocket] push failed', order.order_number, e.message);
    await query('UPDATE orders SET shiprocket_error = $2, updated_at = now() WHERE id = $1', [orderId, e.message.slice(0, 500)]);
    return { ok: false, error: e.message };
  }
}

/** Remove bought lines from the customer's saved (synced) cart. */
async function clearSavedCartLines(order) {
  if (!order.user_id) return;
  const items = await many('SELECT product_id, variant_id FROM order_items WHERE order_id = $1', [order.id]);
  const bought = new Set(items.map((i) => lineKey(i.product_id, i.variant_id)));
  const user = await one('SELECT saved_cart FROM users WHERE id = $1', [order.user_id]);
  if (!user) return;
  const next = (user.saved_cart || []).filter((l) => !bought.has(lineKey(l.productId, l.variantId)));
  await query('UPDATE users SET saved_cart = $2, updated_at = now() WHERE id = $1', [order.user_id, JSON.stringify(next)]);
}

/**
 * Follow-up work after an order becomes confirmed (COD at placement, online on first payment).
 * Run it with after() so the customer isn't kept waiting. Each step is independently idempotent.
 */
export async function runConfirmedFollowUps(orderId) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order || order.fulfillment_status === 'cancelled') return;
  const steps = [
    ['shiprocket', () => pushOrderToShiprocket(orderId)],
    ['emails', () => sendOrderConfirmationEmails(orderId)],
    ['saved_cart', () => clearSavedCartLines(order)],
    ['insights', async () => {
      const items = await many('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const i of items) await bumpProductStat(i.product_id, 'purchases', i.quantity);
    }],
  ];
  for (const [name, fn] of steps) {
    try {
      await fn();
    } catch (e) {
      console.error(`[follow-up:${name}]`, order.order_number, e.message);
    }
  }
}
