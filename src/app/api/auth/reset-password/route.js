import { route, readJson, rateLimit } from '@/lib/server/http';
import { resetPasswordSchema } from '@/lib/validation';
import { resetPassword } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password { email, code, password } -> sets the password, verifies the email, signs in: { user }.
export const POST = route(async (req) => {
  rateLimit(req, 'reset-password', 10, 10 * 60_000);
  const body = resetPasswordSchema.parse(await readJson(req));
  return resetPassword(body);
});
