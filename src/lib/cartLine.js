// A cart line is keyed by product + variant.
export function lineKey(productId, variantId) {
  return `${productId}:${variantId || ''}`;
}

/** Merge duplicate lines (same product + variant), summing quantities. */
export function mergeLines(items) {
  const map = new Map();
  for (const it of items) {
    const k = lineKey(it.productId, it.variantId);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, quantity: prev.quantity + it.quantity } : { ...it });
  }
  return [...map.values()];
}
