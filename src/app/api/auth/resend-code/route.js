import { route, readJson, rateLimit } from '@/lib/server/http';
import { emailOnlySchema } from '@/lib/validation';
import { resendVerification } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/resend-code { email } -> always { ok: true } (never reveals whether the account exists).
export const POST = route(async (req) => {
  rateLimit(req, 'resend-code', 5, 10 * 60_000);
  const body = emailOnlySchema.parse(await readJson(req));
  return resendVerification(body);
});
