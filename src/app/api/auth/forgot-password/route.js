import { route, readJson, rateLimit } from '@/lib/server/http';
import { emailOnlySchema } from '@/lib/validation';
import { requestPasswordReset } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/forgot-password { email } -> always { ok: true }; emails a reset code when the account exists.
export const POST = route(async (req) => {
  rateLimit(req, 'forgot-password', 5, 10 * 60_000);
  const body = emailOnlySchema.parse(await readJson(req));
  return requestPasswordReset(body);
});
