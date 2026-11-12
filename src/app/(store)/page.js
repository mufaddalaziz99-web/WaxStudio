import Link from 'next/link';
import ProductImage from '@/components/ui/ProductImage';
import ProductCard from '@/components/product/ProductCard';
import StarRating from '@/components/product/StarRating';
import Price from '@/components/product/Price';
import HeroBuyButton from '@/components/home/HeroBuyButton';
import PackPicker from '@/components/home/PackPicker';
import SectionHeading from '@/components/ui/SectionHeading';
import JsonLd from '@/components/seo/JsonLd';
import { getApprovedReviews, getCatalogStats, getFeaturedProducts, getSiteOffers, listCategories } from '@/lib/server/catalog';
import { getSettings } from '@/lib/server/settings';
import { CheckIcon, ClockIcon, DropIcon, FeatherIcon, SparkIcon } from '@/components/ui/Icons';
import { formatINR } from '@/lib/rules';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CLAIM_ICONS = [SparkIcon, ClockIcon, DropIcon, FeatherIcon];

// Product-led landing: the featured product is the hero. Additional products and categories
// appear automatically once they are added in the admin.
export default async function HomePage() {
  const [settings, products, categories, stats, offers] = await Promise.all([
    getSettings(),
    getFeaturedProducts(8),
    listCategories(),
    getCatalogStats(),
    getSiteOffers(),
  ]);
  const hero = products[0];
  const reviews = hero ? await getApprovedReviews(hero.id, 8) : [];
  const offer = offers[0];
  const visibleCats = categories.filter((c) => c.product_count > 0);

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.store.name,
    url: siteUrl,
    ...(settings.store.supportEmail && { email: settings.store.supportEmail }),
  };

  return (
    <>
      <JsonLd data={orgLd} />

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden">
        <div className="container-page grid grid-cols-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:py-24">
          <div>
            {offer && (
              <p className="mb-8 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">
                <span className="h-px w-8 bg-ink/40" />
                {offer.type === 'percent' ? `${offer.value}% off` : `${formatINR(offer.value)} off`} · code <span className="text-ink">{offer.code}</span>
              </p>
            )}
            <h1 className="display text-[58px] sm:text-[88px] lg:text-[104px]">
              Smooth skin,<br />
              <span className="italic">naturally.</span>
            </h1>
            <p className="mt-7 max-w-md text-[17px] leading-[1.75] text-ink-soft">{hero?.shortDescription || settings.store.tagline}</p>
            {hero && (
              <>
                <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Price price={hero.minPrice} compareAtPrice={hero.minPrice === hero.price ? hero.compareAtPrice : null} size="lg" from={hero.minPrice !== hero.maxPrice} />
                  {hero.ratingCount > 0 && (
                    <a href="#reviews" className="flex items-center gap-2 text-sm text-ink-soft">
                      <StarRating value={hero.ratingAvg} size={14} />
                      <span>{hero.ratingAvg.toFixed(1)} · {hero.ratingCount} reviews</span>
                    </a>
                  )}
                </div>
                <div className="mt-9 flex flex-wrap gap-3">
                  <HeroBuyButton product={hero} className="btn-primary px-9 py-4" />
                  <Link href={`/product/${hero.slug}`} className="btn-outline px-9 py-4">Discover</Link>
                </div>
              </>
            )}
          </div>
          {hero && (
            <div className="relative mx-auto w-full max-w-[540px]">
              <Link href={`/product/${hero.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-3xl bg-brand-200">
                <ProductImage src={hero.images[0]} alt={hero.name} fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
              </Link>
              {hero.claims.slice(0, 2).map((c, i) => (
                <span
                  key={c}
                  className={`absolute flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink shadow-card ${i === 0 ? 'right-4 top-6' : 'bottom-6 left-4'}`}
                >
                  <CheckIcon width={13} height={13} /> {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───────────── Claims strip ───────────── */}
      {hero?.claims?.length > 0 && (
        <section className="border-b border-line bg-white">
          <div className="container-page grid grid-cols-2 divide-line py-6 sm:py-8 md:grid-cols-4 md:divide-x">
            {hero.claims.slice(0, 4).map((c, i) => {
              const Icon = CLAIM_ICONS[i % CLAIM_ICONS.length];
              return (
                <div key={c} className="flex items-center gap-3 px-2 py-2 md:justify-center md:px-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/20"><Icon width={18} height={18} /></span>
                  <span className="text-[13px] leading-tight text-ink-soft">{c}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───────────── Pick your pack ───────────── */}
      {hero?.variants?.length > 1 && (
        <section className="container-page py-20">
          <SectionHeading eyebrow="Pick your pack" title="Choose your size" href={`/product/${hero.slug}`} linkLabel="Full details" />
          <div className="mt-10"><PackPicker product={hero} /></div>
        </section>
      )}

      {/* ───────────── Bestsellers (as the catalog grows) ───────────── */}
      {products.length > 1 && (
        <section className="container-page pb-20">
          <SectionHeading eyebrow="The lineup" title="Bestsellers" href="/shop" />
          <div className="no-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="w-[75%] shrink-0 snap-start sm:w-auto"><ProductCard product={p} /></div>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── Why powder ───────────── */}
      <section className="bg-brand-100">
        <div className="container-page grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-2">
          <div>
            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">Why hair removal powder</p>
            <h2 className="display text-5xl sm:text-7xl">No heat.<br /><span className="italic">No</span> razor.</h2>
            <p className="mt-6 max-w-md text-[17px] leading-[1.75] text-ink-soft">
              A razor only cuts hair at the surface, and hot wax needs heating and practice. Hair removal powder just mixes with water — apply it, let it dry and wipe the hair away.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">
                  <th className="p-4 font-medium" />
                  <th className="p-4 font-medium text-ink">Powder</th>
                  <th className="p-4 font-medium">Razor</th>
                  <th className="p-4 font-medium">Hot wax</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['No heating needed', true, true, false],
                  ['No cuts or nicks', true, false, true],
                  ['Longer-lasting smoothness', true, false, true],
                  ['Easy for beginners', true, true, false],
                ].map(([label, ...vals]) => (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="p-4 text-ink-soft">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="p-4">
                        {v ? <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${i === 0 ? 'bg-ink text-cream' : 'border border-line text-ink-muted'}`}><CheckIcon width={12} height={12} /></span> : <span className="text-ink-muted/50">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ───────────── How it works ───────────── */}
      {hero?.howToUse?.length > 0 && (
        <section className="container-page py-20">
          <SectionHeading eyebrow="How to use" title="Smooth in three steps" />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {hero.howToUse.slice(0, 3).map((s, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl bg-white p-7 ring-1 ring-line">
                <span className="display absolute -right-2 -top-6 text-[140px] text-ink/[0.05]">{String(i + 1).padStart(2, '0')}</span>
                <p className="relative display text-[34px]">{['Mix', 'Apply', 'Wipe off'][i] || `Step ${i + 1}`}</p>
                <p className="relative mt-3 max-w-[18rem] leading-relaxed text-ink-soft">{s}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── Ingredients + free-from ───────────── */}
      {hero && (hero.ingredients.length > 0 || hero.freeFrom.length > 0) && (
        <section className="bg-ink py-20 text-white">
          <div className="container-page">
            <SectionHeading eyebrow="What's inside" title="Simply natural" dark />
            {hero.ingredients.length > 0 && (
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                {hero.ingredients.map((ing) => (
                  <div key={ing.name} className="border-t border-white/15 pt-6">
                    <p className="display text-[28px] text-cream">{ing.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{ing.benefit}</p>
                  </div>
                ))}
              </div>
            )}
            {hero.freeFrom.length > 0 && (
              <div className="mt-12 flex flex-wrap items-center gap-6">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/50">Free from</p>
                {hero.freeFrom.map((f) => (
                  <span key={f} className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-white/20 text-center text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-white/80">
                    <span className="mb-1 text-xs text-white/40">✕</span>{f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───────────── Reviews ───────────── */}
      {reviews.length > 0 && (
        <section id="reviews" className="container-page scroll-mt-24 py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="Real reviews" title="What customers say" />
            {stats?.reviews > 0 && (
              <div className="flex items-center gap-3">
                <span className="display text-6xl">{Number(stats.avg_rating).toFixed(1)}</span>
                <div><StarRating value={Number(stats.avg_rating)} size={18} /><p className="text-xs text-ink-muted">{stats.reviews} verified reviews</p></div>
              </div>
            )}
          </div>
          <div className="no-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
            {reviews.map((r, i) => (
              <figure key={r.id} className={`w-[85%] shrink-0 snap-start rounded-2xl p-6 sm:w-[340px] ${i % 3 === 1 ? 'bg-brand-100' : 'bg-white ring-1 ring-line'}`}>
                <StarRating value={r.rating} size={16} />
                {r.title && <p className="mt-5 display text-[26px] leading-tight">“{r.title}”</p>}
                <blockquote className="mt-3 text-sm leading-relaxed text-ink-soft">{r.body}</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-200 text-xs font-medium text-ink">{r.name[0]}</span>
                  <span><b>{r.name}</b>{r.is_verified && <span className="block text-xs text-success">✓ Verified buyer</span>}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── Categories (as the catalog grows) ───────────── */}
      {visibleCats.length > 1 && (
        <section className="container-page pb-20">
          <SectionHeading eyebrow="Shop by need" title="Categories" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {visibleCats.map((c) => (
              <Link key={c.id} href={`/shop/${c.slug}`} className="display rounded-2xl bg-white p-8 text-center text-3xl ring-1 ring-line transition hover:ring-ink">{c.name}</Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── FAQ ───────────── */}
      {hero?.faqs?.length > 0 && (
        <section className="container-page grid grid-cols-1 gap-10 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="self-start lg:sticky lg:top-24"><SectionHeading eyebrow="FAQ" title="Got questions?" /></div>
          <div className="divide-y divide-line border-y border-line">
            {hero.faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px]">
                  {f.q}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/20 text-base font-light transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pr-12 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── Final CTA ───────────── */}
      {hero && (
        <section className="container-page">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-cream sm:px-14">
            <p className="display text-6xl sm:text-8xl">Silky smooth,<br /><span className="italic text-brand-400">no heat needed.</span></p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <HeroBuyButton product={hero} className="btn bg-cream px-9 py-4 text-ink hover:bg-white" />
              <span className="text-sm text-cream/60">Free shipping above {formatINR(settings.shipping.freeShippingThreshold)}{settings.payments.codEnabled ? ' · COD available' : ''}</span>
            </div>
            <div className="pointer-events-none absolute -bottom-10 -right-10 hidden h-72 w-72 rotate-12 overflow-hidden rounded-3xl md:block">
              <ProductImage src={hero.images[0]} alt="" fill sizes="288px" className="object-cover" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
