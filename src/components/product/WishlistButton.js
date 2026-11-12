'use client';
import { useWishlist } from '@/contexts/WishlistContext';
import { useToast } from '@/contexts/ToastContext';
import { HeartIcon } from '@/components/ui/Icons';

export default function WishlistButton({ productId, className = '' }) {
  const { has, toggle, hydrated } = useWishlist();
  const toast = useToast();
  const active = hydrated && has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
        toast.success(active ? 'Removed from wishlist' : 'Saved to wishlist');
      }}
      className={`rounded-full bg-white/90 p-2 shadow-sm transition hover:scale-105 ${active ? 'text-red-500' : 'text-ink-soft'} ${className}`}
      aria-pressed={active}
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <HeartIcon filled={active} width={20} height={20} />
    </button>
  );
}
