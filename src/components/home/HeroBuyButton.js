'use client';
import { useRef } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { flyToCart } from '@/lib/client/flyToCart';
import { imageUrl } from '@/lib/imageUrl';

/** Quick add of the featured product's default variant from the hero. */
export default function HeroBuyButton({ product, className = 'btn-accent px-8 py-4 text-base' }) {
  const { addItem, openDrawer } = useCart();
  const toast = useToast();
  const ref = useRef(null);
  const variant = product.variants.find((v) => v.id === product.defaultVariantId) || null;
  const stock = variant ? variant.stock : product.stock;
  if (stock <= 0) return null;
  const onClick = () => {
    const image = variant?.image || product.images[0] || null;
    addItem({
      productId: product.id, variantId: variant?.id || null, name: product.name, variantName: variant?.name || null,
      slug: product.slug, price: variant ? variant.price : product.price, compareAtPrice: variant ? variant.compareAtPrice : product.compareAtPrice,
      image, maxQty: Math.min(stock, product.maxPerOrder),
    }, 1);
    flyToCart(ref.current, image ? imageUrl(image, { width: 120 }) : null);
    toast.success(`Added${variant ? ` · ${variant.name}` : ''}`, { action: { label: 'View cart', onClick: openDrawer } });
  };
  return (
    <button ref={ref} onClick={onClick} className={className}>
      Add to cart{variant ? ` · ${variant.name}` : ''}
    </button>
  );
}
