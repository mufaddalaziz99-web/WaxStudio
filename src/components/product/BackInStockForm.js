'use client';
import { useState } from 'react';
import { api } from '@/lib/client/api';

export default function BackInStockForm({ productId, variantId }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await api('/api/stock-alerts', { method: 'POST', body: { productId, variantId, email } });
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm text-green-800">We&apos;ll email you as soon as it&apos;s back in stock.</div>;
  }
  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl bg-brand-50 p-4">
      <p className="text-sm font-semibold">Sold out — get notified when it&apos;s back</p>
      <div className="mt-3 flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input py-2.5" aria-label="Email" />
        <button className="btn-dark shrink-0 py-2.5" disabled={status === 'loading'}>Notify me</button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
