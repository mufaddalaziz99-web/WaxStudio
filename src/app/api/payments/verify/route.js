import { after } from 'next/server';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { verifyPayment } from '@/lib/server/orders';
import { runConfirmedFollowUps } from '@/lib/server/fulfillment';
import { refreshProducts } from '@/lib/server/revalidate';
import { verifyPaymentSchema } from '@/lib/validation';
import { many } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// Fast path: the browser posts the Checkout.js result so the customer sees success instantly.
// The Razorpay webhook is the authoritative path; both end in markOrderPaid().
export const POST = route(async (req) => {
  rateLimit(req, 'verify', 30, 10 * 60_000);
  const input = verifyPaymentSchema.parse(await readJson(req));
  const r = await verifyPayment(input);
  if (r.transitioned) {
    if (r.outcome === 'restored') {
      const items = await many('SELECT product_id FROM order_items WHERE order_id = $1', [r.order.id]);
      await refreshProducts(items.map((i) => i.product_id));
    }
    after(() => runConfirmedFollowUps(r.order.id));
  }
  return { status: r.status, orderId: r.order.id, orderNumber: r.order.order_number };
});
