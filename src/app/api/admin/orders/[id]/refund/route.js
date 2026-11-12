import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId, requireOrder } from '@/lib/server/admin';
import { createRefund } from '@/lib/server/refunds';
import { refundInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST { amount, reason, manual } — full or partial; through Razorpay or recorded manually.
export const POST = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const input = refundInputSchema.parse(await readJson(req));
  const order = await requireOrder(id);
  const refund = await createRefund(order, { amount: input.amount, reason: input.reason, manual: input.manual, by: 'admin' });
  return { ok: true, refund };
});
