import { route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId, requireOrder } from '@/lib/server/admin';
import { generateInvoicePdf } from '@/lib/server/documents';

export const dynamic = 'force-dynamic';

// GET — invoice PDF download (?inline=1 opens it in the browser instead).
export const GET = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Order');
  const order = await requireOrder(id);
  const pdf = await generateInvoicePdf(id);
  const inline = new URL(req.url).searchParams.get('inline') === '1';
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="invoice-${order.order_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
