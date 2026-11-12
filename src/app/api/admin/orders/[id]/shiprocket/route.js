import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { shiprocketAction } from '@/lib/server/adminShipping';
import { adminShiprocketSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST { action: 'push' | 'awb' | 'label' | 'pickup' }
export const POST = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const { action } = adminShiprocketSchema.parse(await readJson(req));
  const order = await shiprocketAction(id, action);
  return {
    ok: true,
    awbCode: order.awb_code,
    courierName: order.courier_name,
    labelUrl: order.label_url,
    pickupScheduledAt: order.pickup_scheduled_at,
  };
});
