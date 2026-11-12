import { route, readJson, rateLimit } from '@/lib/server/http';
import { createStockAlert } from '@/lib/server/stockAlerts';
import { stockAlertSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  rateLimit(req, 'stock-alerts', 10, 10 * 60_000);
  const input = stockAlertSchema.parse(await readJson(req));
  await createStockAlert(input);
  return { ok: true };
});
