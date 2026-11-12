import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/auth';
import { listUserOrders } from '@/lib/server/orders';
import { formatINR } from '@/lib/rules';
import { imageUrl } from '@/lib/imageUrl';
import OrderStatusBadge, { paymentLabel } from '@/components/account/OrderStatusBadge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My orders', robots: { index: false, follow: false } };

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default async function AccountOrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=%2Faccount%2Forders');
  const orders = await listUserOrders(user.id);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Your orders</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'Orders placed with this email show up here.'}
      </p>

      {orders.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <p className="font-display text-2xl text-ink">No orders yet</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">When you place an order it will appear here so you can track it.</p>
          <Link href="/shop" className="btn-primary mt-6">Start shopping</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => {
            const items = o.items || [];
            const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
            return (
              <li key={o.id}>
                <Link href={`/order-confirmation/${o.id}`} className="card group block p-5 transition hover:shadow-lg sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink group-hover:underline decoration-brand-400 decoration-2 underline-offset-4">Order #{o.order_number}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {dateFmt.format(new Date(o.created_at))} · {count} item{count === 1 ? '' : 's'} · {paymentLabel(o.payment_method, o.payment_status)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={o.fulfillment_status} paymentStatus={o.payment_status} paymentMethod={o.payment_method} />
                      <span className="font-bold text-ink">{formatINR(o.total)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {items.slice(0, 4).map((i, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={imageUrl(i.image, { width: 112, height: 112 })}
                          alt=""
                          width={56}
                          height={56}
                          loading="lazy"
                          className="h-14 w-14 rounded-xl border-2 border-white bg-brand-50 object-cover"
                        />
                      ))}
                    </div>
                    <p className="line-clamp-2 min-w-0 flex-1 text-sm text-ink-soft">
                      {items.map((i) => `${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity}`).join(', ')}
                    </p>
                    <span className="hidden text-sm font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 sm:inline">View →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
