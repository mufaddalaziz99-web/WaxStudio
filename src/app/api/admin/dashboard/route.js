import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { getDashboard } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return getDashboard();
});
