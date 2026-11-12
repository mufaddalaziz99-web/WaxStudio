import { route } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { listUserOrders } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';

function mapOrderSummary(o) {
  return {
    id: o.id, orderNumber: o.order_number, createdAt: o.created_at, total: o.total,
    paymentMethod: o.payment_method, paymentStatus: o.payment_status, status: o.fulfillment_status,
    items: o.items || [],
  };
}

// GET /api/account/orders -> { orders: [{ id, orderNumber, createdAt, total, paymentMethod, paymentStatus, status, items }] }
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await listUserOrders(user.id);
  return { orders: rows.map(mapOrderSummary) };
});
