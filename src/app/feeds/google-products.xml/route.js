import { env } from '@/lib/server/env';
import { getSettings } from '@/lib/server/settings';
import { listProducts } from '@/lib/server/catalog';
import { feedImageUrl } from '@/lib/imageUrl';

export const revalidate = 3600;

const xml = (s) =>
  String(s ?? '')
    // strip characters that are illegal in XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const plain = (s, max = 5000) => String(s || '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const money = (rupees) => `${Number(rupees).toFixed(2)} INR`;

function tag(name, value) {
  return value === null || value === undefined || value === '' ? '' : `      <g:${name}>${xml(value)}</g:${name}>\n`;
}

/**
 * GET /feeds/google-products.xml — Google Merchant Center RSS 2.0 feed.
 * One item per visible variant (item_group_id = product id); products without variants are one item.
 */
export async function GET() {
  const base = env.siteUrl;
  const { store } = await getSettings();
  const products = await listProducts({ sort: 'featured', limit: 1000 }).catch(() => []);

  const items = [];
  for (const p of products) {
    const description = plain(p.description || p.shortDescription || p.name);
    const productType = p.category?.name || '';
    const additionalImages = p.images.slice(1, 11).map((src) => feedImageUrl(src, base)).filter(Boolean);
    const rows = p.hasVariants
      ? p.variants.map((v) => ({
          id: v.id,
          title: `${p.name} - ${v.name}`,
          price: v.price,
          compareAt: v.compareAtPrice,
          inStock: v.inStock,
          image: v.image || p.images[0],
          link: `${base}/product/${p.slug}?variant=${v.id}`,
          sku: v.sku,
          weight: v.weightGrams,
          group: p.id,
        }))
      : [{
          id: p.id,
          title: p.name,
          price: p.price,
          compareAt: p.compareAtPrice,
          inStock: p.inStock,
          image: p.images[0],
          link: `${base}/product/${p.slug}`,
          sku: p.sku,
          weight: p.weightGrams,
          group: null,
        }];

    for (const r of rows) {
      const onSale = r.compareAt && r.compareAt > r.price;
      const imageLink = feedImageUrl(r.image, base);
      let item = '    <item>\n';
      item += tag('id', r.id);
      item += tag('item_group_id', r.group);
      item += tag('title', plain(r.title, 150));
      item += tag('description', description);
      item += tag('link', r.link);
      item += tag('image_link', imageLink);
      for (const extra of additionalImages.filter((u) => u !== imageLink)) item += tag('additional_image_link', extra);
      item += tag('availability', r.inStock ? 'in_stock' : 'out_of_stock');
      item += tag('price', money(onSale ? r.compareAt : r.price));
      if (onSale) item += tag('sale_price', money(r.price));
      item += tag('brand', store.name);
      item += tag('condition', 'new');
      item += tag('mpn', r.sku);
      if (!r.sku) item += tag('identifier_exists', 'no');
      item += tag('product_type', productType);
      item += tag('google_product_category', 'Health & Beauty > Personal Care > Shaving & Grooming > Hair Removal');
      if (r.weight) item += tag('shipping_weight', `${r.weight} g`);
      item += '    </item>\n';
      items.push(item);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(store.name)}</title>
    <link>${xml(base)}</link>
    <description>${xml(store.tagline)}</description>
${items.join('')}  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
