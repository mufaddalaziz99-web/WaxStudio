import { FULFILLMENT_STEPS, STATUS_LABELS, stepIndex } from '@/lib/orderRules';

const fmt = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Customer-facing progress: confirmed → packed → shipped → out for delivery → delivered. */
export default function OrderTimeline({ order }) {
  const steps = FULFILLMENT_STEPS.filter((s) => s !== 'placed');
  const current = stepIndex(order.status);
  const when = (s) => order.history.filter((h) => h.status === s).at(0)?.at;
  return (
    <ol className="mt-5 space-y-0">
      {steps.map((s, i) => {
        const done = stepIndex(s) <= current;
        const at = when(s);
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${stepIndex(steps[i + 1]) <= current ? 'bg-brand-500' : 'bg-ink/10'}`} />}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-ink text-white' : 'border-2 border-ink/15 bg-white text-transparent'}`}>✓</span>
            <span>
              <span className={`block text-sm font-semibold ${done ? 'text-ink' : 'text-ink-muted'}`}>{STATUS_LABELS[s]}</span>
              {done && at && <span className="block text-xs text-ink-muted">{fmt(at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
