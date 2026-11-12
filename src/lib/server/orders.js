import 'server-only';
import { many, one, query, withTransaction } from './db';
import { env } from './env';
import { HttpError, badRequest, conflict, notFound } from './http';
import { getSettings } from './settings';
import { getShippingQuote, finalizeOptions } from './shipping';
import { applyCouponLocked } from './coupons';
import { addHistory, cancelAndRestock, lockStockRows, markOrderPaid, maybeReleaseExpiredOrders } from './orderHelpers';
import { createRazorpayOrder, fetchPayment, toPaise, verifyCheckoutSignature } from './razorpay';
import { mergeLines } from '../cartLine';
import { placeOrderSchema } from '../validation';
import { codFeeFor, isCodAllowed } from '../shippingRules';
import { CUSTOMER_CANCELLABLE, ADMIN_CANCELLABLE, isForward, stepIndex } from '../orderRules';

// ===========================================================================
// 1. Place the order — the order is created in our DB first (stock reserved),
//    and only then does the customer pay.
// ===========================================================================

/**
 * @returns {Promise<{ order, created: boolean, razorpay?: object }>}
 */
export async function placeOrder(body, { user } = {}) {
  const input = placeOrderSchema.parse(body);
  const items = mergeLines(input.items);

  // Free abandoned stock before we check availability.
  await maybeReleaseExpiredOrders();

  // Idempotency: a double-click or network retry never creates a second order.
  const existing = await one('SELECT * FROM orders WHERE client_request_id = $1', [input.clientRequestId]);
  if (existing) return resumeExisting(existing);

  const settings = await getSettings();
  if (settings.checkout.holidayMode) {
    throw new HttpError(503, settings.checkout.holidayMessage || 'Orders are paused right now.', 'holiday_mode');
  }
  if (input.paymentMethod === 'razorpay' && !env.hasRazorpay) {
    throw badRequest('Online payment is not available right now. Please choose Cash on Delivery.', 'razorpay_unavailable');
  }
  if (input.paymentMethod === 'cod' && !settings.payments.codEnabled) {
    throw badRequest('Cash on Delivery is not available.', 'cod_unavailable');
  }

  // Shipping quote OUTSIDE the transaction — no external HTTP while rows are locked.
  const quote = await getShippingQuote({ pincode: input.address.pincode, items, settings, recordCheck: null });
  if (!quote.serviceable) throw badRequest('Sorry, we do not deliver to this pincode yet.', 'unserviceable');

  let order;
  try {
    order = await withTransaction(async (client) => {
      // Lock product rows then variant rows in id order (deadlock-safe).
      const { products, variants } = await lockStockRows(client, items);

      // Check stock per line and compute itemsTotal from server prices.
      const lines = [];
      for (const it of items) {
        const p = products.get(it.productId);
        if (!p || p.is_hidden) throw conflict('An item in your cart is no longer available.', 'item_unavailable', { productId: it.productId });
        const productVariants = await many('SELECT id FROM product_variants WHERE product_id = $1 AND is_hidden = false', [p.id], client);
        let price;
        let stock;
        let variant = null;
        if (productVariants.length) {
          variant = it.variantId ? variants.get(it.variantId) : null;
          if (!variant || variant.product_id !== p.id || variant.is_hidden) {
            throw conflict('Please choose an option for an item in your cart.', 'variant_required', { productId: p.id });
          }
          price = variant.price ?? p.price;
          stock = variant.stock;
        } else {
          if (it.variantId) throw conflict('An option in your cart is no longer available.', 'item_unavailable', { productId: p.id });
          price = p.price;
          stock = p.stock;
        }
        if (it.quantity > p.max_per_order) {
          throw conflict(`You can order at most ${p.max_per_order} of ${p.name}.`, 'max_per_order', { productId: p.id, max: p.max_per_order });
        }
        if (stock < it.quantity) {
          throw conflict(
            stock > 0 ? `Only ${stock} left of ${p.name}${variant ? ` (${variant.name})` : ''}.` : `${p.name}${variant ? ` (${variant.name})` : ''} just sold out.`,
            'out_of_stock',
            { productId: p.id, variantId: variant?.id || null, available: stock },
          );
        }
        lines.push({ product: p, variant, quantity: it.quantity, price });
      }
      const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

      // Recompute shipping options against the locked server total; match the chosen option.
      const options = finalizeOptions(
        quote.options.map((o) => ({ ...o, price: o.originalPrice ?? o.price, etaText: o.etaText })),
        itemsTotal,
        settings,
      );
      const shipping = options.find((o) => o.id === input.shippingOptionId);
      if (!shipping) throw conflict('Shipping options changed. Please choose again.', 'shipping_changed');

      // Coupon (row locked so the usage limit cannot be overshot).
      let discount = 0;
      let coupon = null;
      if (input.couponCode) {
        ({ coupon, discount } = await applyCouponLocked(client, input.couponCode, {
          itemsTotal, email: input.address.email, phone: input.address.phone,
        }));
      }

      // COD fee + availability.
      let codFee = 0;
      if (input.paymentMethod === 'cod') {
        if (!shipping.cod) throw badRequest('The selected courier cannot collect cash. Choose another option or pay online.', 'cod_not_supported');
        codFee = codFeeFor(itemsTotal - discount, settings.payments);
      }
      const giftWrapFee = input.gift.isGift && input.gift.wrap ? Number(settings.checkout.giftWrapFee) || 0 : 0;
      const total = itemsTotal - discount + shipping.price + codFee + giftWrapFee;
      if (input.paymentMethod === 'cod' && !isCodAllowed(total, settings.payments)) {
        throw badRequest(`Cash on Delivery is available for orders up to ₹${settings.payments.codMaxOrder}.`, 'cod_limit');
      }

      // Decrement stock.
      for (const l of lines) {
        if (l.variant) {
          await query('UPDATE product_variants SET stock = stock - $2 WHERE id = $1', [l.variant.id, l.quantity], client);
        } else {
          await query('UPDATE products SET stock = stock - $2, updated_at = now() WHERE id = $1', [l.product.id, l.quantity], client);
        }
      }

      const { nextval } = await one("SELECT nextval('order_number_seq') AS nextval", [], client);
      const orderNumber = `${env.orderPrefix}-${nextval}`;
      const isCod = input.paymentMethod === 'cod';
      const a = input.address;
      const created = await one(
        `INSERT INTO orders (order_number, client_request_id, user_id, name, email, phone, shipping_address,
           items_total, discount, coupon_id, coupon_code, shipping_fee, cod_fee, gift_wrap_fee, total,
           payment_method, payment_status, fulfillment_status, shipping_option_id, shipping_option,
           shiprocket_courier_id, courier_name, is_gift, gift_wrap, gift_message, customer_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING *`,
        [orderNumber, input.clientRequestId, user?.id || null, a.name, a.email, a.phone, JSON.stringify(a),
          itemsTotal, discount, coupon?.id || null, coupon?.code || null, shipping.price, codFee, giftWrapFee, total,
          input.paymentMethod, isCod ? 'confirmed' : 'placed', shipping.id,
          JSON.stringify({ ...shipping, package: quote.package, source: quote.source }),
          shipping.courierId || null, shipping.courierId ? shipping.courierName : null,
          input.gift.isGift, input.gift.isGift && input.gift.wrap, input.gift.isGift ? input.gift.message || null : null,
          input.note || null],
        client,
      );

      // Snapshot name, image, price and SKU so later product edits never change past orders.
      for (const l of lines) {
        const image = l.variant?.image || (Array.isArray(l.product.images) ? l.product.images[0] : null) || null;
        await query(
          `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, image, sku, hsn_code, tax_rate, price, quantity, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [created.id, l.product.id, l.variant?.id || null, l.product.name, l.variant?.name || null, image,
            l.variant?.sku || l.product.sku || null, l.product.hsn_code, l.product.tax_rate, l.price, l.quantity, l.price * l.quantity],
          client,
        );
      }
      await addHistory(client, created.id, isCod ? 'confirmed' : 'placed',
        isCod ? 'Order placed (Cash on Delivery)' : 'Order placed, awaiting payment', 'customer');

      if (input.saveAddress && user) {
        const dup = await one(
          'SELECT id FROM addresses WHERE user_id = $1 AND line1 = $2 AND pincode = $3',
          [user.id, a.line1, a.pincode],
          client,
        );
        if (!dup) {
          const hasAny = await one('SELECT 1 FROM addresses WHERE user_id = $1 LIMIT 1', [user.id], client);
          await query(
            `INSERT INTO addresses (user_id, name, phone, email, line1, line2, landmark, city, state, pincode, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [user.id, a.name, a.phone, a.email, a.line1, a.line2, a.landmark, a.city, a.state, a.pincode, !hasAny],
            client,
          );
        }
      }
      if (user && !user.phone) await query('UPDATE users SET phone = $2 WHERE id = $1 AND phone IS NULL', [user.id, a.phone], client);
      return created;
    });
  } catch (e) {
    // A concurrent duplicate submit hits the unique client_request_id: return the existing order.
    if (e.code === '23505' && String(e.constraint || '').includes('client_request_id')) {
      const dup = await one('SELECT * FROM orders WHERE client_request_id = $1', [input.clientRequestId]);
      if (dup) return resumeExisting(dup);
    }
    throw e;
  }

  const productIds = items.map((i) => i.productId);
  if (order.payment_method === 'cod') return { order, created: true, productIds };
  const razorpay = await ensureRazorpayOrder(order);
  return { order, created: true, razorpay, productIds };
}

async function resumeExisting(order) {
  if (order.fulfillment_status === 'cancelled') {
    throw conflict('This checkout has expired. Please place the order again.', 'order_expired', { orderId: order.id });
  }
  if (order.payment_method === 'razorpay' && order.payment_status === 'pending') {
    // If creating the Razorpay order failed earlier, a retry resumes here.
    const razorpay = await ensureRazorpayOrder(order);
    return { order, created: false, razorpay };
  }
  return { order, created: false };
}

/** Creates (once) the Razorpay order for our order and returns what Checkout.js needs. */
export async function ensureRazorpayOrder(order) {
  let rzpOrderId = order.razorpay_order_id;
  if (!rzpOrderId) {
    const rzp = await createRazorpayOrder({
      amountRupees: order.total,
      receipt: order.order_number,
      notes: { order_id: order.id, order_number: order.order_number },
    });
    const saved = await one(
      `UPDATE orders SET razorpay_order_id = $2, updated_at = now() WHERE id = $1 AND razorpay_order_id IS NULL RETURNING razorpay_order_id`,
      [order.id, rzp.id],
    );
    rzpOrderId = saved?.razorpay_order_id || (await one('SELECT razorpay_order_id FROM orders WHERE id = $1', [order.id])).razorpay_order_id;
  }
  const settings = await getSettings();
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: rzpOrderId,
    amount: toPaise(order.total),
    currency: 'INR',
    name: settings.store.name,
    prefill: { name: order.name, email: order.email, contact: `+91${order.phone}` },
    color: settings.store.brandColor,
  };
}

// ===========================================================================
// 3. Verify — browser fast path. The webhook (authoritative) lives in the route.
// ===========================================================================

/**
 * @returns {{ status: 'paid'|'processing', order, transitioned }}
 */
export async function verifyPayment({ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw notFound('Order not found');
  // Anti-replay: the Razorpay order id must belong to this order.
  if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
    throw badRequest('Payment does not match this order.', 'order_mismatch');
  }
  if (!verifyCheckoutSignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
    throw badRequest('Payment signature is invalid.', 'bad_signature');
  }
  if (order.payment_status === 'paid') return { status: 'paid', order, transitioned: false };

  const payment = await fetchPayment(razorpay_payment_id);
  if (payment.order_id !== razorpay_order_id) throw badRequest('Payment does not match this order.', 'order_mismatch');
  if (Number(payment.amount) !== toPaise(order.total)) {
    console.error('[verify] amount mismatch', order.order_number, payment.amount, order.total);
    throw badRequest('Payment amount does not match the order total.', 'amount_mismatch');
  }
  if (payment.status === 'authorized') return { status: 'processing', order, transitioned: false };
  if (payment.status !== 'captured') throw badRequest('Payment was not completed.', 'payment_not_captured');

  const r = await markOrderPaid(order.id, { paymentId: razorpay_payment_id, signature: razorpay_signature, source: 'checkout' });
  return { status: r.order.payment_status === 'paid' ? 'paid' : 'processing', order: r.order, transitioned: r.transitioned, outcome: r.outcome };
}

// ===========================================================================
// Reading orders
// ===========================================================================

export async function getOrderWithDetails(orderId, { includePrivateHistory = false } = {}) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return null;
  order.items = await many('SELECT * FROM order_items WHERE order_id = $1 ORDER BY name', [orderId]);
  order.history = await many(
    `SELECT status, note, actor, created_at FROM order_status_history WHERE order_id = $1 ${includePrivateHistory ? '' : 'AND is_public'} ORDER BY created_at, id`,
    [orderId],
  );
  order.refunds = await many('SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at', [orderId]);
  order.issues = await many('SELECT id, type, description, images, status, admin_note, created_at FROM order_issues WHERE order_id = $1 ORDER BY created_at', [orderId]);
  return order;
}

/** Customer-safe projection of an order (used by confirmation, account and tracking pages). */
export function publicOrder(o) {
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.order_number,
    createdAt: o.created_at,
    name: o.name,
    email: o.email,
    phone: o.phone,
    address: o.shipping_address,
    itemsTotal: o.items_total,
    discount: o.discount,
    couponCode: o.coupon_code,
    shippingFee: o.shipping_fee,
    codFee: o.cod_fee,
    giftWrapFee: o.gift_wrap_fee,
    total: o.total,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    status: o.fulfillment_status,
    expired: o.expired,
    cancelReason: o.cancel_reason,
    shippingOption: o.shipping_option ? { label: o.shipping_option.label, courierName: o.shipping_option.courierName, etaText: o.shipping_option.etaText } : null,
    courierName: o.courier_name,
    awbCode: o.awb_code,
    trackingUrl: o.tracking_url,
    isGift: o.is_gift,
    giftWrap: o.gift_wrap,
    giftMessage: o.gift_message,
    deliveredAt: o.delivered_at,
    reviewToken: o.fulfillment_status === 'delivered' ? o.review_token : null,
    items: (o.items || []).map((i) => ({
      id: i.id, productId: i.product_id, variantId: i.variant_id, name: i.name, variantName: i.variant_name,
      image: i.image, price: i.price, quantity: i.quantity, lineTotal: i.line_total,
    })),
    history: (o.history || []).map((h) => ({ status: h.status, note: h.note, at: h.created_at })),
    refunds: (o.refunds || []).map((r) => ({ amount: r.amount, status: r.status, at: r.created_at })),
    issues: (o.issues || []).map((i) => ({ id: i.id, type: i.type, status: i.status, createdAt: i.created_at })),
  };
}

export async function listUserOrders(userId) {
  return many(
    `SELECT o.id, o.order_number, o.created_at, o.total, o.payment_method, o.payment_status, o.fulfillment_status,
       (SELECT json_agg(json_build_object('name', i.name, 'variantName', i.variant_name, 'image', i.image, 'quantity', i.quantity))
          FROM order_items i WHERE i.order_id = o.id) AS items
     FROM orders o WHERE o.user_id = $1 OR (o.user_id IS NULL AND lower(o.email) = (SELECT lower(email) FROM users WHERE id = $1))
     ORDER BY o.created_at DESC LIMIT 100`,
    [userId],
  );
}

/**
 * Guest tracking by order number + phone. The same "not found" answer is given for a wrong
 * number or a wrong phone, so the endpoint cannot be used to probe which orders exist.
 */
export async function trackOrder({ orderNumber, phone }) {
  const order = await one('SELECT id, phone FROM orders WHERE upper(order_number) = $1', [orderNumber]);
  if (!order || order.phone !== phone) throw notFound('No order matches that order number and phone.', 'track_not_found');
  return getOrderWithDetails(order.id);
}

// ===========================================================================
// Cancellation (customer + admin) — restock, cancel Shiprocket, refund, email.
// ===========================================================================

export async function cancelOrder(orderId, { reason, actor = 'admin', refund = true, restock = true, allowed = ADMIN_CANCELLABLE }) {
  const pre = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!pre) throw notFound('Order not found');
  if (pre.fulfillment_status === 'cancelled') throw badRequest('This order is already cancelled.', 'already_cancelled');
  if (!allowed.includes(pre.fulfillment_status)) {
    throw badRequest('This order can no longer be cancelled.', 'not_cancellable');
  }
  const r = await cancelAndRestock(orderId, { reason, actor, restock });
  if (!r.cancelled) throw badRequest('This order can no longer be cancelled.', 'not_cancellable');
  const order = r.order;

  // External calls only after commit.
  const notes = [];
  if (order.shiprocket_order_id && env.hasShiprocket) {
    try {
      const { cancelShiprocketOrder } = await import('./shiprocket');
      await cancelShiprocketOrder(order.shiprocket_order_id);
      notes.push('Shiprocket order cancelled');
    } catch (e) {
      notes.push(`Shiprocket cancel failed: ${e.message}`);
    }
  }
  if (refund && order.payment_method === 'razorpay' && order.payment_status === 'paid') {
    try {
      const { refundRemaining } = await import('./refunds');
      await refundRemaining(order, { reason: `Cancelled: ${reason}`, by: actor });
      notes.push('Full refund initiated');
    } catch (e) {
      notes.push(`Refund failed: ${e.message}`);
      await query('UPDATE orders SET refund_required = true WHERE id = $1', [order.id]);
    }
  }
  if (notes.length) await addHistory(null, order.id, 'cancelled', notes.join(' · '), 'system', false);
  return { order, productIds: r.productIds || [] };
}

export async function customerCancelOrder(orderId, { reason, user, email }) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw notFound('Order not found');
  // Owner check: signed-in owner, or the guest who holds the unguessable order id.
  if (order.user_id && user?.id !== order.user_id && !user?.is_admin) {
    if (!email || email.toLowerCase() !== order.email.toLowerCase()) throw notFound('Order not found');
  }
  if (!CUSTOMER_CANCELLABLE.includes(order.fulfillment_status)) {
    throw badRequest('This order can no longer be cancelled online. Please contact us.', 'not_cancellable');
  }
  return cancelOrder(orderId, { reason, actor: 'customer', allowed: CUSTOMER_CANCELLABLE });
}

// ===========================================================================
// Fulfilment status changes (admin + courier webhook). Forward-only and idempotent.
// ===========================================================================

export async function setFulfillmentStatus(orderId, status, { note = '', actor = 'admin', force = false } = {}) {
  return withTransaction(async (client) => {
    const order = await one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId], client);
    if (!order) throw notFound('Order not found');
    if (order.fulfillment_status === 'cancelled') return { changed: false, order };
    if (order.fulfillment_status === status) return { changed: false, order };
    if (!force && !isForward(order.fulfillment_status, status)) return { changed: false, order };
    if (order.fulfillment_status === 'placed' && order.payment_status !== 'paid') {
      throw badRequest('This order has not been paid yet.', 'unpaid');
    }
    const sets = ['fulfillment_status = $2', 'updated_at = now()'];
    if (status === 'delivered') {
      sets.push('delivered_at = COALESCE(delivered_at, now())');
      // COD becomes paid on delivery.
      if (order.payment_method === 'cod' && order.payment_status === 'pending') sets.push("payment_status = 'paid', paid_at = now()");
    }
    const updated = await one(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, [orderId, status], client);
    await addHistory(client, orderId, status, note || null, actor);
    return { changed: true, order: updated };
  });
}

// Shiprocket status -> our step. Unmapped (RTO, NDR, lost, ...) are recorded but never move the order.
const COURIER_STATUS_MAP = {
  'PICKED UP': 'shipped', 'SHIPPED': 'shipped', 'IN TRANSIT': 'shipped', 'IN-TRANSIT': 'shipped',
  'REACHED AT DESTINATION HUB': 'shipped', 'REACHED DESTINATION HUB': 'shipped', 'MISROUTED': null,
  'OUT FOR DELIVERY': 'out_for_delivery', 'DELIVERED': 'delivered',
  'PICKUP SCHEDULED': null, 'PICKUP GENERATED': null, 'OUT FOR PICKUP': null, 'MANIFEST GENERATED': null,
};

export function mapCourierStatus(raw) {
  const k = String(raw || '').trim().toUpperCase();
  if (k in COURIER_STATUS_MAP) return COURIER_STATUS_MAP[k];
  if (/^RTO|NDR|LOST|DAMAGED|DESTROYED|UNDELIVERED|CANCEL/.test(k)) return null;
  if (k.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (k.includes('DELIVERED')) return 'delivered';
  if (k.includes('TRANSIT') || k.includes('PICKED')) return 'shipped';
  return null;
}

/** Apply one courier tracking event (forward-only, idempotent). */
export async function applyCourierStatus({ awb, orderNumber, rawStatus, location, eventTime, payload }) {
  const order = await one(
    'SELECT id, fulfillment_status FROM orders WHERE ($1::text IS NOT NULL AND awb_code = $1) OR ($2::text IS NOT NULL AND order_number = $2) LIMIT 1',
    [awb || null, orderNumber || null],
  );
  if (!order) return { matched: false };
  const mapped = mapCourierStatus(rawStatus);
  const inserted = await one(
    `INSERT INTO shipment_events (order_id, awb, status, raw_status, location, event_time, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [order.id, awb || null, mapped, String(rawStatus || 'UNKNOWN'), location || null, eventTime || null, payload ? JSON.stringify(payload) : null],
  );
  if (!inserted) return { matched: true, duplicate: true };
  if (!mapped || stepIndex(mapped) <= stepIndex(order.fulfillment_status)) {
    if (!mapped) await addHistory(null, order.id, order.fulfillment_status, `Courier: ${rawStatus}${location ? ` (${location})` : ''}`, 'courier', false);
    return { matched: true, changed: false };
  }
  const r = await setFulfillmentStatus(order.id, mapped, { note: `Courier: ${rawStatus}${location ? ` · ${location}` : ''}`, actor: 'courier' });
  return { matched: true, changed: r.changed, status: mapped, orderId: order.id };
}
