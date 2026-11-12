'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CART_STORAGE_KEY, MAX_CART_LINES, MAX_QTY_PER_LINE } from '@/lib/rules';
import { lineKey } from '@/lib/cartLine';
import { ecommerce, insight } from '@/lib/client/analytics';

const CartContext = createContext(null);

function clampQty(qty, maxQty) {
  const cap = Math.min(MAX_QTY_PER_LINE, maxQty ?? MAX_QTY_PER_LINE);
  return Math.max(0, Math.min(Math.floor(qty) || 0, cap));
}

function readStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.productId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Cart lives in localStorage and syncs across tabs. A line is keyed by product + variant;
 * quantity is clamped to stock and a per-line maximum. Persistence is gated on `hydrated`
 * so the saved cart can never be overwritten with an empty one.
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const skipNextWrite = useRef(false);

  useEffect(() => {
    setItems(readStorage());
    setHydrated(true);
    const onStorage = (e) => {
      if (e.key !== CART_STORAGE_KEY) return;
      skipNextWrite.current = true;
      setItems(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const addItem = useCallback((item, quantity = 1) => {
    const key = lineKey(item.productId, item.variantId);
    let added = 0;
    setItems((prev) => {
      const existing = prev.find((l) => lineKey(l.productId, l.variantId) === key);
      if (existing) {
        const qty = clampQty(existing.quantity + quantity, item.maxQty ?? existing.maxQty);
        added = qty - existing.quantity;
        return prev.map((l) => (l === existing ? { ...l, ...item, quantity: qty } : l));
      }
      if (prev.length >= MAX_CART_LINES) return prev;
      const qty = clampQty(quantity, item.maxQty);
      added = qty;
      return qty > 0 ? [...prev, { ...item, variantId: item.variantId || null, quantity: qty }] : prev;
    });
    ecommerce('add_to_cart', [{ ...item, quantity }]);
    insight('add_to_cart', { productId: item.productId });
    return added;
  }, []);

  const updateQty = useCallback((key, quantity) => {
    setItems((prev) => {
      const line = prev.find((l) => lineKey(l.productId, l.variantId) === key);
      if (!line) return prev;
      const qty = clampQty(quantity, line.maxQty);
      if (qty === line.quantity) return prev;
      const diff = qty - line.quantity;
      ecommerce(diff > 0 ? 'add_to_cart' : 'remove_from_cart', [{ ...line, quantity: Math.abs(diff) }]);
      return qty === 0 ? prev.filter((l) => l !== line) : prev.map((l) => (l === line ? { ...l, quantity: qty } : l));
    });
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => {
      const line = prev.find((l) => lineKey(l.productId, l.variantId) === key);
      if (line) ecommerce('remove_from_cart', [line]);
      return prev.filter((l) => l !== line);
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  /** Replace lines with server-validated data (live price/stock). */
  const applyLookup = useCallback((lookups) => {
    setItems((prev) => {
      let changed = false;
      const next = [];
      for (const l of prev) {
        const live = lookups.find((x) => x.productId === l.productId && (x.variantId || null) === (l.variantId || null));
        if (!live) {
          next.push(l);
          continue;
        }
        if (!live.available) {
          changed = true;
          continue;
        }
        const qty = clampQty(l.quantity, live.maxQty);
        const updated = {
          ...l, name: live.name, variantName: live.variantName, slug: live.slug, image: live.image,
          price: live.price, compareAtPrice: live.compareAtPrice, maxQty: live.maxQty, quantity: qty,
        };
        if (qty === 0) {
          changed = true;
          continue;
        }
        if (qty !== l.quantity || live.price !== l.price || live.maxQty !== l.maxQty || live.name !== l.name) changed = true;
        next.push(updated);
      }
      return changed ? next : prev;
    });
  }, []);

  /** Merge lines (e.g. the account's saved cart on sign-in). */
  const mergeLines = useCallback((lines) => {
    setItems((prev) => {
      const map = new Map(prev.map((l) => [lineKey(l.productId, l.variantId), l]));
      for (const l of lines || []) {
        if (!l?.productId) continue;
        const k = lineKey(l.productId, l.variantId);
        const cur = map.get(k);
        map.set(k, cur ? { ...cur, quantity: clampQty(Math.max(cur.quantity, l.quantity), cur.maxQty) } : { ...l, variantId: l.variantId || null });
      }
      return [...map.values()].slice(0, MAX_CART_LINES);
    });
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    setItems((cur) => {
      if (cur.length) ecommerce('view_cart', cur);
      return cur;
    });
  }, []);

  const value = useMemo(() => {
    const count = items.reduce((s, l) => s + l.quantity, 0);
    const subtotal = items.reduce((s, l) => s + l.price * l.quantity, 0);
    return {
      items, hydrated, count, subtotal, drawerOpen,
      addItem, updateQty, removeItem, clear, applyLookup, mergeLines,
      openDrawer, closeDrawer: () => setDrawerOpen(false),
    };
  }, [items, hydrated, drawerOpen, addItem, updateQty, removeItem, clear, applyLookup, mergeLines, openDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
