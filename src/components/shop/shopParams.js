// Shared parsing / filtering for /shop and /shop/[categorySlug] (server-side, pure).
export function parseShopParams(sp = {}) {
  const max = Number.parseInt(sp.max, 10);
  return {
    q: typeof sp.q === 'string' ? sp.q.slice(0, 80) : '',
    sort: typeof sp.sort === 'string' ? sp.sort : '',
    max: Number.isFinite(max) && max > 0 ? String(max) : '',
    stock: sp.stock === '1' ? '1' : '',
  };
}

/** Price filter uses the cheapest visible variant; availability hides sold-out products. */
export function applyShopFilters(products, params) {
  return products.filter((p) => (!params.max || p.minPrice <= Number(params.max)) && (!params.stock || p.inStock));
}

export function categoryFacets(categories) {
  return categories.filter((c) => c.product_count > 0).map((c) => ({ name: c.name, slug: c.slug, count: c.product_count }));
}
