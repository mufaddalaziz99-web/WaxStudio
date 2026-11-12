import { route, readJson, rateLimit } from '@/lib/server/http';
import { loginSchema } from '@/lib/validation';
import { login } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/login { email, password } -> { user }.
// 401 invalid_credentials; 403 email_unverified (a fresh code is emailed).
export const POST = route(async (req) => {
  rateLimit(req, 'login', 10, 10 * 60_000);
  const body = loginSchema.parse(await readJson(req));
  return login(body);
});
