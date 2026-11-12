import { route, readJson, rateLimit } from '@/lib/server/http';
import { trackOrderSchema } from '@/lib/validation';
import { publicOrder, trackOrder } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';

// POST /api/orders/track { orderNumber, phone } -> { order } (404 track_not_found for any mismatch)
export const POST = route(async (req) => {
  rateLimit(req, 'track-order', 10, 10 * 60_000);
  const body = trackOrderSchema.parse(await readJson(req));
  const order = await trackOrder(body);
  return { order: publicOrder(order) };
});
