import { z } from 'zod';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { lookupLines } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';

const schema = z.object({
  items: z.array(z.object({ productId: z.uuid(), variantId: z.uuid().nullable().optional().default(null) })).max(30),
});

// Live price + stock for cart lines (useCartSync). Removed / sold-out lines come back available:false.
export const POST = route(async (req) => {
  rateLimit(req, 'lookup', 120, 60_000);
  const { items } = schema.parse(await readJson(req));
  return { items: await lookupLines(items) };
});
