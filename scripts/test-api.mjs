// npm run test:api — end-to-end API checks against a running dev server + LOCAL database.
// Covers: catalog lookup, shipping fallback, coupons, COD order, idempotency, stock race,
// tracking privacy, cancel + restock, authorization, expiry sweep, webhook auth.
import { ADDRESS, assert, check, db, done, eq, getProduct, http, placeOrder, serverUp, stockOf, uuid } from './_testkit.mjs';

await serverUp();
const { product, variants } = await getProduct();
const v = variants[0];
const line = (qty = 1, variantId = v.id) => [{ productId: product.id, variantId, quantity: qty }];

console.log('Catalog & cart');
await check('lookup returns live price/stock', async () => {
  const r = await http('/api/products/lookup', { method: 'POST', body: { items: [{ productId: product.id, variantId: v.id }] } });
  eq(r.status, 200);
  eq(r.data.items[0].price, v.price ?? product.price, 'price');
  assert(r.data.items[0].available, 'available');
});
await check('lookup marks unknown product unavailable', async () => {
  const r = await http('/api/products/lookup', { method: 'POST', body: { items: [{ productId: uuid(), variantId: null }] } });
  eq(r.data.items[0].available, false);
});
await check('product page renders', async () => {
  const r = await http(`/product/${product.slug}`);
  eq(r.status, 200);
  assert(String(r.data).includes('application/ld+json'), 'JSON-LD present');
});

console.log('Shipping & coupons');
await check('shipping quote returns options', async () => {
  const r = await http('/api/shipping/quote', { method: 'POST', body: { pincode: '400001', items: line(1) } });
  eq(r.status, 200);
  assert(r.data.options.length > 0, 'has options');
});
await check('free shipping above threshold', async () => {
  const r = await http('/api/shipping/quote', { method: 'POST', body: { pincode: '400001', items: line(3) } });
  assert(r.data.itemsTotal >= r.data.freeShippingThreshold, 'over threshold');
  eq(r.data.options.find((o) => o.kind === 'standard').price, 0, 'standard is free');
});
await check('invalid pincode → 400 naming the field', async () => {
  const r = await http('/api/shipping/quote', { method: 'POST', body: { pincode: '12', items: line(1) } });
  eq(r.status, 400);
  eq(r.data.field, 'pincode');
});
await check('coupon check computes discount on items only', async () => {
  const r = await http('/api/coupons/check', { method: 'POST', body: { code: 'welcome10', itemsTotal: 1000, email: `new-${uuid()}@example.test`, phone: '' } });
  eq(r.status, 200);
  eq(r.data.coupon.discount, 100);
});
await check('unknown coupon rejected', async () => {
  const r = await http('/api/coupons/check', { method: 'POST', body: { code: 'NOPE123', itemsTotal: 1000 } });
  eq(r.status, 400);
  eq(r.data.code, 'coupon_invalid');
});

console.log('Orders');
let codOrder;
await check('COD order places, reserves stock, starts confirmed', async () => {
  const before = await stockOf(v.id);
  const r = await placeOrder({ items: line(2) });
  eq(r.status, 200, JSON.stringify(r.data));
  codOrder = r.data;
  eq(r.data.status, 'confirmed');
  eq(r.data.paymentMethod, 'cod');
  eq(await stockOf(v.id), before - 2, 'stock decremented');
  const { rows } = await db.query('SELECT name, price, quantity FROM order_items WHERE order_id = $1', [r.data.orderId]);
  eq(rows.length, 1);
  eq(rows[0].price, v.price ?? product.price, 'price snapshot from server');
});
await check('server ignores client prices (only ids + qty are used)', async () => {
  const r = await placeOrder({ items: [{ ...line(1)[0], price: 1 }] });
  eq(r.status, 200);
  assert(r.data.total > 1, 'total from server prices');
});
await check('idempotency: same clientRequestId returns the same order', async () => {
  const id = uuid();
  const before = await stockOf(v.id);
  const [a, b] = await Promise.all([placeOrder({ items: line(1), clientRequestId: id }), placeOrder({ items: line(1), clientRequestId: id })]);
  eq(a.status, 200, JSON.stringify(a.data));
  eq(b.status, 200, JSON.stringify(b.data));
  eq(a.data.orderId, b.data.orderId, 'same order');
  eq(await stockOf(v.id), before - 1, 'stock decremented once');
});
await check('online payment refused when Razorpay is not configured', async () => {
  if (process.env.RAZORPAY_KEY_ID) return;
  const r = await placeOrder({ items: line(1), paymentMethod: 'razorpay' });
  eq(r.status, 400);
  eq(r.data.code, 'razorpay_unavailable');
});
await check('stock race: two buyers for the last unit → exactly one wins', async () => {
  const original = await stockOf(v.id);
  await db.query('UPDATE product_variants SET stock = 1 WHERE id = $1', [v.id]);
  try {
    const results = await Promise.all([placeOrder({ items: line(1) }), placeOrder({ items: line(1) })]);
    const ok = results.filter((r) => r.status === 200);
    const sold = results.filter((r) => r.status === 409);
    eq(ok.length, 1, 'one success');
    eq(sold.length, 1, 'one out_of_stock');
    eq(sold[0].data.code, 'out_of_stock');
    eq(await stockOf(v.id), 0, 'stock never negative');
  } finally {
    await db.query('UPDATE product_variants SET stock = $2 WHERE id = $1', [v.id, original]);
  }
});
await check('missing variant for a product with variants → 409', async () => {
  const r = await placeOrder({ items: [{ productId: product.id, variantId: null, quantity: 1 }] });
  eq(r.status, 409);
  eq(r.data.code, 'variant_required');
});

console.log('Tracking privacy');
await check('track with right number + phone works', async () => {
  const r = await http('/api/orders/track', { method: 'POST', body: { orderNumber: codOrder.orderNumber, phone: ADDRESS.phone } });
  eq(r.status, 200, JSON.stringify(r.data));
});
await check('wrong phone and wrong number give the same answer', async () => {
  const a = await http('/api/orders/track', { method: 'POST', body: { orderNumber: codOrder.orderNumber, phone: '9000000000' } });
  const b = await http('/api/orders/track', { method: 'POST', body: { orderNumber: 'WAX-999999', phone: ADDRESS.phone } });
  eq(a.status, b.status);
  eq(a.data.error, b.data.error);
});

console.log('Cancel');
await check('customer cancel restocks and is idempotent', async () => {
  const before = await stockOf(v.id);
  const r = await http(`/api/orders/${codOrder.orderId}/cancel`, { method: 'POST', body: { reason: 'Ordered by mistake' } });
  eq(r.status, 200, JSON.stringify(r.data));
  eq(r.data.order.status, 'cancelled');
  eq(await stockOf(v.id), before + 2, 'restocked');
  const again = await http(`/api/orders/${codOrder.orderId}/cancel`, { method: 'POST', body: { reason: 'again' } });
  eq(again.status, 400);
  eq(await stockOf(v.id), before + 2, 'not restocked twice');
});

console.log('Authorization');
await check('admin API requires sign-in', async () => {
  const r = await http('/api/admin/orders');
  assert([401, 403].includes(r.status), `got ${r.status}`);
});
await check('account API requires sign-in', async () => {
  const r = await http('/api/account/saved');
  eq(r.status, 401);
});
await check('cron requires bearer secret', async () => {
  const r = await http('/api/cron/release-expired-orders');
  eq(r.status, 401);
});
await check('razorpay webhook rejects bad signature', async () => {
  const r = await http('/api/webhooks/razorpay', { method: 'POST', raw: '{"event":"payment.captured"}', headers: { 'x-razorpay-signature': 'bad', 'Content-Type': 'application/json' } });
  eq(r.status, 400);
});
await check('courier webhook rejects missing token', async () => {
  const r = await http('/api/webhooks/courier', { method: 'POST', body: { awb: '1' } });
  eq(r.status, 401);
});

console.log('Expiry sweep');
await check('unpaid online order older than 15 min is cancelled and restocked', async () => {
  const before = await stockOf(v.id);
  const id = uuid();
  const { rows: [o] } = await db.query(
    `INSERT INTO orders (order_number, client_request_id, name, email, phone, shipping_address, items_total, total,
       payment_method, payment_status, fulfillment_status, shipping_option_id, created_at)
     VALUES ($1,$2,'Exp','exp@example.test','9876543210',$3,299,299,'razorpay','pending','placed','flat_standard', now() - interval '20 minutes')
     RETURNING id`,
    [`TEST-${Date.now()}`, id, JSON.stringify(ADDRESS)],
  );
  await db.query(`INSERT INTO order_items (order_id, product_id, variant_id, name, price, quantity, line_total) VALUES ($1,$2,$3,'x',299,1,299)`, [o.id, product.id, v.id]);
  await db.query('UPDATE product_variants SET stock = stock - 1 WHERE id = $1', [v.id]);
  const r = await http('/api/cron/release-expired-orders', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  eq(r.status, 200, JSON.stringify(r.data));
  const { rows: [after] } = await db.query('SELECT fulfillment_status, expired FROM orders WHERE id = $1', [o.id]);
  eq(after.fulfillment_status, 'cancelled');
  eq(after.expired, true);
  eq(await stockOf(v.id), before, 'stock returned');
});
await check('COD orders are never touched by the sweep', async () => {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM orders WHERE payment_method = 'cod' AND expired`);
  eq(rows[0].n, 0);
});

await done();
