import { FULFILLMENT_STEPS, STATUS_LABELS, stepIndex } from '@/lib/orderRules';
import { CheckIcon } from '@/components/ui/Icons';

const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const LABELS = { ...STATUS_LABELS, placed: 'Order placed' };

/** Vertical progress timeline for a publicOrder(): placed → confirmed → packed → shipped → out for delivery → delivered. */
export default function OrderTimeline({ order }) {
  const history = order.history || [];
  const firstAt = (status) => history.find((h) => h.status === status)?.at;

  if (order.status === 'cancelled') {
    const at = firstAt('cancelled');
    return (
      <div className="rounded-2xl bg-ink/5 p-5">
        <p className="font-semibold text-ink">{order.expired ? 'This order expired before payment was completed' : 'This order was cancelled'}</p>
        {at && <p className="mt-1 text-xs text-ink-muted">{fmt.format(new Date(at))}</p>}
        {order.cancelReason && <p className="mt-2 text-sm text-ink-soft">Reason: {order.cancelReason}</p>}
        {order.paymentStatus === 'refunded' && <p className="mt-2 text-sm text-green-700">Your refund has been processed.</p>}
      </div>
    );
  }

  const current = Math.max(0, stepIndex(order.status));
  const awaitingPayment = order.status === 'placed' && order.paymentMethod === 'razorpay';

  return (
    <ol className="relative">
      {FULFILLMENT_STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        const at = step === 'placed' ? firstAt('placed') || order.createdAt : firstAt(step);
        const notes = history.filter((h) => h.status === step && h.note).map((h) => h.note);
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {i < FULFILLMENT_STEPS.length - 1 && (
              <span className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${i < current ? 'bg-brand-500' : 'bg-ink/10'}`} aria-hidden />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-ink text-white' : 'border-2 border-ink/15 bg-white text-ink-muted'
              } ${active ? 'ring-4 ring-brand-100' : ''}`}
            >
              {done ? <CheckIcon width={16} height={16} /> : i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-ink-muted'}`}>
                {active && awaitingPayment ? 'Awaiting payment' : LABELS[step]}
              </p>
              {done && at && <p className="text-xs text-ink-muted">{fmt.format(new Date(at))}</p>}
              {done && notes.map((n, k) => <p key={k} className="mt-0.5 text-xs text-ink-soft">{n}</p>)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
