import { route, readJson, rateLimit } from '@/lib/server/http';
import { signupSchema } from '@/lib/validation';
import { signup } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/signup { name, email, password } -> emails a 6-digit code; the account stays unverified until /verify.
export const POST = route(async (req) => {
  rateLimit(req, 'signup', 10, 10 * 60_000);
  const body = signupSchema.parse(await readJson(req));
  return signup(body);
});
