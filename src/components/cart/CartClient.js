'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCartSync } from '@/hooks/useCartSync';
import CartLine from './CartLine';
import FreeShippingBar from './FreeShippingBar';
import OfferCards from '@/components/product/OfferCards';
import { ecommerce } from '@/lib/client/analytics';
import { formatINR } from '@/lib/rules';

export default function CartClient({ freeShippingThreshold, offers, codEnabled }) {
  const { items, subtotal, count, hydrated } = useCart();
  const { syncing } = useCartSync();

  useEffect(() => {
    if (hydrated && items.length) ecommerce('view_cart', items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) return <div className="container-page min-h-[50vh] py-12" aria-busy="true" />;

  if (!items.length) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-ink-muted">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/shop" className="btn-primary mt-8">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl">Your cart <span className="text-ink-muted">({count})</span></h1>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <FreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} />
          <div className="card mt-4 divide-y divide-ink/5 px-5">
            {items.map((l) => <CartLine key={`${l.productId}:${l.variantId || ''}`} line={l} />)}
          </div>
          <OfferCards offers={offers} freeShippingThreshold={0} codEnabled={codEnabled} />
        </div>
        <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl">Summary</h2>
          <div className="flex justify-between text-sm text-ink-soft"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-ink-soft"><span>Shipping</span><span>{freeShippingThreshold && subtotal >= freeShippingThreshold ? 'Free' : 'At checkout'}</span></div>
          <div className="flex justify-between border-t border-ink/5 pt-4 text-base font-bold"><span>Total</span><span>{formatINR(subtotal)}</span></div>
          <Link href="/checkout" className={`btn-primary w-full py-3.5 text-base ${syncing ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={syncing}>Checkout</Link>
          <Link href="/shop" className="btn-ghost w-full">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
