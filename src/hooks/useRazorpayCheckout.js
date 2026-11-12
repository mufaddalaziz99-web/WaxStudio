'use client';
import { useCallback, useRef } from 'react';
import { track } from '@/lib/client/analytics';

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading = null;

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Lazy-loads Razorpay Checkout.js and opens the modal for an order created by /api/orders.
 * A failed attempt stays inside the modal so the customer can retry.
 */
export function useRazorpayCheckout() {
  const open = useRef(false);

  const preload = useCallback(() => {
    loadScript().catch(() => {});
  }, []);

  const pay = useCallback(async (rzp, { orderNumber, onSuccess, onDismiss }) => {
    await loadScript();
    if (open.current) return;
    open.current = true;
    const instance = new window.Razorpay({
      key: rzp.keyId,
      order_id: rzp.orderId,
      amount: rzp.amount,
      currency: rzp.currency,
      name: rzp.name,
      description: `Order ${orderNumber}`,
      prefill: rzp.prefill,
      notes: { order_number: orderNumber },
      theme: { color: rzp.color || '#d6852a' },
      retry: { enabled: true },
      handler: (resp) => {
        open.current = false;
        onSuccess(resp);
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          open.current = false;
          onDismiss?.();
        },
      },
    });
    instance.on('payment.failed', (resp) => {
      track('payment_failed', { order_number: orderNumber, reason: resp?.error?.reason || 'unknown' });
    });
    instance.open();
  }, []);

  return { pay, preload };
}
