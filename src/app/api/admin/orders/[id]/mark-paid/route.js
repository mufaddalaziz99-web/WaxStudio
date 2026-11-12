import { after } from 'next/server';
import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { assertManualPayable, parseId, requireOrder } from '@/lib/server/admin';
import { markOrderPaid } from '@/lib/server/orderHelpers';
import { runConfirmedFollowUps } from '@/lib/server/fulfillment';

export const dynamic = 'force-dynamic';

// POST — record a payment received outside Razorpay checkout (e.g. UPI straight to the shop).
export const POST = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  assertManualPayable(await requireOrder(id));
  const r = await markOrderPaid(id, { paymentId: 'manual', source: 'admin' });
  if (r.transitioned) after(() => runConfirmedFollowUps(id));
  return { ok: true, outcome: r.outcome };
});
