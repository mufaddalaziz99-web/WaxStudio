'use client';
import { useState } from 'react';
import ProductImage from '@/components/ui/ProductImage';
import { formatINR } from '@/lib/rules';

export function Totals({ totals, compact = false }) {
  const row = (label, value, cls = '') => (
    <div className={`flex justify-between ${cls}`}><span>{label}</span><span>{value}</span></div>
  );
  return (
    <div className={`space-y-2 text-sm text-ink-soft ${compact ? '' : 'border-t border-ink/5 pt-4'}`}>
      {row('Items', formatINR(totals.itemsTotal))}
      {totals.discount > 0 && row(`Discount${totals.couponCode ? ` (${totals.couponCode})` : ''}`, `−${formatINR(totals.discount)}`, 'text-green-700')}
      {row('Shipping', totals.shipping == null ? 'Calculated next' : totals.shipping === 0 ? 'Free' : formatINR(totals.shipping))}
      {totals.codFee > 0 && row('Cash on Delivery fee', formatINR(totals.codFee))}
      {totals.giftWrapFee > 0 && row('Gift wrap', formatINR(totals.giftWrapFee))}
      <div className="flex justify-between border-t border-ink/5 pt-3 text-base font-bold text-ink">
        <span>Total</span><span>{formatINR(totals.total)}</span>
      </div>
      <p className="text-xs text-ink-muted">Inclusive of all taxes</p>
    </div>
  );
}

export default function OrderSummary({ items, totals }) {
  const [open, setOpen] = useState(false);
  const lines = (
    <ul className="divide-y divide-ink/5">
      {items.map((l) => (
        <li key={`${l.productId}:${l.variantId || ''}`} className="flex items-center gap-3 py-3">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">
            <ProductImage src={l.image} alt={l.name} fill sizes="56px" className="object-cover" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{l.quantity}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1 text-sm font-medium">{l.name}</span>
            {l.variantName && <span className="block text-xs text-ink-muted">{l.variantName}</span>}
          </span>
          <span className="text-sm font-semibold">{formatINR(l.price * l.quantity)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {/* Mobile: collapsible */}
      <div className="card mb-6 p-4 lg:hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-semibold" aria-expanded={open}>
          <span>{open ? 'Hide' : 'Show'} order summary ({items.reduce((s, l) => s + l.quantity, 0)})</span>
          <span>{formatINR(totals.total)}</span>
        </button>
        {open && <div className="mt-3">{lines}<Totals totals={totals} /></div>}
      </div>
      {/* Desktop: sticky sidebar */}
      <aside className="card sticky top-24 hidden p-6 lg:block">
        <h2 className="mb-2 font-display text-xl">Order summary</h2>
        {lines}
        <Totals totals={totals} />
      </aside>
    </>
  );
}
