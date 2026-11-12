import { z } from 'zod';
import { route, notFound } from '@/lib/server/http';
import { one } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// GET /api/products/resolve?id=<uuid> -> { slug }. Used by src/proxy.js to turn /product/<uuid> into /product/<slug>.
export const GET = route(async (req) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!z.uuid().safeParse(id).success) throw notFound('Product not found');
  const row = await one('SELECT slug FROM products WHERE id = $1 AND is_hidden = false', [id]);
  if (!row) throw notFound('Product not found');
  return Response.json({ slug: row.slug }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
});
