import 'server-only';
import { many, one, query, withTransaction } from './db';
import { badRequest, conflict, notFound } from './http';
import { slugify } from '../rules';

// ---------------------------------------------------------------------------
// Admin: products (+ variants), categories, coupons.
// ---------------------------------------------------------------------------

function uniqueViolation(e, what) {
  if (e?.code === '23505') throw conflict(`That ${what} is already in use.`, 'duplicate', what === 'coupon code' ? { field: 'code' } : { field: 'slug' });
  throw e;
}

// ============================== Products ===================================

export async function listAdminProducts() {
  const products = await many(
    `SELECT p.id, p.slug, p.name, p.price, p.compare_at_price, p.stock, p.sku, p.images, p.is_hidden, p.is_featured,
       p.sort_order, p.rating_avg, p.rating_count, p.category_id, c.name AS category_name, p.updated_at,
       (SELECT count(*)::int FROM order_items i WHERE i.product_id = p.id) AS order_lines,
       (SELECT count(*)::int FROM stock_alerts a WHERE a.product_id = p.id AND a.notified_at IS NULL) AS pending_alerts
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.sort_order, p.created_at DESC`,
  );
  const variants = await many(
    'SELECT id, product_id, name, sku, price, stock, is_hidden, sort_order FROM product_variants ORDER BY sort_order, created_at',
  );
  const byProduct = new Map(products.map((p) => [p.id, { ...p, variants: [] }]));
  for (const v of variants) byProduct.get(v.product_id)?.variants.push(v);
  return [...byProduct.values()];
}

export async function getAdminProduct(id) {
  const product = await one('SELECT * FROM products WHERE id = $1', [id]);
  if (!product) return null;
  product.variants = await many('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, created_at', [id]);
  product.redirects = (await many('SELECT old_slug FROM product_slug_redirects WHERE product_id = $1 ORDER BY old_slug', [id])).map((r) => r.old_slug);
  return product;
}

const PRODUCT_FIELDS = ['slug', 'name', 'short_description', 'description', 'price', 'compare_at_price', 'stock', 'sku',
  'category_id', 'images', 'tags', 'highlights', 'specs', 'faqs', 'how_to_use', 'weight_grams', 'length_cm',
  'breadth_cm', 'height_cm', 'hsn_code', 'tax_rate', 'max_per_order', 'is_hidden', 'is_featured', 'sort_order',
  'tagline', 'badge', 'rated_for', 'claims', 'ingredients', 'free_from'];
const JSON_FIELDS = new Set(['images', 'highlights', 'specs', 'faqs', 'how_to_use', 'claims', 'ingredients', 'free_from']);

function productValues(input, slug) {
  const clean = {
    ...input,
    slug,
    sku: input.sku || null,
    hsn_code: input.hsn_code || null,
    category_id: input.category_id || null,
    compare_at_price: input.compare_at_price ?? null,
    weight_grams: input.weight_grams ?? null,
    length_cm: input.length_cm ?? null,
    breadth_cm: input.breadth_cm ?? null,
    height_cm: input.height_cm ?? null,
    highlights: input.highlights.filter(Boolean),
    how_to_use: input.how_to_use.filter(Boolean),
    specs: input.specs.filter((s) => s.label && s.value),
    faqs: input.faqs.filter((f) => f.q && f.a),
    tags: [...new Set(input.tags.filter(Boolean))],
    tagline: input.tagline || '',
    badge: input.badge || null,
    rated_for: [...new Set((input.rated_for || []).filter(Boolean))],
    claims: (input.claims || []).filter(Boolean),
    ingredients: (input.ingredients || []).filter((i) => i.name),
    free_from: (input.free_from || []).filter(Boolean),
  };
  return PRODUCT_FIELDS.map((f) => (JSON_FIELDS.has(f) ? JSON.stringify(clean[f]) : clean[f]));
}

/**
 * Create (id = null) or update a product with its variants, in one transaction.
 * @returns {{ product, restocked: boolean, slugChanged: boolean }}
 *   restocked = some product/variant stock went from 0 to > 0 (send back-in-stock alerts).
 */
export async function saveProduct(id, input) {
  const slug = slugify(input.slug || input.name);
  if (!slug) throw badRequest('slug: Enter a URL slug', 'validation', { field: 'slug' });
  if (input.compare_at_price != null && input.compare_at_price > 0 && input.compare_at_price <= input.price) {
    // Not fatal, but a "was" price at or below the price would show a nonsense discount.
    input = { ...input, compare_at_price: null };
  }
  try {
    return await withTransaction(async (client) => {
      const taken = await one('SELECT id FROM products WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2)', [slug, id], client);
      if (taken) throw conflict('slug: Another product already uses this URL slug.', 'slug_taken', { field: 'slug' });

      let before = null;
      let restocked = false;
      let product;
      const values = productValues(input, slug);
      if (id) {
        before = await one('SELECT id, slug, stock FROM products WHERE id = $1 FOR UPDATE', [id], client);
        if (!before) throw notFound('Product not found');
        const sets = PRODUCT_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(', ');
        product = await one(`UPDATE products SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...values], client);
      } else {
        const cols = PRODUCT_FIELDS.join(', ');
        const ph = PRODUCT_FIELDS.map((_, i) => `$${i + 1}`).join(', ');
        product = await one(`INSERT INTO products (${cols}) VALUES (${ph}) RETURNING *`, values, client);
      }

      // Slug redirects: the new slug can no longer be a redirect; the old one now points here.
      await query('DELETE FROM product_slug_redirects WHERE old_slug = $1', [slug], client);
      const slugChanged = Boolean(before && before.slug !== slug);
      if (slugChanged) {
        await query(
          `INSERT INTO product_slug_redirects (old_slug, product_id) VALUES ($1, $2)
           ON CONFLICT (old_slug) DO UPDATE SET product_id = EXCLUDED.product_id`,
          [before.slug, product.id],
          client,
        );
      }

      // Variants: update kept rows, insert new ones, delete removed ones (hide if ordered before).
      const existing = id
        ? await many('SELECT id, stock FROM product_variants WHERE product_id = $1 ORDER BY id FOR UPDATE', [id], client)
        : [];
      const existingById = new Map(existing.map((v) => [v.id, v]));
      const keep = new Set();
      for (const [index, v] of input.variants.entries()) {
        const vals = [v.name, v.sku || null, v.price ?? null, v.compare_at_price ?? null, v.stock, v.weight_grams ?? null,
          v.image || null, v.swatch || null, index, Boolean(v.is_hidden), v.badge || null];
        const prev = v.id ? existingById.get(v.id) : null;
        if (prev) {
          keep.add(v.id);
          await query(
            `UPDATE product_variants SET name = $2, sku = $3, price = $4, compare_at_price = $5, stock = $6, weight_grams = $7,
               image = $8, swatch = $9, sort_order = $10, is_hidden = $11, badge = $12 WHERE id = $1`,
            [v.id, ...vals],
            client,
          );
          if (prev.stock <= 0 && v.stock > 0) restocked = true;
        } else {
          const row = await one(
            `INSERT INTO product_variants (product_id, name, sku, price, compare_at_price, stock, weight_grams, image, swatch, sort_order, is_hidden, badge)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
            [product.id, ...vals],
            client,
          );
          keep.add(row.id);
          if (before && v.stock > 0) restocked = true;
        }
      }
      for (const v of existing) {
        if (keep.has(v.id)) continue;
        const ordered = await one('SELECT 1 FROM order_items WHERE variant_id = $1 LIMIT 1', [v.id], client);
        if (ordered) {
          // Keep the row so cancelled orders restock the right variant; it just disappears from the store.
          await query('UPDATE product_variants SET is_hidden = true, sort_order = 999 WHERE id = $1', [v.id], client);
        } else {
          await query('DELETE FROM product_variants WHERE id = $1', [v.id], client);
        }
      }
      if (before && !input.variants.length && before.stock <= 0 && product.stock > 0) restocked = true;

      return { product, restocked, slugChanged };
    });
  } catch (e) {
    return uniqueViolation(e, 'slug');
  }
}

export async function toggleProduct(id, patch) {
  const sets = [];
  const params = [id];
  for (const k of ['is_hidden', 'is_featured']) {
    if (typeof patch[k] === 'boolean') {
      params.push(patch[k]);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) throw badRequest('Nothing to update');
  const row = await one(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id, is_hidden, is_featured`, params);
  if (!row) throw notFound('Product not found');
  return row;
}

/** Products that were ever ordered are hidden instead (order_items keep their snapshots). */
export async function deleteProduct(id) {
  const ordered = await one('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [id]);
  if (ordered) {
    const row = await one('UPDATE products SET is_hidden = true, is_featured = false, updated_at = now() WHERE id = $1 RETURNING id', [id]);
    if (!row) throw notFound('Product not found');
    return { hidden: true };
  }
  const row = await one('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Product not found');
  return { deleted: true };
}

// ============================= Categories ==================================

export async function listAdminCategories() {
  return many(
    `SELECT c.*, (SELECT count(*)::int FROM products p WHERE p.category_id = c.id) AS product_count,
       COALESCE((SELECT array_agg(r.old_slug ORDER BY r.old_slug) FROM category_redirects r WHERE r.category_id = c.id), '{}') AS redirects
     FROM categories c ORDER BY c.sort_order, c.name`,
  );
}

export async function saveCategory(id, input) {
  const slug = slugify(input.slug || input.name);
  if (!slug) throw badRequest('slug: Enter a URL slug', 'validation', { field: 'slug' });
  try {
    return await withTransaction(async (client) => {
      const taken = await one('SELECT id FROM categories WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2)', [slug, id], client);
      if (taken) throw conflict('slug: Another category already uses this URL slug.', 'slug_taken', { field: 'slug' });
      const vals = [input.name, slug, input.description, input.image || null, input.sort_order, input.is_hidden];
      let row;
      if (id) {
        const before = await one('SELECT slug FROM categories WHERE id = $1 FOR UPDATE', [id], client);
        if (!before) throw notFound('Category not found');
        row = await one(
          `UPDATE categories SET name = $2, slug = $3, description = $4, image = $5, sort_order = $6, is_hidden = $7, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [id, ...vals],
          client,
        );
        if (before.slug !== slug) {
          await query(
            `INSERT INTO category_redirects (old_slug, category_id) VALUES ($1, $2)
             ON CONFLICT (old_slug) DO UPDATE SET category_id = EXCLUDED.category_id`,
            [before.slug, id],
            client,
          );
        }
      } else {
        row = await one(
          'INSERT INTO categories (name, slug, description, image, sort_order, is_hidden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
          vals,
          client,
        );
      }
      await query('DELETE FROM category_redirects WHERE old_slug = $1', [slug], client);
      return row;
    });
  } catch (e) {
    return uniqueViolation(e, 'slug');
  }
}

export async function deleteCategory(id) {
  const row = await one('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Category not found');
  return row;
}

// =============================== Coupons ===================================

export async function listAdminCoupons() {
  return many(
    `SELECT c.*, (SELECT count(*)::int FROM orders o WHERE o.coupon_id = c.id AND o.fulfillment_status <> 'cancelled') AS order_count
     FROM coupons c ORDER BY c.is_active DESC, c.created_at DESC`,
  );
}

function couponValues(input) {
  if (input.type === 'percent' && input.value > 100) throw badRequest('value: A percent coupon can be at most 100', 'validation', { field: 'value' });
  const toTs = (v, field) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw badRequest(`${field}: Invalid date`, 'validation', { field });
    return d.toISOString();
  };
  const starts = toTs(input.starts_at, 'starts_at');
  const ends = toTs(input.ends_at, 'ends_at');
  if (starts && ends && ends <= starts) throw badRequest('ends_at: The end must be after the start', 'validation', { field: 'ends_at' });
  return [input.code, input.description, input.type, input.value, input.type === 'percent' ? input.max_discount ?? null : null,
    input.min_order, starts, ends, input.usage_limit ?? null, input.first_order_only, input.show_on_site, input.is_active];
}

export async function saveCoupon(id, input) {
  const vals = couponValues(input);
  try {
    if (id) {
      const row = await one(
        `UPDATE coupons SET code = $2, description = $3, type = $4, value = $5, max_discount = $6, min_order = $7,
           starts_at = $8, ends_at = $9, usage_limit = $10, first_order_only = $11, show_on_site = $12, is_active = $13,
           updated_at = now() WHERE id = $1 RETURNING *`,
        [id, ...vals],
      );
      if (!row) throw notFound('Coupon not found');
      return row;
    }
    return await one(
      `INSERT INTO coupons (code, description, type, value, max_discount, min_order, starts_at, ends_at, usage_limit,
         first_order_only, show_on_site, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      vals,
    );
  } catch (e) {
    return uniqueViolation(e, 'coupon code');
  }
}

export async function deleteCoupon(id) {
  const row = await one('DELETE FROM coupons WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Coupon not found');
  return row;
}
