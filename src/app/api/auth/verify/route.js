import { route, readJson, rateLimit } from '@/lib/server/http';
import { verifyCodeSchema } from '@/lib/validation';
import { verifyEmail } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/verify { email, code } -> verifies the email and signs the customer in: { user }.
export const POST = route(async (req) => {
  rateLimit(req, 'verify', 15, 10 * 60_000);
  const body = verifyCodeSchema.parse(await readJson(req));
  return verifyEmail(body);
});
