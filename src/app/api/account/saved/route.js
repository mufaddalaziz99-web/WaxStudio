import { route, readJson, rateLimit } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { savedItemsSchema } from '@/lib/validation';
import { getSaved, putSaved } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// GET /api/account/saved -> { cart, wishlist } (mirrored by AccountSync)
export const GET = route(async () => {
  const user = await requireUser();
  return getSaved(user.id);
});

// PUT /api/account/saved { cart?, wishlist? } -> { cart, wishlist }
export const PUT = route(async (req) => {
  rateLimit(req, 'account-saved', 300, 10 * 60_000);
  const user = await requireUser();
  const body = savedItemsSchema.parse(await readJson(req));
  return putSaved(user.id, body);
});
