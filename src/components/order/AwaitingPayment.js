'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/client/api';

/** Payment authorised but not yet confirmed: refresh every 3 s, up to 20 times, until the webhook lands. */
export default function AwaitingPayment({ orderId, orderNumber }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const done = tries >= 20;

  useEffect(() => {
    if (done) return undefined;
    const t = setTimeout(async () => {
      try {
        const { order } = await api(`/api/orders/${orderId}`);
        if (order.paymentStatus !== 'pending' || order.status !== 'placed') {
          router.refresh();
          return;
        }
      } catch {}
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [tries, done, orderId, router]);

  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      {!done ? (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden />
          <h1 className="mt-6 font-display text-3xl">Confirming your payment…</h1>
          <p className="mt-3 text-ink-soft">Order <b>{orderNumber}</b>. This usually takes a few seconds — please don&apos;t close this page.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl">We&apos;re still waiting for the bank</h1>
          <p className="mt-3 text-ink-soft">
            Order <b>{orderNumber}</b> is reserved for 15 minutes. If money was debited, your order will be confirmed automatically and you&apos;ll get an email.
            If not, you can try again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-outline" onClick={() => { setTries(0); router.refresh(); }}>Check again</button>
            <Link href="/checkout" className="btn-primary">Try again</Link>
          </div>
        </>
      )}
    </div>
  );
}
