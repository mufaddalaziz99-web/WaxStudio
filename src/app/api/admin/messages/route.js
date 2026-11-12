import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listMessages } from '@/lib/server/adminContent';

export const dynamic = 'force-dynamic';

// GET /api/admin/messages?handled=true|false
export const GET = route(async (req) => {
  await requireAdmin();
  return { messages: await listMessages({ handled: new URL(req.url).searchParams.get('handled') || undefined }) };
});
