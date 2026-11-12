import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { deleteCoupon, saveCoupon } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { couponInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const PUT = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Coupon');
  const coupon = await saveCoupon(id, couponInputSchema.parse(await readJson(req)));
  refreshStorefront();
  return { ok: true, coupon };
});

// DELETE — past orders keep their coupon_code snapshot.
export const DELETE = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Coupon');
  await deleteCoupon(id);
  refreshStorefront();
  return { ok: true };
});
