import { after } from 'next/server';
import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { cancelOrder } from '@/lib/server/orders';
import { sendCancellationEmail } from '@/lib/server/orderEmails';
import { refreshProducts } from '@/lib/server/revalidate';
import { adminCancelSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST { reason, refund, restock } — any time before delivery.
export const POST = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const { reason, refund, restock } = adminCancelSchema.parse(await readJson(req));
  const { order, productIds } = await cancelOrder(id, { reason, actor: 'admin', refund, restock });
  after(() => sendCancellationEmail(id).catch((e) => console.error('[admin] cancel email', e.message)));
  if (productIds.length) await refreshProducts(productIds).catch(() => {});
  return { ok: true, paymentStatus: order.payment_status };
});
