import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getOrderWithDetails, publicOrder } from '@/lib/server/orders';
import { getSettings } from '@/lib/server/settings';
import OrderView from '@/components/order/OrderView';
import AwaitingPayment from '@/components/order/AwaitingPayment';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your order', robots: { index: false, follow: false } };

// Addressed by the unguessable order UUID, so guests can revisit it.
export default async function OrderConfirmationPage({ params }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const raw = await getOrderWithDetails(orderId);
  if (!raw) notFound();
  const order = publicOrder(raw);
  const settings = await getSettings();

  const awaiting = order.paymentMethod === 'razorpay' && order.paymentStatus === 'pending' && order.status === 'placed';
  return (
    <div className="container-page max-w-4xl py-10" data-clarity-mask="true">
      {awaiting ? (
        <AwaitingPayment orderId={order.id} orderNumber={order.orderNumber} />
      ) : (
        <OrderView order={order} supportEmail={settings.store.supportEmail} whatsapp={settings.store.whatsapp} />
      )}
      <p className="mt-10 text-center text-sm text-ink-muted">
        Need help? <Link href="/contact" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Contact us</Link> and mention order <b>{order.orderNumber}</b>.
      </p>
    </div>
  );
}
