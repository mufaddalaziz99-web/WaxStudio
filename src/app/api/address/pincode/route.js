import { route, rateLimit, badRequest } from '@/lib/server/http';
import { lookupPincode } from '@/lib/server/places';
import { PINCODE_RE } from '@/lib/rules';

export const dynamic = 'force-dynamic';

// GET /api/address/pincode?pincode=400001 → { city, state } (nulls when unknown / not configured)
export const GET = route(async (req) => {
  rateLimit(req, 'pincode', 60, 5 * 60_000);
  const pincode = new URL(req.url).searchParams.get('pincode') || '';
  if (!PINCODE_RE.test(pincode)) throw badRequest('Enter a valid 6-digit pincode', 'bad_pincode');
  const r = await lookupPincode(pincode);
  return { pincode, city: r?.city || null, state: r?.state || null };
});
