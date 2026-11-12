import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { updateSettings } from '@/lib/server/settings';
import { coerceSettingsPatch } from '@/lib/server/adminContent';
import { refreshStorefront } from '@/lib/server/revalidate';

export const dynamic = 'force-dynamic';

// PUT /api/admin/settings/:group — partial update of one settings group.
export const PUT = route(async (req, { params }) => {
  await requireAdmin();
  const { group } = await params;
  const patch = coerceSettingsPatch(group, await readJson(req));
  const settings = await updateSettings(group, patch);
  refreshStorefront();
  return { ok: true, values: settings[group] };
});
