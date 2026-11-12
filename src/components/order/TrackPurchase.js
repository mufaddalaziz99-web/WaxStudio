'use client';
import { useEffect } from 'react';
import { track } from '@/lib/client/analytics';

/** Fires the GA4 purchase event exactly once, only for orders placed in this browser. */
export default function TrackPurchase({ order }) {
  useEffect(() => {
    if (order.status === 'cancelled' || order.status === 'placed') return;
    const key = `purchase_${order.id}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      if (localStorage.getItem(`${key}_tracked`)) return;
      localStorage.setItem(`${key}_tracked`, '1');
      sessionStorage.removeItem(key);
    } catch {
      return;
    }
    track('purchase', {
      transaction_id: order.orderNumber,
      currency: 'INR',
      value: order.total,
      shipping: order.shippingFee,
      coupon: order.couponCode || undefined,
      payment_type: order.paymentMethod,
      items: order.items.map((i, idx) => ({
        item_id: i.variantId ? `${i.productId}:${i.variantId}` : i.productId,
        item_name: i.name,
        item_variant: i.variantName || undefined,
        price: i.price,
        quantity: i.quantity,
        index: idx,
      })),
    });
  }, [order]);
  return null;
}
