'use client';
import { MinusIcon, PlusIcon } from './Icons';
import { MAX_QTY_PER_LINE } from '@/lib/rules';

export default function QuantityStepper({ value, onChange, min = 1, max, size = 'md' }) {
  const cap = Math.min(MAX_QTY_PER_LINE, max ?? MAX_QTY_PER_LINE);
  const h = size === 'sm' ? 'h-8' : 'h-10';
  const w = size === 'sm' ? 'w-8' : 'w-10';
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-ink/15 bg-white`}>
      <button
        type="button"
        className={`${w} flex h-full items-center justify-center rounded-l-full hover:bg-ink/5 disabled:opacity-40`}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <MinusIcon />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button
        type="button"
        className={`${w} flex h-full items-center justify-center rounded-r-full hover:bg-ink/5 disabled:opacity-40`}
        onClick={() => onChange(value + 1)}
        disabled={value >= cap}
        aria-label="Increase quantity"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
