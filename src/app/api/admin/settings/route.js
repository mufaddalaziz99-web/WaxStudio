import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { getSettings, SETTINGS_DEFAULTS } from '@/lib/server/settings';
import { integrationStatus } from '@/lib/server/adminContent';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return { settings: await getSettings({ fresh: true }), defaults: SETTINGS_DEFAULTS, integrations: integrationStatus() };
});
