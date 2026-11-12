import { env } from '@/lib/server/env';
import { getAllProductSlugs, listCategories } from '@/lib/server/catalog';

export const revalidate = 3600;

export default async function sitemap() {
  const base = env.siteUrl;
  const now = new Date();
  const [products, categories] = await Promise.all([
    getAllProductSlugs().catch(() => []),
    listCategories().catch(() => []),
  ]);

  const page = (path, changeFrequency, priority, lastModified = now) => ({ url: `${base}${path}`, lastModified, changeFrequency, priority });

  return [
    page('/', 'daily', 1),
    page('/shop', 'daily', 0.9),
    ...categories
      .filter((c) => c.product_count > 0)
      .map((c) => page(`/shop/${c.slug}`, 'weekly', 0.7, c.updated_at ? new Date(c.updated_at) : now)),
    ...products.map((p) => page(`/product/${p.slug}`, 'weekly', 0.8, p.updated_at ? new Date(p.updated_at) : now)),
    page('/about', 'monthly', 0.4),
    page('/contact', 'yearly', 0.3),
    page('/track-order', 'yearly', 0.3),
    ...['shipping', 'returns', 'privacy', 'terms'].map((s) => page(`/policies/${s}`, 'yearly', 0.2)),
  ];
}
