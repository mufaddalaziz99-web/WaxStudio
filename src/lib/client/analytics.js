'use client';
// GA4 helpers. Never send names, emails, phones or addresses — only products, amounts and the order number.

export function track(event, params = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
    if (process.env.NODE_ENV !== 'production') console.debug('[ga4]', event, params);
  } catch {}
}

export function gaItem(line, index) {
  return {
    item_id: line.variantId ? `${line.productId}:${line.variantId}` : line.productId,
    item_name: line.name,
    item_variant: line.variantName || undefined,
    price: line.price,
    quantity: line.quantity,
    index,
  };
}

export function ecommerce(event, lines, extra = {}) {
  const value = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  track(event, { currency: 'INR', value, items: lines.map(gaItem), ...extra });
}

/** Internal insights (product views, add-to-cart counts) — fire and forget. */
export function insight(type, data = {}) {
  try {
    const body = JSON.stringify({ type, ...data });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/insights', new Blob([body], { type: 'application/json' }));
    else fetch('/api/insights', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  } catch {}
}
