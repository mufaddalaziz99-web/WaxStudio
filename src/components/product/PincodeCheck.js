'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { PINCODE_RE, formatINR } from '@/lib/rules';
import { TruckIcon, CashIcon } from '@/components/ui/Icons';

const PIN_KEY = 'store_pincode';

function deliveryDate(days) {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days + 1); // +1 dispatch day
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Delivery check with a "Get it by <date>" promise; remembers the last pincode. */
export default function PincodeCheck({ productId, variantId }) {
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState({ loading: false, result: null, error: null, checked: '' });

  const run = async (pin) => {
    if (!PINCODE_RE.test(pin)) {
      setState((s) => ({ ...s, error: 'Enter a valid 6-digit pincode', result: null }));
      return;
    }
    setState({ loading: true, result: null, error: null, checked: pin });
    try {
      const result = await api('/api/pincode-check', { method: 'POST', body: { pincode: pin, productId, variantId } });
      setState({ loading: false, result, error: null, checked: pin });
      try { localStorage.setItem(PIN_KEY, pin); } catch {}
    } catch (err) {
      setState({ loading: false, result: null, error: err.message, checked: pin });
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PIN_KEY);
      if (saved && PINCODE_RE.test(saved)) {
        setPincode(saved);
        run(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const r = state.result;
  const by = r?.serviceable ? deliveryDate(r.etaMaxDays) : null;
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(pincode);
        }}
        className="flex items-center gap-2"
      >
        <TruckIcon width={20} height={20} className="shrink-0" />
        <label htmlFor="pdp-pincode" className="sr-only">Delivery pincode</label>
        <input
          id="pdp-pincode"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter pincode for delivery date"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink-muted"
        />
        <button className="text-[10.5px] font-medium uppercase tracking-[0.16em] underline decoration-ink/30 underline-offset-4" disabled={state.loading}>
          {state.loading ? 'Checking…' : r ? 'Change' : 'Check'}
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {r && (
        r.serviceable ? (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <p className="font-medium">
              {by ? <>Get it by <span className="font-medium underline decoration-ink/30 underline-offset-4">{by}</span></> : `Delivers to ${state.checked}${r.etaText ? ` in ${r.etaText}` : ''}`}
            </p>
            <p className="text-xs text-ink-muted">
              Dispatched within 24 hours · {r.freeShippingThreshold ? `Free delivery above ${formatINR(r.freeShippingThreshold)}` : r.cheapest != null ? `Shipping from ${formatINR(r.cheapest)}` : ''}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-ink-soft"><CashIcon width={14} height={14} />{r.cod ? 'Cash on Delivery available' : 'Prepaid only for this pincode'}</p>
          </div>
        ) : (
          <p className="mt-3 border-t border-line pt-3 text-sm text-red-700">Sorry, we don&apos;t deliver to {state.checked} yet.</p>
        )
      )}
    </div>
  );
}
