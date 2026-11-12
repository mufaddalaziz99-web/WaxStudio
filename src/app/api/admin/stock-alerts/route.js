import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listStockAlerts } from '@/lib/server/adminContent';
import { sendBackInStockAlerts } from '@/lib/server/stockAlerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route(async () => {
  await requireAdmin();
  return { alerts: await listStockAlerts() };
});

// POST — email everyone waiting on an item that is back in stock, now.
export const POST = route(async () => {
  await requireAdmin();
  const sent = await sendBackInStockAlerts();
  return { ok: true, sent };
});
