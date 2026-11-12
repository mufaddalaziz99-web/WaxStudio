import { route, readJson, rateLimit } from '@/lib/server/http';
import { getShippingQuote } from '@/lib/server/shipping';
import { shippingQuoteSchema } from '@/lib/validation';
import { mergeLines } from '@/lib/cartLine';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  rateLimit(req, 'quote', 60, 10 * 60_000);
  const { pincode, items } = shippingQuoteSchema.parse(await readJson(req));
  const q = await getShippingQuote({ pincode, items: mergeLines(items) });
  return {
    source: q.source,
    serviceable: q.serviceable,
    options: q.options.map(({ id, label, courierName, price, originalPrice, free, etaText, cod, kind }) => ({
      id, label, courierName, price, originalPrice, free, etaText, cod, kind,
    })),
    itemsTotal: q.itemsTotal,
    codFee: q.codFee,
    freeShippingThreshold: q.freeShippingThreshold,
  };
});
