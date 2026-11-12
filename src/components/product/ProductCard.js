'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import ProductImage from '@/components/ui/ProductImage';
import Price from './Price';
import StarRating from './StarRating';
import WishlistButton from './WishlistButton';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { flyToCart } from '@/lib/client/flyToCart';
import { imageUrl } from '@/lib/imageUrl';

/**
 * Product card: badge, wishlist, image (second image on hover), rating, price + save pill,
 * size chips and a full-width Add to cart — no need to open the product page.
 */
export default function ProductCard({ product, priority = false, dark = false }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const btn = useRef(null);
  const [variantId, setVariantId] = useState(product.defaultVariantId);
  const variant = product.variants.find((v) => v.id === variantId) || null;
  const price = variant ? variant.price : product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  const stock = variant ? variant.stock : product.stock;
  const subtitle = product.ratedFor?.length ? product.ratedFor.join(' · ') : product.tagline;

  const add = () => {
    const image = variant?.image || product.images[0] || null;
    addItem({
      productId: product.id, variantId: variant?.id || null, name: product.name, variantName: variant?.name || null,
      slug: product.slug, price, compareAtPrice: compareAt, image, maxQty: Math.min(stock, product.maxPerOrder),
    }, 1);
    flyToCart(btn.current, image ? imageUrl(image, { width: 120 }) : null);
    toast.success(`Added${variant ? ` · ${variant.name}` : ''}`, { action: { label: 'View cart', onClick: openDrawer } });
  };

  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-2xl ${dark ? 'bg-[#1b1b1b] text-white ring-1 ring-white/10' : 'bg-white ring-1 ring-line'}`}>
      <Link href={`/product/${product.slug}${variant ? `?variant=${variant.id}` : ''}`} className="relative block aspect-square overflow-hidden bg-brand-200">
        <ProductImage
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 40vw, 80vw"
          priority={priority}
          className={`object-cover transition duration-500 ${product.images[1] ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
        />
        {product.images[1] && (
          <ProductImage src={product.images[1]} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
        )}
        {product.badge && product.inStock && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-ink">{product.badge}</span>}
        {!product.inStock && <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-cream">Sold out</span>}
        <WishlistButton productId={product.id} className="absolute right-3 top-3" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {product.ratingCount > 0 && <StarRating value={product.ratingAvg} count={product.ratingCount} size={13} />}
        <Link href={`/product/${product.slug}`} className="mt-1.5">
          <h3 className="line-clamp-2 font-display text-[22px] leading-tight">{product.name}</h3>
        </Link>
        {subtitle && <p className={`mt-1 line-clamp-1 text-xs ${dark ? 'text-white/60' : 'text-ink-muted'}`}>{subtitle}</p>}
        <div className={`mt-3 ${dark ? '[&_*]:!text-white [&_.bg-brand-400]:!text-ink' : ''}`}>
          <Price price={price} compareAtPrice={compareAt} size="sm" />
        </div>
        {product.variants.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variantId}
                onClick={() => setVariantId(v.id)}
                disabled={!v.inStock}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition disabled:line-through disabled:opacity-40 ${
                  v.id === variantId
                    ? dark ? 'border-brand-400 bg-brand-400 text-ink' : 'border-ink bg-ink text-white'
                    : dark ? 'border-white/25 hover:border-white' : 'border-line hover:border-ink'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto pt-4">
          <button
            ref={btn}
            type="button"
            onClick={add}
            disabled={stock <= 0}
            className={`${dark ? 'btn-accent' : 'btn-primary'} w-full py-2.5 text-xs`}
          >
            {stock <= 0 ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
