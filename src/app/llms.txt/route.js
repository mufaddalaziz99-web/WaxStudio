import { env } from '@/lib/server/env';
import { getSettings } from '@/lib/server/settings';
import { listCategories, listProducts } from '@/lib/server/catalog';
import { formatINR } from '@/lib/rules';

export const revalidate = 3600;

const oneLine = (s, max = 300) => {
  const t = String(s || '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// GET /llms.txt — a plain-text / markdown summary of the store for AI assistants (llmstxt.org format).
export async function GET() {
  const base = env.siteUrl;
  const settings = await getSettings();
  const { store, shipping, payments } = settings;
  const [products, categories] = await Promise.all([
    listProducts({ sort: 'featured', limit: 200 }).catch(() => []),
    listCategories().catch(() => []),
  ]);

  const lines = [];
  lines.push(`# ${store.name}`, '');
  lines.push(`> ${oneLine(store.tagline)}. Online store shipping across India; prices in Indian Rupees (INR), GST included.`, '');

  const facts = [];
  if (shipping.freeShippingThreshold > 0) facts.push(`Free shipping on orders of ${formatINR(shipping.freeShippingThreshold)} or more.`);
  facts.push(`Typical delivery: ${shipping.flatRateEtaDays || '4–7'} business days after dispatch.`);
  if (payments.codEnabled) facts.push('Cash on delivery available on eligible pincodes.');
  facts.push('Online payment by UPI, cards, net banking and wallets.');
  lines.push(...facts.map((f) => `- ${f}`), '');

  lines.push('## Products', '');
  for (const p of products) {
    const price = p.minPrice !== p.maxPrice ? `${formatINR(p.minPrice)}–${formatINR(p.maxPrice)}` : formatINR(p.price);
    const rating = p.ratingCount > 0 ? `, rated ${p.ratingAvg.toFixed(1)}/5 (${p.ratingCount} reviews)` : '';
    const stock = p.inStock ? '' : ', currently out of stock';
    const summary = oneLine(p.shortDescription || p.description, 220);
    lines.push(`- [${p.name}](${base}/product/${p.slug}): ${price}${rating}${stock}.${summary ? ` ${summary}` : ''}`);
    if (p.hasVariants && p.variants.length > 1) {
      for (const v of p.variants) {
        lines.push(`  - ${v.name}: ${formatINR(v.price)}${v.inStock ? '' : ' (out of stock)'} — ${base}/product/${p.slug}?variant=${v.id}`);
      }
    }
  }
  lines.push('');

  const cats = categories.filter((c) => c.product_count > 0);
  if (cats.length) {
    lines.push('## Categories', '');
    for (const c of cats) lines.push(`- [${c.name}](${base}/shop/${c.slug})${c.description ? `: ${oneLine(c.description, 160)}` : ''}`);
    lines.push('');
  }

  lines.push('## Help', '');
  lines.push(`- [Shop all products](${base}/shop)`);
  lines.push(`- [Track an order](${base}/track-order): order number + phone number`);
  lines.push(`- [Shipping policy](${base}/policies/shipping)`);
  lines.push(`- [Refund & cancellation policy](${base}/policies/returns)`);
  lines.push(`- [Privacy policy](${base}/policies/privacy)`);
  lines.push(`- [Terms of service](${base}/policies/terms)`);
  lines.push(`- [About us](${base}/about)`);
  lines.push(`- [Contact](${base}/contact)${store.supportEmail ? ` — ${store.supportEmail}` : ''}`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
