import { route } from '@/lib/server/http';
import { clearSessionCookie } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export const POST = route(async () => {
  await clearSessionCookie();
  return { ok: true };
});
