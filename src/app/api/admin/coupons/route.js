import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listAdminCoupons, saveCoupon } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { couponInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return { coupons: await listAdminCoupons() };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const coupon = await saveCoupon(null, couponInputSchema.parse(await readJson(req)));
  refreshStorefront(); // site-wide offer cards
  return { ok: true, coupon };
});
