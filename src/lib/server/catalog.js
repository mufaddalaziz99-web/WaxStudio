import 'server-only';
import { cache } from 'react';
import { many, one, query } from './db';
import { maybeReleaseExpiredOrders } from './orderHelpers';

const PRODUCT_COLUMNS = `p.id, p.slug, p.name, p.short_description, p.description, p.price, p.compare_at_price,
  p.stock, p.sku, p.category_id, p.images, p.tags, p.highlights, p.specs, p.faqs, p.how_to_use,
  p.weight_grams, p.length_cm, p.breadth_cm, p.height_cm, p.hsn_code, p.tax_rate, p.max_per_order,
  p.is_hidden, p.is_featured, p.sort_order, p.rating_avg, p.rating_count, p.created_at, p.updated_at,
  p.tagline, p.badge, p.rated_for, p.claims, p.ingredients, p.free_from,
  c.name AS category_name, c.slug AS category_slug`;

function mapVariant(v, product) {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: v.price ?? product.price,
    compareAtPrice: v.compare_at_price ?? (v.price == null ? product.compare_at_price : null),
    stock: v.stock,
    inStock: v.stock > 0,
    weightGrams: v.weight_grams ?? product.weight_grams,
    image: v.image,
    swatch: v.swatch,
    badge: v.badge || null,
    sortOrder: v.sort_order,
    isHidden: v.is_hidden,
  };
}

/** Shape a DB row (+ its variants) into the object pages and APIs use. */
export function mapProduct(row, variantRows = []) {
  const variants = variantRows
    .filter((v) => v.product_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => mapVariant(v, row));
  const visibleVariants = variants.filter((v) => !v.isHidden);
  const hasVariants = visibleVariants.length > 0;
  const prices = hasVariants ? visibleVariants.map((v) => v.price) : [row.price];
  const stock = hasVariants ? visibleVariants.reduce((s, v) => s + v.stock, 0) : row.stock;
  const defaultVariant = hasVariants ? visibleVariants.find((v) => v.inStock) || visibleVariants[0] : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    price: defaultVariant ? defaultVariant.price : row.price,
    compareAtPrice: defaultVariant ? defaultVariant.compareAtPrice : row.compare_at_price,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    stock,
    inStock: stock > 0,
    sku: row.sku,
    images: Array.isArray(row.images) ? row.images : [],
    tags: row.tags || [],
    highlights: row.highlights || [],
    specs: row.specs || [],
    faqs: row.faqs || [],
    howToUse: row.how_to_use || [],
    tagline: row.tagline || '',
    badge: row.badge || null,
    ratedFor: row.rated_for || [],
    claims: row.claims || [],
    ingredients: row.ingredients || [],
    freeFrom: row.free_from || [],
    weightGrams: row.weight_grams,
    dimensions: { length: row.length_cm, breadth: row.breadth_cm, height: row.height_cm },
    hsnCode: row.hsn_code,
    taxRate: row.tax_rate,
    maxPerOrder: row.max_per_order,
    isHidden: row.is_hidden,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    ratingAvg: Number(row.rating_avg) || 0,
    ratingCount: row.rating_count || 0,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug } : null,
    hasVariants,
    variants: visibleVariants,
    allVariants: variants,
    defaultVariantId: defaultVariant?.id || null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function attachVariants(rows) {
  if (!rows.length) return [];
  const variants = await many(
    'SELECT * FROM product_variants WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order, created_at',
    [rows.map((r) => r.id)],
  );
  return rows.map((r) => mapProduct(r, variants));
}

const SORTS = {
  featured: 'p.is_featured DESC, p.sort_order ASC, p.created_at DESC',
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC',
};

/**
 * Lists products. Hidden products are always excluded unless includeHidden (admin).
 * Search matches name, tags and variant names.
 */
export async function listProducts({ categorySlug, q, minPrice, maxPrice, sort = 'featured', includeHidden = false, limit = 60 } = {}) {
  if (!includeHidden) maybeReleaseExpiredOrders();
  const where = [];
  const params = [];
  if (!includeHidden) where.push('p.is_hidden = false');
  if (categorySlug) {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const i = params.length;
    where.push(`(lower(p.name) LIKE $${i} OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE lower(t) LIKE $${i})
      OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND lower(v.name) LIKE $${i}))`);
  }
  if (minPrice != null) {
    params.push(minPrice);
    where.push(`p.price >= $${params.length}`);
  }
  if (maxPrice != null) {
    params.push(maxPrice);
    where.push(`p.price <= $${params.length}`);
  }
  params.push(limit);
  const rows = await many(
    `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${SORTS[sort] || SORTS.featured} LIMIT $${params.length}`,
    params,
  );
  return attachVariants(rows);
}

export const getFeaturedProducts = cache(async (limit = 8) => {
  const all = await listProducts({ sort: 'featured', limit });
  return all;
});

/** Returns { product } or { redirect: slug } (old slug / UUID) or null. */
export const getProductBySlug = cache(async (slug, { includeHidden = false } = {}) => {
  maybeReleaseExpiredOrders();
  const row = await one(
    `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.slug = $1`,
    [slug],
  );
  if (row && (includeHidden || !row.is_hidden)) {
    const [product] = await attachVariants([row]);
    return { product };
  }
  if (row) return null;
  const redirect = await one(
    `SELECT p.slug FROM product_slug_redirects r JOIN products p ON p.id = r.product_id WHERE r.old_slug = $1`,
    [slug],
  );
  return redirect ? { redirect: redirect.slug } : null;
});

export async function getProductById(id, { includeHidden = true } = {}) {
  const row = await one(
    `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
    [id],
  );
  if (!row || (!includeHidden && row.is_hidden)) return null;
  const [product] = await attachVariants([row]);
  return product;
}

export async function getAllProductSlugs() {
  return many('SELECT slug, updated_at FROM products WHERE is_hidden = false ORDER BY sort_order');
}

export async function getRelatedProducts(product, limit = 4) {
  const rows = await many(
    `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_hidden = false AND p.id <> $1
     ORDER BY (p.category_id IS NOT DISTINCT FROM $2) DESC, p.is_featured DESC, p.sort_order LIMIT $3`,
    [product.id, product.category?.id || null, limit],
  );
  return attachVariants(rows);
}

export const listCategories = cache(async ({ includeHidden = false } = {}) => {
  return many(
    `SELECT c.*, (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.is_hidden = false) AS product_count
     FROM categories c ${includeHidden ? '' : 'WHERE c.is_hidden = false'} ORDER BY c.sort_order, c.name`,
  );
});

/** Returns { category } or { redirect } or null. */
export async function getCategoryBySlug(slug) {
  const cat = await one('SELECT * FROM categories WHERE slug = $1 AND is_hidden = false', [slug]);
  if (cat) return { category: cat };
  const r = await one(
    'SELECT c.slug FROM category_redirects r JOIN categories c ON c.id = r.category_id WHERE r.old_slug = $1',
    [slug],
  );
  return r ? { redirect: r.slug } : null;
}

export const getCatalogStats = cache(async () => {
  return one(
    `SELECT (SELECT count(*)::int FROM products WHERE is_hidden = false) AS products,
            (SELECT count(*)::int FROM reviews WHERE status = 'approved') AS reviews,
            (SELECT COALESCE(round(avg(rating)::numeric, 1), 0) FROM reviews WHERE status = 'approved') AS avg_rating,
            (SELECT count(*)::int FROM orders WHERE payment_status = 'paid' OR (payment_method = 'cod' AND fulfillment_status <> 'cancelled')) AS orders`,
  );
});

export const getApprovedReviews = cache(async (productId, limit = 20) => {
  return many(
    `SELECT id, name, rating, title, body, images, is_verified, admin_reply, created_at
     FROM reviews WHERE product_id = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT $2`,
    [productId, limit],
  );
});

export const getRatingBreakdown = cache(async (productId) => {
  const rows = await many(
    `SELECT rating, count(*)::int AS n FROM reviews WHERE product_id = $1 AND status = 'approved' GROUP BY rating`,
    [productId],
  );
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) out[r.rating] = r.n;
  return out;
});

/** Coupons flagged show_on_site and currently valid — shown as offer cards. */
export const getSiteOffers = cache(async () => {
  return many(
    `SELECT code, description, type, value, max_discount, min_order, first_order_only FROM coupons
     WHERE is_active AND show_on_site AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
       AND (usage_limit IS NULL OR used_count < usage_limit)
     ORDER BY min_order`,
  );
});

/**
 * Live price + stock for cart lines (used by /api/products/lookup and the cart page).
 * Returns one entry per requested line with `available: false` when removed / hidden / sold out.
 */
export async function lookupLines(lines) {
  maybeReleaseExpiredOrders();
  const ids = [...new Set(lines.map((l) => l.productId))];
  if (!ids.length) return [];
  const rows = await many(
    `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ANY($1::uuid[])`,
    [ids],
  );
  const products = new Map((await attachVariants(rows)).map((p) => [p.id, p]));
  return lines.map((l) => {
    const p = products.get(l.productId);
    if (!p || p.isHidden) return { ...l, available: false, reason: 'removed' };
    if (p.hasVariants) {
      const v = p.variants.find((x) => x.id === l.variantId);
      if (!v) return { ...l, available: false, reason: 'removed' };
      return {
        productId: p.id, variantId: v.id, slug: p.slug, name: p.name, variantName: v.name,
        image: v.image || p.images[0] || null, price: v.price, compareAtPrice: v.compareAtPrice,
        stock: v.stock, maxQty: Math.min(v.stock, p.maxPerOrder), available: v.stock > 0,
        reason: v.stock > 0 ? null : 'sold_out', weightGrams: v.weightGrams,
      };
    }
    if (l.variantId) return { ...l, available: false, reason: 'removed' };
    return {
      productId: p.id, variantId: null, slug: p.slug, name: p.name, variantName: null,
      image: p.images[0] || null, price: p.price, compareAtPrice: p.compareAtPrice,
      stock: p.stock, maxQty: Math.min(p.stock, p.maxPerOrder), available: p.stock > 0,
      reason: p.stock > 0 ? null : 'sold_out', weightGrams: p.weightGrams,
    };
  });
}

export async function recordSearch(q, resultsCount) {
  if (!q) return;
  query('INSERT INTO search_events (query, results_count) VALUES ($1, $2)', [q.slice(0, 100), resultsCount]).catch(() => {});
}
