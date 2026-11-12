'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { WISHLIST_STORAGE_KEY } from '@/lib/rules';
import { track } from '@/lib/client/analytics';

const WishlistContext = createContext(null);

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Wishlist of product ids, in localStorage; mirrored to the account by AccountSync. */
export function WishlistProvider({ children }) {
  const [ids, setIds] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(read());
    setHydrated(true);
    const onStorage = (e) => e.key === WISHLIST_STORAGE_KEY && setIds(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  }, [ids, hydrated]);

  const toggle = useCallback((productId) => {
    setIds((prev) => {
      const has = prev.includes(productId);
      if (!has) track('add_to_wishlist', { items: [{ item_id: productId }] });
      return has ? prev.filter((x) => x !== productId) : [...prev, productId];
    });
  }, []);

  const merge = useCallback((more) => setIds((prev) => [...new Set([...prev, ...(more || [])])]), []);

  const value = useMemo(() => ({ ids, hydrated, has: (id) => ids.includes(id), toggle, merge, setIds }), [ids, hydrated, toggle, merge]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
