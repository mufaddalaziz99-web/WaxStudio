import ShopView from '@/components/shop/ShopView';
import { applyShopFilters, categoryFacets, parseShopParams } from '@/components/shop/shopParams';
import { listCategories, listProducts } from '@/lib/server/catalog';
import { getSettings } from '@/lib/server/settings';

export const metadata = { title: 'Shop all', alternates: { canonical: '/shop' } };

export default async function ShopPage({ searchParams }) {
  const params = parseShopParams(await searchParams);
  const [products, categories, settings] = await Promise.all([
    listProducts({ q: params.q || undefined, sort: params.sort || 'featured' }),
    listCategories(),
    getSettings(),
  ]);
  return (
    <ShopView
      eyebrow={params.q ? 'Search' : 'Collection'}
      title={params.q ? `“${params.q}”` : 'Shop all'}
      description={params.q ? null : settings.store.tagline}
      products={applyShopFilters(products, params)}
      categories={categoryFacets(categories)}
      params={params}
    />
  );
}
