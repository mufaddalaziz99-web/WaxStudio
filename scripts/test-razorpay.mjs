// npm run test:razorpay — payment-state checks through the Razorpay WEBHOOK path, signed locally
// with RAZORPAY_WEBHOOK_SECRET (no real Razorpay account needed). LOCAL database only.
// Covers: paid transition, replay no-op, amount mismatch, payment.failed recorded only,
// late payment restores an expired order, late payment with stock gone → REFUND REQUIRED,
// refund webhook, bad signature.
import crypto from 'node:crypto';
import { ADDRESS, assert, check, db, done, eq, getProduct, http, serverUp, stockOf, uuid } from './_testkit.mjs';

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!secret) {
  console.error('Set RAZORPAY_WEBHOOK_SECRET in .env.local (any test value) and restart the dev server.');
  process.exit(1);
}
await serverUp();
const { product, variants } = await getProduct();
const v = variants[0];

async function makeOrder({ total = 299, status = 'placed', expired = false, qty = 1 } = {}) {
  const rzp = `order_test_${crypto.randomBytes(6).toString('hex')}`;
  const { rows: [o] } = await db.query(
    `INSERT INTO orders (order_number, client_request_id, name, email, phone, shipping_address, items_total, total,
       payment_method, payment_status, fulfillment_status, expired, razorpay_order_id, shipping_option_id)
     VALUES ($1,$2,'Pay Test','pay@example.test','9876543210',$3,$4,$4,'razorpay',$5,$6,$7,$8,'flat_standard') RETURNING id`,
    [`TEST-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, uuid(), JSON.stringify(ADDRESS), total,
      expired ? 'failed' : 'pending', status, expired, rzp],
  );
  await db.query(
    `INSERT INTO order_items (order_id, product_id, variant_id, name, price, quantity, line_total) VALUES ($1,$2,$3,'Test',$4,$5,$6)`,
    [o.id, product.id, v.id, total / qty, qty, total],
  );
  return { id: o.id, rzp };
}

function signed(event) {
  const raw = JSON.stringify(event);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return http('/api/webhooks/razorpay', { method: 'POST', raw, headers: { 'x-razorpay-signature': sig, 'Content-Type': 'application/json' } });
}
const captured = (rzp, amountRupees, payId = `pay_${crypto.randomBytes(6).toString('hex')}`) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: payId, order_id: rzp, amount: amountRupees * 100, status: 'captured' } } },
});
const orderRow = async (id) => (await db.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];

await check('payment.captured → confirmed + paid', async () => {
  const o = await makeOrder();
  const r = await signed(captured(o.rzp, 299));
  eq(r.status, 200, JSON.stringify(r.data));
  const row = await orderRow(o.id);
  eq(row.payment_status, 'paid');
  eq(row.fulfillment_status, 'confirmed');
});
await check('replayed webhook is a no-op', async () => {
  const o = await makeOrder();
  const evt = captured(o.rzp, 299, 'pay_replay1');
  await signed(evt);
  const r = await signed(evt);
  eq(r.data.outcome, 'already_paid');
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM order_status_history WHERE order_id = $1 AND note LIKE 'Payment received%'`, [o.id]);
  eq(rows[0].n, 1, 'one payment history row');
});
await check('amount mismatch does not mark paid', async () => {
  const o = await makeOrder({ total: 599 });
  await signed(captured(o.rzp, 1));
  eq((await orderRow(o.id)).payment_status, 'pending');
});
await check('payment.failed is recorded but does not cancel', async () => {
  const o = await makeOrder();
  await signed({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f', order_id: o.rzp, error_description: 'Card declined' } } } });
  const row = await orderRow(o.id);
  eq(row.fulfillment_status, 'placed');
  const { rows } = await db.query(`SELECT 1 FROM order_status_history WHERE order_id = $1 AND note LIKE '%Card declined%'`, [o.id]);
  eq(rows.length, 1);
});
await check('late payment after expiry restores the order when stock is available', async () => {
  const before = await stockOf(v.id);
  const o = await makeOrder({ status: 'cancelled', expired: true });
  await signed(captured(o.rzp, 299));
  const row = await orderRow(o.id);
  eq(row.fulfillment_status, 'confirmed');
  eq(row.payment_status, 'paid');
  eq(row.expired, false);
  eq(await stockOf(v.id), before - 1, 'stock re-reserved');
  await db.query('UPDATE product_variants SET stock = stock + 1 WHERE id = $1', [v.id]);
});
await check('late payment with stock gone → stays cancelled, REFUND REQUIRED', async () => {
  const original = await stockOf(v.id);
  await db.query('UPDATE product_variants SET stock = 0 WHERE id = $1', [v.id]);
  try {
    const o = await makeOrder({ status: 'cancelled', expired: true });
    await signed(captured(o.rzp, 299));
    const row = await orderRow(o.id);
    eq(row.fulfillment_status, 'cancelled');
    eq(row.payment_status, 'paid');
    eq(row.refund_required, true);
    eq(await stockOf(v.id), 0, 'stock untouched');
  } finally {
    await db.query('UPDATE product_variants SET stock = $2 WHERE id = $1', [v.id, original]);
  }
});
await check('unknown Razorpay order is ignored (200)', async () => {
  const r = await signed(captured('order_unknown', 299));
  eq(r.status, 200);
});
await check('refund.processed webhook updates refunds and payment status', async () => {
  const o = await makeOrder();
  await signed(captured(o.rzp, 299, 'pay_refund_test_' + Date.now()));
  const row = await orderRow(o.id);
  await signed({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_${Date.now()}`, payment_id: row.razorpay_payment_id, amount: 29900, status: 'processed' } } } });
  eq((await orderRow(o.id)).payment_status, 'refunded');
});
await check('verify endpoint rejects an order id mismatch', async () => {
  const o = await makeOrder();
  const r = await http('/api/payments/verify', { method: 'POST', body: { orderId: o.id, razorpay_order_id: 'order_other', razorpay_payment_id: 'pay_x', razorpay_signature: 'x' } });
  eq(r.status, 400);
  eq(r.data.code, 'order_mismatch');
});
await check('verify endpoint rejects a bad signature', async () => {
  const o = await makeOrder();
  const r = await http('/api/payments/verify', { method: 'POST', body: { orderId: o.id, razorpay_order_id: o.rzp, razorpay_payment_id: 'pay_x', razorpay_signature: 'bad' } });
  eq(r.status, 400);
  assert(['bad_signature', 'order_mismatch'].includes(r.data.code), r.data.code);
});
await check('bad webhook signature → 400', async () => {
  const r = await http('/api/webhooks/razorpay', { method: 'POST', raw: '{}', headers: { 'x-razorpay-signature': 'nope' } });
  eq(r.status, 400);
});

// Clean up test orders so they don't clutter the admin.
await db.query(`DELETE FROM orders WHERE order_number LIKE 'TEST-%'`);
await done();
