import { z } from 'zod';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/server/http';
import { bumpProductStat, bumpCounter } from '@/lib/server/insights';
import { recordSearch } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('view'), productId: z.uuid() }),
  z.object({ type: z.literal('add_to_cart'), productId: z.uuid() }),
  z.object({ type: z.literal('search'), query: z.string().max(100), results: z.number().int().min(0).max(10000) }),
  z.object({ type: z.literal('counter'), key: z.string().max(60) }),
]);

// Fire-and-forget insight beacons. Always 204 so the browser never retries.
export async function POST(req) {
  try {
    rateLimit(req, 'insights', 120, 60_000);
    const evt = schema.parse(await req.json());
    if (evt.type === 'view') await bumpProductStat(evt.productId, 'views');
    else if (evt.type === 'add_to_cart') await bumpProductStat(evt.productId, 'add_to_cart');
    else if (evt.type === 'search') recordSearch(evt.query, evt.results);
    else if (evt.type === 'counter') await bumpCounter(evt.key);
  } catch {}
  return new NextResponse(null, { status: 204 });
}
