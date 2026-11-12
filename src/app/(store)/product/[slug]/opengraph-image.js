import { ImageResponse } from 'next/og';
import { getSettings, SETTINGS_DEFAULTS } from '@/lib/server/settings';
import { getProductBySlug } from '@/lib/server/catalog';
import { discountPercent, formatINR } from '@/lib/rules';

export const alt = 'Product details and price';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

function Star({ fill, color }) {
  // fill: 0..1 — partially filled star via a horizontal gradient.
  const id = `g${Math.round(fill * 100)}`;
  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fill * 100}%`} stopColor={color} />
          <stop offset={`${fill * 100}%`} stopColor="#e7ddd2" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

// SVG product photos cannot be embedded reliably here, so this is a styled text card.
export default async function ProductOgImage({ params }) {
  const { slug } = await params;
  const [{ store }, found] = await Promise.all([
    getSettings().catch(() => SETTINGS_DEFAULTS),
    getProductBySlug(slug).catch(() => null),
  ]);
  const brand = store.brandColor || '#d6852a';
  const product = found?.product || null;

  const name = product?.name || store.name;
  const subtitle = product?.shortDescription || store.tagline;
  const from = product && product.minPrice !== product.maxPrice;
  const price = product ? (from ? product.minPrice : product.price) : null;
  const compareAt = product && !from ? product.compareAtPrice : null;
  const off = price != null ? discountPercent(price, compareAt) : 0;
  const rating = product?.ratingCount > 0 ? product.ratingAvg : 0;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#fffaf3', fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -160, top: -120, width: 560, height: 560, borderRadius: 560, background: '#f9edd6', display: 'flex' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -200, width: 400, height: 400, borderRadius: 400, background: '#f2d8a8', display: 'flex' }} />
        <div style={{ width: 18, height: '100%', background: brand, display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 48, background: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 700 }}>
              {store.name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#1f1a17' }}>{store.name}</div>
            {product?.category?.name && (
              <div style={{ display: 'flex', marginLeft: 8, padding: '6px 16px', borderRadius: 999, background: '#f9edd6', color: '#7f3f1f', fontSize: 20, fontWeight: 600 }}>
                {product.category.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 900 }}>
            <div style={{ display: 'flex', fontSize: name.length > 40 ? 58 : 70, fontWeight: 700, color: '#1f1a17', lineHeight: 1.06, letterSpacing: -1.5 }}>
              {name}
            </div>
            {subtitle && (
              <div style={{ display: 'flex', fontSize: 28, color: '#4a423c', marginTop: 20, lineHeight: 1.35, maxHeight: 80, overflow: 'hidden' }}>
                {subtitle.length > 120 ? `${subtitle.slice(0, 117)}…` : subtitle}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {price != null && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                {from && <div style={{ fontSize: 28, color: '#7a706a' }}>from</div>}
                <div style={{ fontSize: 64, fontWeight: 700, color: '#1f1a17' }}>{formatINR(price)}</div>
                {off > 0 && <div style={{ fontSize: 32, color: '#7a706a', textDecoration: 'line-through' }}>{formatINR(compareAt)}</div>}
                {off > 0 && (
                  <div style={{ display: 'flex', padding: '6px 16px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontSize: 24, fontWeight: 700 }}>
                    {off}% off
                  </div>
                )}
              </div>
            )}
            {rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} fill={Math.max(0, Math.min(1, rating - (i - 1)))} color={brand} />)}
                </div>
                <div style={{ display: 'flex', fontSize: 26, color: '#4a423c', fontWeight: 600 }}>
                  {`${rating.toFixed(1)} · ${product.ratingCount} review${product.ratingCount === 1 ? '' : 's'}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
