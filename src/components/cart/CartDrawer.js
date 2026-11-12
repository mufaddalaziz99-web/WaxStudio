'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { useCartSync } from '@/hooks/useCartSync';
import CartLine from './CartLine';
import FreeShippingBar from './FreeShippingBar';
import { CloseIcon, BagIcon } from '@/components/ui/Icons';
import { formatINR } from '@/lib/rules';

export default function CartDrawer({ freeShippingThreshold }) {
  const { items, subtotal, count, drawerOpen, closeDrawer } = useCart();
  const pathname = usePathname();
  useCartSync({ enabled: drawerOpen });

  useEffect(() => {
    closeDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside
            role="dialog"
            aria-label="Your cart"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.28 }}
          >
            <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4">
              <h2 className="display text-3xl">Your cart {count > 0 && <span className="text-ink-muted">({count})</span>}</h2>
              <button onClick={closeDrawer} className="rounded-full p-2 hover:bg-ink/5" aria-label="Close cart"><CloseIcon /></button>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <span className="rounded-full bg-brand-100 p-5 text-ink"><BagIcon width={32} height={32} /></span>
                <p className="text-ink-soft">Your cart is empty.</p>
                <Link href="/shop" className="btn-primary" onClick={closeDrawer}>Start shopping</Link>
              </div>
            ) : (
              <>
                <div className="px-5 pt-4"><FreeShippingBar subtotal={subtotal} threshold={freeShippingThreshold} /></div>
                <div className="flex-1 divide-y divide-ink/5 overflow-y-auto px-5">
                  {items.map((l) => <CartLine key={`${l.productId}:${l.variantId || ''}`} line={l} compact />)}
                </div>
                <div className="space-y-3 border-t border-line bg-white px-5 py-5">
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Subtotal</span><span>{formatINR(subtotal)}</span>
                  </div>
                  <p className="text-xs text-ink-muted">Shipping and coupons are applied at checkout.</p>
                  <Link href="/checkout" className="btn-primary w-full" onClick={closeDrawer}>Checkout</Link>
                  <Link href="/cart" className="btn-ghost w-full" onClick={closeDrawer}>View cart</Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
