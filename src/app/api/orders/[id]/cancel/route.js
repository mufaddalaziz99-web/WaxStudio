import { after } from 'next/server';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { getSessionUser } from '@/lib/server/auth';
import { customerCancelOrder, getOrderWithDetails, publicOrder } from '@/lib/server/orders';
import { sendCancellationEmail } from '@/lib/server/orderEmails';
import { refreshProducts } from '@/lib/server/revalidate';
import { cancelOrderSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// Customer cancel while confirmed or packed, with a reason.
export const POST = route(async (req, { params }) => {
  rateLimit(req, 'cancel', 10, 10 * 60_000);
  const { id } = await params;
  const { reason } = cancelOrderSchema.parse(await readJson(req));
  const user = await getSessionUser();
  const { order, productIds } = await customerCancelOrder(id, { reason, user });
  await refreshProducts(productIds);
  after(() => sendCancellationEmail(order.id).catch((e) => console.error('[cancel email]', e.message)));
  return { order: publicOrder(await getOrderWithDetails(order.id)) };
});
