import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/orderRules';

const TONES = {
  placed: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-brand-100 text-ink',
  packed: 'bg-brand-100 text-ink',
  shipped: 'bg-sky-100 text-sky-800',
  out_for_delivery: 'bg-sky-100 text-sky-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-ink/10 text-ink-soft',
};

/** Human label for an order: an unpaid online order reads "Payment pending" / "Payment failed" / "Expired". */
export function orderStatusLabel({ status, paymentStatus, paymentMethod, expired }) {
  if (status === 'cancelled') return expired ? 'Expired (unpaid)' : 'Cancelled';
  if (status === 'placed' && paymentMethod === 'razorpay') return paymentStatus === 'failed' ? 'Payment failed' : 'Awaiting payment';
  return STATUS_LABELS[status] || status;
}

export default function OrderStatusBadge({ status, paymentStatus, paymentMethod, expired, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TONES[status] || TONES.confirmed} ${className}`}>
      {orderStatusLabel({ status, paymentStatus, paymentMethod, expired })}
    </span>
  );
}

export function paymentLabel(paymentMethod, paymentStatus) {
  if (paymentMethod === 'cod') return paymentStatus === 'paid' ? 'Cash on delivery · Paid' : 'Cash on delivery';
  return paymentStatus === 'paid' ? 'Paid online' : `Online · ${PAYMENT_LABELS[paymentStatus] || paymentStatus}`;
}
