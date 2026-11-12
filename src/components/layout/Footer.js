import Link from 'next/link';
import { WhatsAppIcon } from '@/components/ui/Icons';

export default function Footer({ settings }) {
  const { store } = settings;
  const year = new Date().getFullYear();
  const wa = store.whatsapp
    ? `https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${store.name}! [ref: footer]`)}`
    : null;
  const col = (title, links) => (
    <div>
      <p className="mb-4 text-[10.5px] font-medium uppercase tracking-[0.22em] text-white/45">{title}</p>
      <ul className="space-y-2.5 text-sm text-white/75">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="display text-5xl sm:text-6xl">{store.name}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{store.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {wa && (
              <a href={wa} data-ref="footer" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15">
                <WhatsAppIcon /> WhatsApp us
              </a>
            )}
            {store.instagram && (
              <a href={store.instagram.startsWith('http') ? store.instagram : `https://instagram.com/${store.instagram.replace('@', '')}`} target="_blank" rel="noopener" className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15">
                Instagram
              </a>
            )}
          </div>
        </div>
        {col('Shop', [['/shop', 'All products'], ['/cart', 'Cart'], ['/track-order', 'Track your order'], ['/account', 'My account']])}
        {col('Help', [['/policies/shipping', 'Shipping'], ['/policies/returns', 'Returns & refunds'], ['/policies/privacy', 'Privacy'], ['/policies/terms', 'Terms']])}
        <div>
          <p className="mb-4 text-[10.5px] font-medium uppercase tracking-[0.22em] text-white/45">Talk to us</p>
          <ul className="space-y-2.5 text-sm text-white/75">
            {store.supportEmail && <li><a href={`mailto:${store.supportEmail}`} className="hover:text-white">{store.supportEmail}</a></li>}
            {store.supportPhone && <li>{store.supportPhone}</li>}
            <li><Link href="/contact" className="hover:text-white">Contact form</Link></li>
            <li><Link href="/about" className="hover:text-white">Our story</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row">
          <p>© {year} {store.legalName || store.name}. All prices include GST.</p>
          <p className="flex flex-wrap items-center gap-2">
            {['UPI', 'Cards', 'Net banking', 'Wallets', 'COD'].map((m) => (
              <span key={m} className="rounded border border-white/15 px-2 py-0.5 font-semibold text-white/70">{m}</span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
