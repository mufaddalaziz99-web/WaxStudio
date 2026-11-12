'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { useWishlist } from '@/contexts/WishlistContext';
import ProductCard from '@/components/product/ProductCard';

/** Wishlist ids live in WishlistContext (localStorage, synced to the account); product cards come from the API. */
export default function WishlistGrid() {
  const { ids, hydrated } = useWishlist();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const key = useMemo(() => [...ids].sort().join(','), [ids]);

  useEffect(() => {
    if (!hydrated) return undefined;
    if (!key) {
      setProducts([]);
      return undefined;
    }
    const ctrl = new AbortController();
    setError('');
    api(`/api/products/by-ids?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then(({ products: list }) => setProducts(list))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, [key, hydrated]);

  // Keep the wishlist order (newest added last) and drop cards the moment they are un-hearted.
  const visible = useMemo(() => {
    if (!products) return null;
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).reverse();
  }, [products, ids]);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Your wishlist</h1>
      <p className="mt-1 text-sm text-ink-soft">Tap the heart on any product to save it here.</p>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!visible ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: Math.min(Math.max(ids.length, 2), 4) }, (_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-square animate-pulse bg-brand-50" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-ink/5" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-ink/5" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <p className="font-display text-2xl text-ink">Nothing saved yet</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">Save products you love and come back to them any time, on any device.</p>
          <Link href="/shop" className="btn-primary mt-6">Browse products</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
