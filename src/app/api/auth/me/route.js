import { route } from '@/lib/server/http';
import { getSessionUser, publicUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/me -> { user } (null when signed out)
export const GET = route(async () => {
  const user = await getSessionUser();
  return Response.json({ user: publicUser(user) }, { headers: { 'Cache-Control': 'private, no-store' } });
});
