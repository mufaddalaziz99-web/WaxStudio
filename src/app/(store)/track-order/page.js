import TrackOrderForm from './TrackOrderForm';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Track your order',
  description: 'Check the status of your order with your order number and phone number.',
  alternates: { canonical: '/track-order' },
};

export default function TrackOrderPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Order status</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">Track your order</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Enter the order number from your confirmation email (e.g. WAX-1001) and the mobile number used at checkout.
        </p>
        <TrackOrderForm />
      </div>
    </div>
  );
}
