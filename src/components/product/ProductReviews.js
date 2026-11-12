import StarRating from './StarRating';
import ReviewForm from './ReviewForm';

export default function ProductReviews({ product, reviews, breakdown }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="self-start lg:sticky lg:top-24">
          <p className="mb-3 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted"><span className="h-px w-8 bg-ink/40" />Ratings &amp; reviews</p>
          <h2 className="display text-5xl">The <span className="italic">verdict</span></h2>
          <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-line">
            <div className="flex items-end gap-3">
              <span className="display text-7xl leading-none">{product.ratingCount ? product.ratingAvg.toFixed(1) : '–'}</span>
              <div className="pb-1">
                <StarRating value={product.ratingAvg} size={18} />
                <p className="mt-1 text-xs text-ink-muted">{product.ratingCount} verified review{product.ratingCount === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="w-6">{s} ★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${total ? (breakdown[s] / total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-5 text-right">{breakdown[s]}</span>
                </div>
              ))}
            </div>
            {product.ratedFor.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">Customers love it for</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {product.ratedFor.map((r) => <span key={r} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-ink">{r}</span>)}
                </div>
              </div>
            )}
          </div>
          <ReviewForm productId={product.id} />
        </div>

        <div>
          {reviews.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-line">
              <p className="display text-3xl">No reviews yet</p>
              <p className="mt-2 text-ink-muted">Be the first to tell others how it worked for you.</p>
            </div>
          )}
          <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4">
            {reviews.map((r, i) => (
              <article key={r.id} className={`break-inside-avoid rounded-2xl p-6 ${i === 0 ? 'bg-brand-100' : 'bg-white ring-1 ring-line'}`}>
                <div className="flex items-center justify-between gap-3">
                  <StarRating value={r.rating} size={15} />
                  <span className="text-xs text-ink-muted">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {r.title && <h3 className="display mt-5 text-[26px] leading-tight">“{r.title}”</h3>}
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.body}</p>
                <p className="mt-4 flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-200 text-xs text-ink">{r.name[0]}</span>
                  <span>{r.name}</span>
                  {r.is_verified && <span className="text-xs font-semibold text-success">✓ Verified buyer</span>}
                </p>
                {r.admin_reply && <p className="mt-4 rounded-xl bg-ink/5 p-3 text-xs text-ink-soft"><b>Reply from us:</b> {r.admin_reply}</p>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
