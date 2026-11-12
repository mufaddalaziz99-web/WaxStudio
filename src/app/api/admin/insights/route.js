import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { getInsights } from '@/lib/server/adminContent';

export const dynamic = 'force-dynamic';

// GET /api/admin/insights?days=30
export const GET = route(async (req) => {
  await requireAdmin();
  return getInsights(Number(new URL(req.url).searchParams.get('days')) || 30);
});
