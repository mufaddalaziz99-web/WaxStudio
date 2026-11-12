import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listOrders } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders?status=&payment=&method=&q=&from=&to=&attention=&page=&pageSize=
export const GET = route(async (req) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const pick = (k) => sp.get(k) || undefined;
  return listOrders({
    status: pick('status'),
    payment: pick('payment'),
    method: pick('method'),
    q: pick('q'),
    from: pick('from'),
    to: pick('to'),
    attention: pick('attention'),
    page: pick('page'),
    pageSize: pick('pageSize'),
  });
});
