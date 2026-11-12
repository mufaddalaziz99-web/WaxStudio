import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listAdminReviews } from '@/lib/server/adminContent';

export const dynamic = 'force-dynamic';

// GET /api/admin/reviews?status=pending|approved|rejected
export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get('status');
  return { reviews: await listAdminReviews({ status: ['pending', 'approved', 'rejected'].includes(status) ? status : undefined }) };
});
