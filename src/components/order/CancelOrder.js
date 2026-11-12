'use client';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/contexts/ToastContext';
import { CANCEL_REASONS } from '@/lib/orderRules';

export default function CancelOrder({ orderId, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { reason: reason === 'Other' ? other || 'Other' : reason } });
      toast.success('Your order has been cancelled');
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button className="btn-ghost w-full text-red-600" onClick={() => setOpen(true)}>Cancel order</button>;
  return (
    <form onSubmit={submit} className="card space-y-3 p-5 text-sm">
      <p className="font-semibold">Why are you cancelling?</p>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      {reason === 'Other' && <textarea className="input" placeholder="Tell us more" value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} />}
      <p className="text-xs text-ink-muted">Prepaid orders are refunded in full to the original payment method.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-outline flex-1" onClick={() => setOpen(false)}>Keep order</button>
        <button className="btn flex-1 bg-red-600 text-white hover:bg-red-700" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel order'}</button>
      </div>
    </form>
  );
}
