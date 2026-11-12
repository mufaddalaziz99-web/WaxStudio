import { ImageResponse } from 'next/og';
import { getSettings, SETTINGS_DEFAULTS } from '@/lib/server/settings';

export const alt = 'Hard wax powder for smooth skin at home';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

// Default social card for every page without its own image: a warm brand card (no remote images).
export default async function OpengraphImage() {
  const { store } = await getSettings().catch(() => SETTINGS_DEFAULTS);
  const brand = store.brandColor || '#d6852a';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: '#fffaf3', padding: '72px 80px', position: 'relative', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ position: 'absolute', right: -140, top: -140, width: 520, height: 520, borderRadius: 520, background: '#f9edd6', display: 'flex' }} />
        <div style={{ position: 'absolute', right: 90, bottom: -180, width: 380, height: 380, borderRadius: 380, background: '#f2d8a8', display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 56, background: brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 700 }}>
            {store.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#1f1a17', letterSpacing: -0.5 }}>{store.name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: '#1f1a17', lineHeight: 1.08, letterSpacing: -1.5 }}>
            Salon-smooth skin, at home.
          </div>
          <div style={{ fontSize: 30, color: '#4a423c', marginTop: 24, lineHeight: 1.35 }}>{store.tagline}</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {['Gentle hard wax', 'No strips needed', 'Ships across India'].map((t) => (
            <div key={t} style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: '#ffffff', border: `2px solid ${brand}`, color: '#7f3f1f', fontSize: 24, fontWeight: 600 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
