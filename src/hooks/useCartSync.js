'use client';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/client/api';

/**
 * Re-reads live price and stock for every cart line. Lines whose product/variant was removed
 * or sold out are dropped, and quantities are clamped. Returns { syncing, synced }.
 */
export function useCartSync({ enabled = true } = {}) {
  const { items, hydrated, applyLookup } = useCart();
  const toast = useToast();
  const [state, setState] = useState({ syncing: false, synced: false });
  const keyRef = useRef('');

  const key = items.map((l) => `${l.productId}:${l.variantId || ''}`).sort().join('|');

  useEffect(() => {
    if (!enabled || !hydrated) return undefined;
    if (!items.length) {
      setState({ syncing: false, synced: true });
      return undefined;
    }
    if (keyRef.current === key) return undefined;
    keyRef.current = key;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, syncing: true }));
    api('/api/products/lookup', {
      method: 'POST',
      body: { items: items.map((l) => ({ productId: l.productId, variantId: l.variantId || null })) },
      signal: ctrl.signal,
    })
      .then(({ items: live }) => {
        const gone = live.filter((l) => !l.available);
        const lowered = live.filter((l) => {
          const cur = items.find((c) => c.productId === l.productId && (c.variantId || null) === (l.variantId || null));
          return l.available && cur && cur.quantity > l.maxQty;
        });
        applyLookup(live);
        if (gone.length) toast.info(`${gone.length} item${gone.length > 1 ? 's were' : ' was'} removed — no longer available.`);
        else if (lowered.length) toast.info('Some quantities were reduced to match available stock.');
        setState({ syncing: false, synced: true });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setState({ syncing: false, synced: true });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hydrated, key]);

  return state;
}
