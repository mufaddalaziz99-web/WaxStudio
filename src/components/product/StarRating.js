import { StarIcon } from '@/components/ui/Icons';

export default function StarRating({ value = 0, count, size = 16, showValue = false, className = '' }) {
  const stars = [1, 2, 3, 4, 5].map((i) => Math.max(0, Math.min(1, value - (i - 1))));
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`Rated ${Number(value).toFixed(1)} out of 5${count != null ? ` from ${count} reviews` : ''}`}>
      <span className="inline-flex">{stars.map((f, i) => <StarIcon key={i} fill={f} size={size} />)}</span>
      {showValue && <span className="text-sm font-semibold text-ink">{Number(value).toFixed(1)}</span>}
      {count != null && <span className="text-xs text-ink-muted">({count})</span>}
    </span>
  );
}
