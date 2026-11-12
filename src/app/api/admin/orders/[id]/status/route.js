import { after } from 'next/server';
import { route, readJson, badRequest } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { setFulfillmentStatus } from '@/lib/server/orders';
import { sendShippedEmail } from '@/lib/server/orderEmails';
import { adminStatusSchema } from '@/lib/validation';
import { STATUS_LABELS } from '@/lib/orderRules';

export const dynamic = 'force-dynamic';

// POST { status, note } — forward-only (confirmed → packed → shipped → out_for_delivery → delivered).
export const POST = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const { status, note } = adminStatusSchema.parse(await readJson(req));
  const r = await setFulfillmentStatus(id, status, { note, actor: 'admin' });
  if (!r.changed) {
    const current = r.order?.fulfillment_status;
    throw badRequest(
      current === 'cancelled'
        ? 'This order is cancelled.'
        : `Status can only move forward (currently ${STATUS_LABELS[current] || current}).`,
      'not_forward',
    );
  }
  if (status === 'shipped') {
    after(() => sendShippedEmail(id).catch((e) => console.error('[admin] shipped email', e.message)));
  }
  return { ok: true, status: r.order.fulfillment_status };
});
