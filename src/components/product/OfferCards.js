'use client';
import { useToast } from '@/contexts/ToastContext';
import { formatINR } from '@/lib/rules';
import { TagIcon } from '@/components/ui/Icons';

/** Discount a site offer gives on `amount` (0 when the minimum order is not met). */
export function offerDiscount(o, amount) {
  if (amount < (o.min_order || 0)) return 0;
  let d = o.type === 'percent' ? Math.floor((amount * o.value) / 100) : o.value;
  if (o.type === 'percent' && o.max_discount) d = Math.min(d, o.max_discount);
  return Math.min(d, amount);
}

/** Best price available today with a site coupon (Tira-style "Get it for ₹X"). */
export function bestOffer(offers, amount) {
  let best = null;
  for (const o of offers || []) {
    const d = offerDiscount(o, amount);
    if (d > 0 && (!best || d > best.discount)) best = { ...o, discount: d };
  }
  return best;
}

export function BestPriceStrip({ offers, price }) {
  const toast = useToast();
  const best = bestOffer(offers, price);
  if (!best) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(best.code).catch(() => {});
        toast.success(`Code ${best.code} copied — apply it at checkout`);
      }}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left ring-1 ring-line transition hover:ring-ink/40"
    >
      <span className="flex items-center gap-2.5 text-sm">
        <TagIcon width={18} height={18} />
        <span>
          Get it for <b className="font-medium">{formatINR(price - best.discount)}</b> with code <b className="font-medium tracking-[0.12em]">{best.code}</b>
          {best.first_order_only && <span className="text-ink-muted"> · first order</span>}
        </span>
      </span>
      <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">Copy</span>
    </button>
  );
}

export default function OfferCards({ offers = [], freeShippingThreshold, codEnabled, title = 'Offers for you' }) {
  const toast = useToast();
  const cards = [
    ...offers.map((o) => ({
      key: o.code,
      title: o.type === 'percent' ? `${o.value}% off${o.max_discount ? ` up to ${formatINR(o.max_discount)}` : ''}` : `${formatINR(o.value)} off`,
      text: `${o.description || ''}${o.min_order ? ` · above ${formatINR(o.min_order)}` : ''}`,
      code: o.code,
    })),
    ...(freeShippingThreshold > 0 ? [{ key: 'ship', title: 'Free shipping', text: `On orders above ${formatINR(freeShippingThreshold)}` }] : []),
    ...(codEnabled ? [{ key: 'cod', title: 'Cash on Delivery', text: 'Pay when your order arrives' }] : []),
  ];
  if (!cards.length) return null;
  return (
    <div>
      <p className="label">{title}</p>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {cards.map((c) => (
          <div key={c.key} className="relative min-w-[210px] overflow-hidden rounded-xl bg-white p-4 ring-1 ring-line">
            <p className="font-display text-xl">{c.title}</p>
            <p className="mt-1 text-xs text-ink-muted">{c.text}</p>
            {c.code && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(c.code).catch(() => {});
                  toast.success(`Code ${c.code} copied`);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-ink/30 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-ink"
              >
                {c.code} <span className="text-[10px] text-ink-muted">COPY</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
