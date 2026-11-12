import { route, readJson, rateLimit } from '@/lib/server/http';
import { googleCredentialSchema } from '@/lib/validation';
import { googleSignIn } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

// POST /api/auth/google { credential } (ID token from Google Identity Services) -> { user }
export const POST = route(async (req) => {
  rateLimit(req, 'google', 20, 10 * 60_000);
  const body = googleCredentialSchema.parse(await readJson(req));
  return googleSignIn(body);
});
