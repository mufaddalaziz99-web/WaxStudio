import { z } from 'zod';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { addressDetails } from '@/lib/server/places';

export const dynamic = 'force-dynamic';
const schema = z.object({ placeId: z.string().min(1).max(300), sessionToken: z.string().max(100).optional() });

export const POST = route(async (req) => {
  rateLimit(req, 'places', 60, 5 * 60_000);
  const { placeId, sessionToken } = schema.parse(await readJson(req));
  return { address: await addressDetails(placeId, sessionToken) };
});
