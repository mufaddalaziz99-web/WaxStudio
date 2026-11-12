import { discountPercent, formatINR } from '@/lib/rules';

/** Price + struck MRP + quiet "% off". size: sm | md | lg */
export default function Price({ price, compareAtPrice, size = 'md', from = false, showMrpLabel = false }) {
  const off = discountPercent(price, compareAtPrice);
  const sizes = {
    sm: ['text-[15px] font-medium', 'text-xs', 'text-[11px]'],
    md: ['text-lg font-medium', 'text-sm', 'text-xs'],
    lg: ['text-[34px] font-normal tracking-tight', 'text-sm', 'text-xs'],
  }[size];
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className={`${sizes[0]} text-ink`}>
        {from && <span className="mr-1 text-xs text-ink-muted">from</span>}
        {formatINR(price)}
      </span>
      {off > 0 && (
        <>
          <span className={`${sizes[1]} text-ink-muted`}>
            {showMrpLabel && 'MRP '}<span className="line-through decoration-ink-muted/60">{formatINR(compareAtPrice)}</span>
          </span>
          <span className={`${sizes[2]} font-medium uppercase tracking-[0.12em] text-success`}>{off}% off</span>
        </>
      )}
    </span>
  );
}
