import ProductCard from '@/components/product/ProductCard';
import ShopFilters, { ShopToolbar } from './ShopFilters';

/**
 * Collection page: centred title + intro, filter sidebar (desktop) / drawer (mobile),
 * toolbar with result count and sort, and the product grid.
 */
export default function ShopView({ title, description, eyebrow = 'Collection', products, categories, activeCategory, params }) {
  return (
    <div>
      <section className="border-b border-line bg-white">
        <div className="container-page py-12 text-center sm:py-16">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">{eyebrow}</p>
          <h1 className="display text-5xl sm:text-7xl">{title}</h1>
          {description && <p className="mx-auto mt-4 max-w-xl text-ink-soft">{description}</p>}
        </div>
      </section>
      <div className="container-page grid grid-cols-1 gap-10 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ShopFilters params={params} categories={categories} activeCategory={activeCategory} />
          </div>
        </aside>
        <div>
          <ShopToolbar params={params} count={products.length} categories={categories} activeCategory={activeCategory} />
          {products.length === 0 ? (
            <div className="mt-10 rounded-2xl bg-white p-12 text-center ring-1 ring-line">
              <p className="display text-3xl">Nothing here (yet)</p>
              <p className="mt-2 text-ink-muted">No products match these filters.</p>
              <a href={activeCategory ? `/shop/${activeCategory}` : '/shop'} className="btn-primary mt-6">Clear filters</a>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
