import ProductImage from '@/components/ui/ProductImage';

/** Full-width "A+ content" sections under the buy box: benefits banner, visual, free-from badges. */
export default function ProductStory({ product }) {
  const visual = product.images[2] || product.images[1] || product.images[0];
  return (
    <div className="space-y-4">
      {product.highlights.length > 0 && (
        <section className="grid grid-cols-1 overflow-hidden rounded-3xl bg-brand-100 lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">Why it works</p>
            <h2 className="display mt-4 text-5xl sm:text-6xl">{product.tagline || 'Made to lift.'}</h2>
            <ul className="mt-8 space-y-4">
              {product.highlights.map((h, i) => (
                <li key={h} className="flex items-center gap-4 border-b border-ink/10 pb-4 text-[17px] text-ink-soft last:border-0">
                  <span className="display w-8 shrink-0 text-2xl text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative min-h-[320px] bg-ink">
            <ProductImage src={visual} alt={`${product.name} results`} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        </section>
      )}
      {product.freeFrom.length > 0 && (
        <section className="flex flex-col items-center gap-6 rounded-3xl bg-ink px-6 py-12 text-cream sm:flex-row sm:justify-between sm:px-12">
          <p className="display text-center text-4xl sm:text-left">Consciously<br className="hidden sm:block" /> <span className="italic">crafted.</span></p>
          <div className="flex flex-wrap justify-center gap-4">
            {product.freeFrom.map((f) => (
              <span key={f} className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-white/20 text-center text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-white/80">
                <span className="mb-1 text-xs text-white/40">✕</span>{f}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
