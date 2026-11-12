import { route, readJson, rateLimit } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { savedAddressSchema } from '@/lib/validation';
import { createAddress, listAddresses } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// GET /api/account/addresses
//   -> { addresses: [{ id, name, phone, email, line1, line2, landmark, city, state, pincode, isDefault }] }
export const GET = route(async () => {
  const user = await requireUser();
  return { addresses: await listAddresses(user.id) };
});

// POST /api/account/addresses (savedAddressSchema) -> { address }
export const POST = route(async (req) => {
  rateLimit(req, 'address-create', 30, 10 * 60_000);
  const user = await requireUser();
  const body = savedAddressSchema.parse(await readJson(req));
  return { address: await createAddress(user.id, body) };
});
