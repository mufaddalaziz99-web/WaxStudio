'use client';
import { useRef } from 'react';
import ProductImage from '@/components/ui/ProductImage';
import Price from '@/components/product/Price';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { flyToCart } from '@/lib/client/flyToCart';
import { imageUrl } from '@/lib/imageUrl';
import { formatINR } from '@/lib/rules';

/** One card per variant of the featured product (size / pack), each with its own Add to cart. */
export default function PackPicker({ product }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const refs = useRef({});
  const base = product.variants[0];
  const grams = (name) => {
    const m = String(name).match(/(\d+)\s*[x×]\s*(\d+)\s*g|(\d+)\s*g/i);
    if (!m) return null;
    return m[1] ? Number(m[1]) * Number(m[2]) : Number(m[3]);
  };
  const baseGrams = base ? grams(base.name) : null;

  const add = (v) => {
    const image = v.image || product.images[0] || null;
    addItem({
      productId: product.id, variantId: v.id, name: product.name, variantName: v.name, slug: product.slug,
      price: v.price, compareAtPrice: v.compareAtPrice, image, maxQty: Math.min(v.stock, product.maxPerOrder),
    }, 1);
    flyToCart(refs.current[v.id], image ? imageUrl(image, { width: 120 }) : null);
    toast.success(`Added · ${v.name}`, { action: { label: 'View cart', onClick: openDrawer } });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {product.variants.map((v) => {
        const g = grams(v.name);
        const perGram = g ? v.price / g : null;
        const savingVsBase = baseGrams && g && base && v.id !== base.id ? Math.round((1 - perGram / (base.price / baseGrams)) * 100) : 0;
        const featured = Boolean(v.badge);
        return (
          <div key={v.id} className={`relative flex flex-col rounded-2xl bg-white p-6 ring-1 ${featured ? 'ring-ink' : 'ring-line'}`}>
            {v.badge && <span className="absolute -top-3 right-5 rounded-full bg-ink px-3 py-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-cream">{v.badge}</span>}
            <div className="flex items-center gap-4">
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-200">
                <ProductImage src={v.image || product.images[0]} alt="" fill sizes="80px" className="object-cover" />
              </span>
              <div>
                <p className="display text-[30px]">{v.name}</p>
                {perGram && <p className="text-xs text-ink-muted">{formatINR(perGram)}/g{savingVsBase > 0 ? ` · ${savingVsBase}% cheaper per gram` : ''}</p>}
              </div>
            </div>
            <div className="mt-5">
              <Price price={v.price} compareAtPrice={v.compareAtPrice} />
            </div>
            <button
              ref={(el) => { refs.current[v.id] = el; }}
              onClick={() => add(v)}
              disabled={!v.inStock}
              className={`${featured ? 'btn-primary' : 'btn-outline'} mt-6 w-full`}
            >
              {v.inStock ? 'Add to cart' : 'Sold out'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
