import { after } from 'next/server';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { getSessionUser } from '@/lib/server/auth';
import { placeOrder, publicOrder } from '@/lib/server/orders';
import { runConfirmedFollowUps } from '@/lib/server/fulfillment';
import { refreshProducts } from '@/lib/server/revalidate';

export const dynamic = 'force-dynamic';

// POST /api/orders → placeOrder(). Guests allowed. 15 per 10 minutes per IP.
export const POST = route(async (req) => {
  rateLimit(req, 'orders', 15, 10 * 60_000);
  const body = await readJson(req);
  const user = await getSessionUser();
  const { order, created, razorpay, productIds } = await placeOrder(body, { user });

  if (created) await refreshProducts(productIds || []);
  if (created && order.payment_method === 'cod') {
    after(() => runConfirmedFollowUps(order.id));
  }
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    status: order.fulfillment_status,
    total: order.total,
    created,
    razorpay: razorpay || null,
    order: publicOrder(order),
  };
});
