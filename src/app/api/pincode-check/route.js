import { z } from 'zod';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { getShippingQuote } from '@/lib/server/shipping';
import { getProductById } from '@/lib/server/catalog';
import { pincodeSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const schema = z.object({ pincode: pincodeSchema, productId: z.uuid(), variantId: z.uuid().nullable().optional() });

// Product-page delivery check: serviceable? how fast? COD?
export const POST = route(async (req) => {
  rateLimit(req, 'pincode-check', 30, 5 * 60_000);
  const { pincode, productId, variantId } = schema.parse(await readJson(req));
  const p = await getProductById(productId, { includeHidden: false });
  if (!p) return { serviceable: true, options: [] };
  const vId = p.hasVariants ? (p.variants.some((v) => v.id === variantId) ? variantId : p.defaultVariantId) : null;
  const q = await getShippingQuote({ pincode, items: [{ productId: p.id, variantId: vId, quantity: 1 }], recordCheck: 'product' });
  const fastest = [...q.options].sort((a, b) => (a.etaDays ?? 99) - (b.etaDays ?? 99))[0];
  // Max days for a "Get it by <date>" promise: courier ETA, or the upper bound of the flat-rate text ("4–7" → 7).
  const etaMaxDays = fastest?.etaDays || Number(String(fastest?.etaText || '').match(/(\d+)\D*$/)?.[1]) || null;
  return {
    serviceable: q.serviceable,
    source: q.source,
    cod: q.options.some((o) => o.cod),
    etaText: fastest?.etaText || null,
    etaMaxDays,
    cheapest: q.options.length ? Math.min(...q.options.map((o) => o.originalPrice ?? o.price)) : null,
    freeShippingThreshold: q.freeShippingThreshold,
  };
});
