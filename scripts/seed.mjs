// Seeds the launch catalog (content lives in seed-data.mjs). Safe to re-run: it upserts by slug / code
// and never overwrites a product that already exists — edit that from Admin → Products.
import './_env.mjs';
import { dbConfig } from './_env.mjs';
import pg from 'pg';
import { category, product, variants, store } from './seed-data.mjs';

const client = new pg.Client(dbConfig());
await client.connect();

try {
  await client.query('BEGIN');

  const { rows: [cat] } = await client.query(
    `INSERT INTO categories (name, slug, description, sort_order)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
     RETURNING id`,
    [category.name, category.slug, category.description],
  );

  const cols = ['slug', 'name', 'tagline', 'badge', 'short_description', 'description', 'price', 'compare_at_price', 'images',
    'tags', 'rated_for', 'claims', 'free_from', 'ingredients', 'highlights', 'specs', 'faqs', 'how_to_use', 'weight_grams',
    'length_cm', 'breadth_cm', 'height_cm', 'hsn_code', 'tax_rate'];
  const json = new Set(['images', 'claims', 'free_from', 'ingredients', 'highlights', 'specs', 'faqs', 'how_to_use']);
  const values = cols.map((c) => (json.has(c) ? JSON.stringify(product[c]) : product[c]));
  const { rows: [p] } = await client.query(
    `INSERT INTO products (${cols.join(', ')}, category_id, sku, stock, is_featured, sort_order)
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, 'HRP', 0, true, 1)
     ON CONFLICT (slug) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [...values, cat.id],
  );

  const { rows: existing } = await client.query('SELECT 1 FROM product_variants WHERE product_id = $1', [p.id]);
  if (!existing.length) {
    for (const v of variants) {
      await client.query(
        `INSERT INTO product_variants (product_id, name, sku, price, compare_at_price, stock, weight_grams, badge, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [p.id, v.name, v.sku, v.price, v.compare, v.stock, v.weight, v.badge, v.sort],
      );
    }
  }

  await client.query(
    `INSERT INTO coupons (code, description, type, value, max_discount, min_order, first_order_only, show_on_site)
     VALUES ('WELCOME10', '10% off your first order', 'percent', 10, 200, 0, true, true),
            ('SMOOTH50', '₹50 off on orders above ₹499', 'flat', 50, NULL, 499, false, true)
     ON CONFLICT (upper(code)) DO NOTHING`,
  );

  await client.query(
    `INSERT INTO settings (key, value) VALUES ('store', $1), ('announcement', $2)
     ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value`,
    [
      JSON.stringify(store),
      JSON.stringify({ text: 'Free shipping above ₹499 · Code WELCOME10 for 10% off your first order · COD available' }),
    ],
  );

  await client.query('COMMIT');
  console.log(`Seed complete: ${category.name} category, ${product.name} (${variants.length} variants), 2 coupons.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
