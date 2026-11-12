import { route, notFound } from '@/lib/server/http';
import { getOrderWithDetails, publicOrder } from '@/lib/server/orders';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET /api/orders/[id] — addressed by the unguessable order UUID (guests can revisit it).
export const GET = route(async (req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw notFound('Order not found');
  const order = await getOrderWithDetails(id);
  if (!order) throw notFound('Order not found');
  return { order: publicOrder(order) };
});
