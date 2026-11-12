import { route, badRequest } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { generatePackingSlipsPdf } from '@/lib/server/documents';

export const dynamic = 'force-dynamic';

// GET /api/admin/packing-slips?ids=uuid,uuid — opens inline for printing.
export const GET = route(async (req) => {
  await requireAdmin();
  const raw = new URL(req.url).searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (!ids.length) throw badRequest('Choose at least one order.', 'no_orders');
  if (ids.length > 200) throw badRequest('At most 200 orders at a time.', 'too_many');
  ids.forEach((id) => parseId(id, 'Order'));
  const pdf = await generatePackingSlipsPdf(ids);
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="packing-slips-${ids.length}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
