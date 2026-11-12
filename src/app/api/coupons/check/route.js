import { route, readJson, rateLimit } from '@/lib/server/http';
import { checkCoupon } from '@/lib/server/coupons';
import { couponCheckSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  rateLimit(req, 'coupon', 30, 10 * 60_000);
  const input = couponCheckSchema.parse(await readJson(req));
  return { coupon: await checkCoupon(input) };
});
