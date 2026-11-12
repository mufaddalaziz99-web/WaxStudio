'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { api } from '@/lib/client/api';

/**
 * Signed-in customers: mirror cart + wishlist to /api/account/saved so they follow the
 * customer across devices. On sign-in the guest cart is merged into the account's.
 */
export default function AccountSync() {
  const { user } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const mergedFor = useRef(null);
  const timer = useRef(null);
  const { mergeLines } = cart;
  const { merge } = wishlist;

  useEffect(() => {
    if (!user || !cart.hydrated || !wishlist.hydrated || mergedFor.current === user.id) return;
    mergedFor.current = user.id;
    api('/api/account/saved')
      .then(({ cart: savedCart, wishlist: savedWishlist }) => {
        mergeLines(savedCart || []);
        merge(savedWishlist || []);
      })
      .catch(() => {});
  }, [user, cart.hydrated, wishlist.hydrated, mergeLines, merge]);

  useEffect(() => {
    if (!user) mergedFor.current = null;
  }, [user]);

  useEffect(() => {
    if (!user || mergedFor.current !== user.id) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const lines = cart.items.map(({ productId, variantId, name, variantName, slug, price, image, maxQty, quantity }) => ({
        productId, variantId, name, variantName, slug, price, image, maxQty, quantity,
      }));
      api('/api/account/saved', { method: 'PUT', body: { cart: lines, wishlist: wishlist.ids } }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer.current);
  }, [user, cart.items, wishlist.ids]);

  return null;
}
