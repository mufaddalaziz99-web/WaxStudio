import { route, readJson, notFound } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { getAdminOrder, parseId, patchOrder } from '@/lib/server/admin';
import { adminOrderPatchSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const data = await getAdminOrder(id);
  if (!data) throw notFound('Order not found');
  return data;
});

// PATCH: admin note and/or manual courier + AWB + tracking URL.
export const PATCH = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const input = adminOrderPatchSchema.parse(await readJson(req));
  await patchOrder(id, input);
  return { ok: true };
});
