'use client';
import Link from 'next/link';
import ProductImage from '@/components/ui/ProductImage';
import QuantityStepper from '@/components/ui/QuantityStepper';
import { TrashIcon } from '@/components/ui/Icons';
import { useCart } from '@/contexts/CartContext';
import { lineKey } from '@/lib/cartLine';
import { formatINR } from '@/lib/rules';

export default function CartLine({ line, compact = false }) {
  const { updateQty, removeItem } = useCart();
  const key = lineKey(line.productId, line.variantId);
  return (
    <div className="flex gap-4 py-4">
      <Link href={`/product/${line.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-24 sm:w-24">
        <ProductImage src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/product/${line.slug}`} className="line-clamp-2 text-sm font-semibold text-ink hover:underline decoration-brand-400 decoration-2 underline-offset-4">{line.name}</Link>
            {line.variantName && <p className="mt-0.5 text-xs text-ink-muted">{line.variantName}</p>}
          </div>
          <p className="shrink-0 text-sm font-semibold">{formatINR(line.price * line.quantity)}</p>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <QuantityStepper
            value={line.quantity}
            min={0}
            max={line.maxQty}
            size={compact ? 'sm' : 'md'}
            onChange={(q) => updateQty(key, q)}
          />
          <button onClick={() => removeItem(key)} className="rounded-full p-2 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${line.name}`}>
            <TrashIcon />
          </button>
        </div>
        {line.maxQty != null && line.quantity >= line.maxQty && line.maxQty < 10 && (
          <p className="mt-1 text-xs text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Only {line.maxQty} available</p>
        )}
      </div>
    </div>
  );
}
