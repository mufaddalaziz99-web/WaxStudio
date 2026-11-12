import { amountToFreeShipping } from '@/lib/shippingRules';
import { formatINR } from '@/lib/rules';

export default function FreeShippingBar({ subtotal, threshold }) {
  const left = amountToFreeShipping(subtotal, threshold);
  if (left === null) return null;
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="rounded-xl bg-brand-100 p-3 text-ink">
      <p className="text-xs text-ink-soft">
        {left > 0 ? <>Add <b className="font-medium text-ink">{formatINR(left)}</b> more for <b className="font-medium text-ink">free shipping</b></> : <>You&apos;ve unlocked <b className="font-medium text-ink">free shipping</b></>}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
