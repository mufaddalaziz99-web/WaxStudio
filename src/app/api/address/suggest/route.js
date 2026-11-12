import { z } from 'zod';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { suggestAddresses } from '@/lib/server/places';

export const dynamic = 'force-dynamic';
const schema = z.object({ input: z.string().trim().min(3).max(200), sessionToken: z.string().max(100).optional() });

export const POST = route(async (req) => {
  rateLimit(req, 'places', 60, 5 * 60_000);
  const { input, sessionToken } = schema.parse(await readJson(req));
  return { suggestions: await suggestAddresses(input, sessionToken) };
});
