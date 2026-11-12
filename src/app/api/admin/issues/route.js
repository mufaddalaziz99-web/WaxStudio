import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listIssues } from '@/lib/server/orderIssues';

export const dynamic = 'force-dynamic';

// GET /api/admin/issues?status=open|resolved|rejected
export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get('status');
  return { issues: await listIssues({ status: ['open', 'resolved', 'rejected'].includes(status) ? status : undefined }) };
});
