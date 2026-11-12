import { route, notFound, badRequest } from '@/lib/server/http';
import { one } from '@/lib/server/db';
import { generateInvoicePdf } from '@/lib/server/documents';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Invoice PDF for the customer (order UUID is the capability). Only for confirmed/paid orders.
export const GET = route(async (req, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw notFound('Order not found');
  const order = await one('SELECT order_number, fulfillment_status, payment_method, payment_status FROM orders WHERE id = $1', [id]);
  if (!order) throw notFound('Order not found');
  if (order.fulfillment_status === 'placed' || (order.payment_method === 'razorpay' && order.payment_status === 'pending')) {
    throw badRequest('The invoice is available once the order is confirmed.', 'not_confirmed');
  }
  const pdf = await generateInvoicePdf(id);
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${order.order_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
