'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProductImage from '@/components/ui/ProductImage';
import OrderTimeline from './OrderTimeline';
import TrackPurchase from './TrackPurchase';
import CancelOrder from './CancelOrder';
import ReportProblem from './ReportProblem';
import { Totals } from '@/components/checkout/OrderSummary';
import { CUSTOMER_CANCELLABLE, ISSUE_REPORT_DAYS, PAYMENT_LABELS } from '@/lib/orderRules';

export default function OrderView({ order, supportEmail, whatsapp }) {
  const router = useRouter();
  const [celebrate, setCelebrate] = useState(false);
  const cancelled = order.status === 'cancelled';
  const fresh = Date.now() - new Date(order.createdAt).getTime() < 30 * 60_000;

  useEffect(() => {
    if (cancelled || !fresh) return;
    let key = `celebrated_${order.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    setCelebrate(true);
    import('canvas-confetti').then(({ default: confetti }) => {
      const colors = ['#d6852a', '#e9bd71', '#1f1a17', '#fffaf3'];
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 }, colors, disableForReducedMotion: true });
      setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors, disableForReducedMotion: true }), 400);
    });
  }, [order.id, cancelled, fresh]);

  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt).getTime() : null;
  const canReport = order.status === 'delivered' && deliveredAt && Date.now() - deliveredAt < ISSUE_REPORT_DAYS * 86400_000
    && !order.issues.some((i) => i.status === 'open');
  const firstName = order.name.split(' ')[0];

  return (
    <div>
      <TrackPurchase order={order} />
      <div className="text-center">
        {cancelled ? (
          <>
            <h1 className="font-display text-4xl">{order.expired ? 'Payment not completed' : 'Order cancelled'}</h1>
            <p className="mt-3 text-ink-soft">
              {order.expired
                ? `We didn't receive payment for order ${order.orderNumber} within 15 minutes, so the items were released. No money was taken.`
                : `Order ${order.orderNumber} has been cancelled${order.cancelReason ? ` — ${order.cancelReason}` : ''}.`}
            </p>
            {order.expired && <Link href="/shop" className="btn-primary mt-6">Shop again</Link>}
          </>
        ) : (
          <>
            <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700 ${celebrate ? 'animate-bounce' : ''}`}>✓</span>
            <h1 className="mt-5 font-display text-4xl">Thank you, {firstName}!</h1>
            <p className="mt-3 text-ink-soft">
              Your order <b className="text-ink">{order.orderNumber}</b> is {order.status === 'delivered' ? 'delivered' : 'confirmed'}.
              {' '}A confirmation has been sent to <b className="text-ink">{order.email}</b>.
            </p>
            {order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && (
              <p className="mt-2 text-sm text-ink-muted">Please keep the exact amount ready to pay on delivery.</p>
            )}
          </>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {!cancelled && (
            <section className="card p-6">
              <h2 className="font-display text-xl">Order status</h2>
              <OrderTimeline order={order} />
              {order.awbCode && (
                <p className="mt-4 text-sm text-ink-soft">
                  {order.courierName} · AWB <b>{order.awbCode}</b>
                  {order.trackingUrl && <> · <a href={order.trackingUrl} target="_blank" rel="noopener" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Track parcel</a></>}
                </p>
              )}
            </section>
          )}
          <section className="card p-6">
            <h2 className="font-display text-xl">Items</h2>
            <ul className="mt-3 divide-y divide-ink/5">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                    <ProductImage src={i.image} alt={i.name} fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="font-semibold">{i.name}</span>
                    {i.variantName && <span className="block text-xs text-ink-muted">{i.variantName}</span>}
                    <span className="block text-xs text-ink-muted">Qty {i.quantity}</span>
                  </span>
                  <span className="text-sm font-semibold">₹{i.lineTotal}</span>
                </li>
              ))}
            </ul>
            <Totals totals={{ itemsTotal: order.itemsTotal, discount: order.discount, couponCode: order.couponCode, shipping: order.shippingFee, codFee: order.codFee, giftWrapFee: order.giftWrapFee, total: order.total }} />
          </section>
          {order.status === 'delivered' && order.reviewToken && (
            <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-sm text-ink-soft">Enjoying your purchase? A quick review helps other shoppers.</p>
              <Link href={`/review/${order.reviewToken}`} className="btn-dark">Write a review</Link>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-6 text-sm">
            <h2 className="font-display text-xl">Delivery</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              {order.address.name}<br />{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}<br />
              {order.address.city}, {order.address.state} {order.address.pincode}<br />{order.address.phone}
            </p>
            {order.shippingOption && <p className="mt-3 text-xs text-ink-muted">{order.shippingOption.label}{order.shippingOption.etaText ? ` · ${order.shippingOption.etaText}` : ''}</p>}
            {order.isGift && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-xs">🎁 Gift{order.giftWrap ? ' · wrapped' : ''}{order.giftMessage ? ` — “${order.giftMessage}”` : ''}</p>}
          </section>
          <section className="card p-6 text-sm">
            <h2 className="font-display text-xl">Payment</h2>
            <p className="mt-3 text-ink-soft">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'} · {PAYMENT_LABELS[order.paymentStatus]}</p>
            {order.refunds.length > 0 && <p className="mt-2 text-xs text-ink-muted">Refunded ₹{order.refunds.reduce((s, r) => s + r.amount, 0)}</p>}
            {!cancelled && order.status !== 'placed' && (
              <a href={`/api/orders/${order.id}/invoice`} className="btn-outline mt-4 w-full py-2.5">Download invoice</a>
            )}
          </section>
          {CUSTOMER_CANCELLABLE.includes(order.status) && <CancelOrder orderId={order.id} onDone={() => router.refresh()} />}
          {canReport && <ReportProblem orderId={order.id} onDone={() => router.refresh()} />}
          {order.issues.length > 0 && (
            <p className="text-center text-xs text-ink-muted">We&apos;re looking into the problem you reported. We&apos;ll get back to you at {order.email}.</p>
          )}
          {(supportEmail || whatsapp) && (
            <p className="text-center text-xs text-ink-muted">
              Questions? {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! About order ${order.orderNumber} [ref: order]`)}`} data-ref="order" className="font-semibold text-green-700" target="_blank" rel="noopener">WhatsApp us</a>}
              {whatsapp && supportEmail && ' or '}{supportEmail && <a href={`mailto:${supportEmail}?subject=Order ${order.orderNumber}`} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2">email us</a>}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
