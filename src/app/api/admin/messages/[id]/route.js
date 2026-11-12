import { route, readJson, badRequest } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { setMessageHandled } from '@/lib/server/adminContent';

export const dynamic = 'force-dynamic';

// PATCH { handled: boolean }
export const PATCH = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Message');
  const body = await readJson(req);
  if (typeof body?.handled !== 'boolean') throw badRequest('handled: Expected true or false', 'validation');
  return { ok: true, message: await setMessageHandled(id, body.handled) };
});
