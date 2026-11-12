'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { trackOrderSchema } from '@/lib/validation';
import { formatINR } from '@/lib/rules';
import { imageUrl } from '@/lib/imageUrl';
import OrderTimeline from '@/components/account/OrderTimeline';
import OrderStatusBadge, { paymentLabel } from '@/components/account/OrderStatusBadge';
import { TruckIcon } from '@/components/ui/Icons';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default function TrackOrderForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({ orderNumber: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const resultRef = useRef(null);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = trackOrderSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      for (const i of parsed.error.issues) fe[i.path[0]] ||= i.path[0] === 'orderNumber' ? 'Enter your order number' : i.message;
      setErrors(fe);
      return;
    }
    setBusy(true);
    try {
      const { order: o } = await api('/api/orders/track', { method: 'POST', body: form });
      setOrder(o);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setOrder(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="card mt-6 grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-6" noValidate>
        <div>
          <label htmlFor="track-order" className="label">Order number</label>
          <input
            id="track-order"
            className={`input uppercase ${errors.orderNumber ? 'input-error' : ''}`}
            placeholder="WAX-1001"
            autoCapitalize="characters"
            value={form.orderNumber}
            onChange={set('orderNumber')}
          />
          {errors.orderNumber && <p className="mt-1 text-xs text-red-600">{errors.orderNumber}</p>}
        </div>
        <div>
          <label htmlFor="track-phone" className="label">Mobile number</label>
          <input
            id="track-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className={`input ${errors.phone ? 'input-error' : ''}`}
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={set('phone')}
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Track order'}</button>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-3">{error}</p>}
      </form>

      {user && (
        <p className="mt-4 text-sm text-ink-soft">
          Signed in? See all your orders in{' '}
          <Link href="/account/orders" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">My orders</Link>.
        </p>
      )}

      {order && (
        <section ref={resultRef} className="mt-8 scroll-mt-24 space-y-4" aria-live="polite">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ink">Order #{order.orderNumber}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Placed {dateFmt.format(new Date(order.createdAt))} · {paymentLabel(order.paymentMethod, order.paymentStatus)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} paymentStatus={order.paymentStatus} paymentMethod={order.paymentMethod} expired={order.expired} />
            </div>

            {(order.awbCode || order.courierName) && order.status !== 'cancelled' && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink underline decoration-brand-400 decoration-2 underline-offset-2"><TruckIcon /></span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">{order.courierName || 'Courier'}</p>
                  {order.awbCode && <p className="text-ink-soft">AWB / tracking no. <span className="font-mono font-semibold text-ink">{order.awbCode}</span></p>}
                </div>
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-4 py-2">
                    Live tracking ↗
                  </a>
                )}
              </div>
            )}
            {!order.awbCode && order.shippingOption?.etaText && order.status !== 'cancelled' && order.status !== 'delivered' && (
              <p className="mt-4 text-sm text-ink-soft">Estimated delivery: <span className="font-semibold text-ink">{order.shippingOption.etaText}</span></p>
            )}

            <div className="mt-6">
              <OrderTimeline order={order} />
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <h3 className="font-semibold text-ink">Items</h3>
            <ul className="mt-3 divide-y divide-ink/5">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl(i.image, { width: 112, height: 112 })} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 rounded-xl bg-brand-50 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{i.name}</p>
                    <p className="text-xs text-ink-muted">{i.variantName ? `${i.variantName} · ` : ''}Qty {i.quantity}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatINR(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-ink/5 pt-3 text-sm">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-bold text-ink">{formatINR(order.total)}</span>
            </div>
            <Link href={`/order-confirmation/${order.id}`} className="btn-outline mt-5 w-full sm:w-auto">
              View full order details
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
