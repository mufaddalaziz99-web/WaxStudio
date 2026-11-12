'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import ProductGallery from './ProductGallery';
import Price from './Price';
import StarRating from './StarRating';
import WishlistButton from './WishlistButton';
import PincodeCheck from './PincodeCheck';
import BackInStockForm from './BackInStockForm';
import OfferCards, { BestPriceStrip } from './OfferCards';
import QuantityStepper from '@/components/ui/QuantityStepper';
import ProductImage from '@/components/ui/ProductImage';
import { CheckIcon, ReturnIcon, ShieldIcon, ShareIcon, SparkIcon, TruckIcon, CashIcon } from '@/components/ui/Icons';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { track, insight } from '@/lib/client/analytics';
import { flyToCart } from '@/lib/client/flyToCart';
import { imageUrl } from '@/lib/imageUrl';
import { formatINR } from '@/lib/rules';

function gramsOf(name) {
  const m = String(name).match(/(\d+)\s*[x×]\s*(\d+)\s*g|(\d+)\s*g/i);
  if (!m) return null;
  return m[1] ? Number(m[1]) * Number(m[2]) : Number(m[3]);
}

/**
 * Product page buy box (gallery + details). Variant selection is mirrored to ?variant=.
 * A sticky bar with price + Add to cart appears once the main button scrolls out of view.
 */
export default function ProductView({ product, offers = [], freeShippingThreshold, codEnabled, holidayMode, holidayMessage }) {
  const { addItem, items, openDrawer } = useCart();
  const toast = useToast();
  const router = useRouter();
  const buttonRef = useRef(null);
  const buyAreaRef = useRef(null);
  const [variantId, setVariantId] = useState(product.defaultVariantId);
  const [qty, setQty] = useState(1);
  const [showSticky, setShowSticky] = useState(false);

  const variant = useMemo(() => product.variants.find((v) => v.id === variantId) || null, [product.variants, variantId]);
  const price = variant ? variant.price : product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  const stock = variant ? variant.stock : product.stock;
  const inStock = stock > 0;
  const inCart = items.find((l) => l.productId === product.id && (l.variantId || null) === (variantId || null))?.quantity || 0;
  const maxQty = Math.max(0, Math.min(stock, product.maxPerOrder) - inCart);
  const image = variant?.image || product.images[0] || null;

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('variant');
    if (v && product.variants.some((x) => x.id === v)) setVariantId(v);
    track('view_item', { currency: 'INR', value: product.price, items: [{ item_id: product.id, item_name: product.name, price: product.price }] });
    insight('view', { productId: product.id });
  }, [product.id, product.name, product.price, product.variants]);

  useEffect(() => setQty((q) => Math.max(1, Math.min(q, maxQty || 1))), [maxQty]);

  // Sticky bar when the main buy area is off-screen.
  useEffect(() => {
    const el = buyAreaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const chooseVariant = (id) => {
    setVariantId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url);
  };

  const add = (goToCheckout = false, from = buttonRef.current) => {
    if (!inStock || holidayMode) return;
    if (maxQty <= 0) {
      if (goToCheckout && inCart) return router.push('/checkout');
      toast.info('You already have the maximum quantity in your cart.');
      return undefined;
    }
    addItem({
      productId: product.id, variantId: variant?.id || null, name: product.name, variantName: variant?.name || null,
      slug: product.slug, price, compareAtPrice: compareAt, image, maxQty: Math.min(stock, product.maxPerOrder),
    }, Math.min(qty, maxQty));
    if (goToCheckout) return router.push('/checkout');
    flyToCart(from, image ? imageUrl(image, { width: 120 }) : null);
    toast.success('Added to cart', { action: { label: 'View cart', onClick: openDrawer } });
    return undefined;
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {}
  };

  const baseVariant = product.variants[0];
  const baseGrams = baseVariant ? gramsOf(baseVariant.name) : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-6 self-start lg:sticky lg:top-24">
          <ProductGallery images={product.images} name={product.name} activeImage={variant?.image} badge={product.badge} />
          <div className="hidden lg:block">
            <OfferCards offers={offers} freeShippingThreshold={freeShippingThreshold} codEnabled={codEnabled} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {product.category && <Link href={`/shop/${product.category.slug}`} className="chip-soft hover:bg-ink/10">{product.category.name}</Link>}
              {product.ratingCount > 0 && (
                <a href="#reviews" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink">
                  {product.ratingAvg.toFixed(1)} <span>★</span>
                  <span className="text-ink-muted">· {product.ratingCount} reviews</span>
                </a>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={share} className="rounded-full p-2 text-ink-soft hover:bg-ink/5" aria-label="Share"><ShareIcon width={20} height={20} /></button>
              <WishlistButton productId={product.id} className="ring-1 ring-line" />
            </div>
          </div>

          <h1 className="display mt-5 text-[44px] sm:text-[56px] lg:text-[64px]">{product.name}</h1>
          {product.tagline && <p className="mt-3 font-display text-2xl italic text-ink-soft">{product.tagline}</p>}

          {product.ratedFor.length > 0 && (
            <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <SparkIcon width={18} height={18} />
              <span className="text-ink-muted">Highly rated for</span>
              {product.ratedFor.map((r) => <span key={r} className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-ink">{r}</span>)}
            </p>
          )}

          {product.claims.length > 0 && (
            <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {product.claims.map((c) => (
                <li key={c} className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/20 text-ink"><CheckIcon width={11} height={11} /></span>{c}
                </li>
              ))}
            </ul>
          )}

          {product.hasVariants && (
            <fieldset className="mt-7">
              <legend className="label">Select size{variant ? `: ${variant.name}` : ''}</legend>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {product.variants.map((v) => {
                  const g = gramsOf(v.name);
                  const save = baseGrams && g && v.id !== baseVariant.id ? Math.round((1 - v.price / g / (baseVariant.price / baseGrams)) * 100) : 0;
                  const selected = v.id === variantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => chooseVariant(v.id)}
                      aria-pressed={selected}
                      className={`relative rounded-xl border px-3 pb-3 pt-4 text-left transition ${selected ? 'border-ink bg-white' : 'border-line bg-white/60 hover:border-ink/40'} ${!v.inStock ? 'opacity-50' : ''}`}
                    >
                      {v.badge && <span className="absolute -top-2.5 left-2 rounded-full bg-ink px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-cream">{v.badge}</span>}
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {v.swatch && <span className="h-4 w-4 rounded-full border border-ink/10" style={{ background: v.swatch }} />}
                        {v.name}
                      </span>
                      <span className="mt-1 block text-sm">{v.inStock ? formatINR(v.price) : 'Sold out'}
                        {v.inStock && v.compareAtPrice > v.price && <span className="ml-1.5 text-xs text-ink-muted line-through">{formatINR(v.compareAtPrice)}</span>}
                      </span>
                      {save > 0 && <span className="mt-0.5 block text-[11px] text-success">{save}% less per gram</span>}
                      {selected && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white"><CheckIcon width={10} height={10} /></span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-7">
            <Price price={price} compareAtPrice={compareAt} size="lg" showMrpLabel />
            <p className="mt-1 text-xs text-ink-muted">Inclusive of all taxes · Free delivery above {formatINR(freeShippingThreshold)}</p>
          </div>
          <div className="mt-4"><BestPriceStrip offers={offers} price={price} /></div>

          {inStock && stock <= 5 && <p className="mt-4 text-sm text-red-700">Hurry — only {stock} left in stock</p>}

          <div ref={buyAreaRef} className="mt-6">
            {holidayMode ? (
              <div className="rounded-xl bg-brand-100 p-4 text-sm font-semibold">{holidayMessage}</div>
            ) : inStock ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, maxQty)} />
                  <button ref={buttonRef} onClick={() => add(false)} disabled={maxQty <= 0} className="btn-primary flex-1 py-3.5">
                    {maxQty <= 0 ? 'Max in cart' : 'Add to cart'}
                  </button>
                </div>
                <button onClick={() => add(true)} disabled={maxQty <= 0 && !inCart} className="btn-accent w-full py-4 text-base">Buy it now</button>
              </div>
            ) : (
              <BackInStockForm productId={product.id} variantId={variant?.id || null} />
            )}
          </div>

          <div className="mt-6"><PincodeCheck productId={product.id} variantId={variant?.id || null} /></div>

          <ul className="mt-6 grid grid-cols-4 gap-2 border-y border-line py-5 text-center text-[11px] leading-tight text-ink-soft">
            <li className="flex flex-col items-center gap-2"><TruckIcon width={22} height={22} className="text-ink" />Fast delivery</li>
            <li className="flex flex-col items-center gap-2"><CashIcon width={22} height={22} className="text-ink" />{codEnabled ? 'COD available' : 'Easy payments'}</li>
            <li className="flex flex-col items-center gap-2"><ReturnIcon width={22} height={22} className="text-ink" />Easy replacement</li>
            <li className="flex flex-col items-center gap-2"><ShieldIcon width={22} height={22} className="text-ink" />Secure checkout</li>
          </ul>

          <div className="mt-6 lg:hidden">
            <OfferCards offers={offers} freeShippingThreshold={freeShippingThreshold} codEnabled={codEnabled} />
          </div>
        </div>
      </div>

      {/* Sticky add-to-cart bar */}
      <AnimatePresence>
        {showSticky && inStock && !holidayMode && (
          <motion.div
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur"
          >
            <div className="container-page flex items-center gap-3 py-3">
              <span className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-200 sm:block">
                <ProductImage src={image} alt="" fill sizes="48px" className="object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="hidden truncate text-sm font-bold sm:block">{product.name}{variant ? ` · ${variant.name}` : ''}</p>
                <Price price={price} compareAtPrice={compareAt} size="sm" />
              </div>
              {product.variants.length > 1 && (
                <select
                  className="input hidden w-auto py-2.5 md:block"
                  value={variantId || ''}
                  onChange={(e) => chooseVariant(e.target.value)}
                  aria-label="Size"
                >
                  {product.variants.map((v) => <option key={v.id} value={v.id} disabled={!v.inStock}>{v.name} — {formatINR(v.price)}</option>)}
                </select>
              )}
              <button onClick={(e) => add(false, e.currentTarget)} disabled={maxQty <= 0} className="btn-primary px-6 sm:px-10">Add to cart</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
