import { notFound, permanentRedirect } from 'next/navigation';
import ShopView from '@/components/shop/ShopView';
import { applyShopFilters, categoryFacets, parseShopParams } from '@/components/shop/shopParams';
import { getCategoryBySlug, listCategories, listProducts } from '@/lib/server/catalog';

export async function generateMetadata({ params }) {
  const { categorySlug } = await params;
  const r = await getCategoryBySlug(categorySlug);
  if (!r?.category) return {};
  return { title: r.category.name, description: r.category.description || undefined, alternates: { canonical: `/shop/${r.category.slug}` } };
}

export default async function CategoryPage({ params, searchParams }) {
  const { categorySlug } = await params;
  const filters = parseShopParams(await searchParams);
  const r = await getCategoryBySlug(categorySlug);
  if (!r) notFound();
  if (r.redirect) permanentRedirect(`/shop/${r.redirect}`); // old category slugs
  const [products, categories] = await Promise.all([
    listProducts({ categorySlug: r.category.slug, q: filters.q || undefined, sort: filters.sort || 'featured' }),
    listCategories(),
  ]);
  return (
    <ShopView
      eyebrow="Category"
      title={r.category.name}
      description={r.category.description}
      products={applyShopFilters(products, filters)}
      categories={categoryFacets(categories)}
      activeCategory={r.category.slug}
      params={filters}
    />
  );
}
