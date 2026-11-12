import { z } from 'zod';
import { route } from '@/lib/server/http';
import { getProductById } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';

// GET /api/products/by-ids?ids=a,b,c -> { products } (visible products only, in the requested order; max 100)
export const GET = route(async (req) => {
  const raw = new URL(req.url).searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => z.uuid().safeParse(s).success))].slice(0, 100);
  const found = await Promise.all(ids.map((id) => getProductById(id, { includeHidden: false })));
  const products = found.filter(Boolean).map((p) => ({
    id: p.id, slug: p.slug, name: p.name, shortDescription: p.shortDescription, price: p.price,
    compareAtPrice: p.compareAtPrice, minPrice: p.minPrice, maxPrice: p.maxPrice, images: p.images,
    inStock: p.inStock, stock: p.stock, maxPerOrder: p.maxPerOrder, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount,
    hasVariants: p.hasVariants, defaultVariantId: p.defaultVariantId,
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock, inStock: v.inStock, image: v.image })),
  }));
  return { products };
});
