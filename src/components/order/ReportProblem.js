'use client';
import { useState } from 'react';
import { api, uploadImage } from '@/lib/client/api';
import { useToast } from '@/contexts/ToastContext';
import { ISSUE_TYPES } from '@/lib/orderRules';

export default function ReportProblem({ orderId, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('damaged');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 5 - images.length);
    setBusy(true);
    for (const f of files) {
      try {
        const url = await uploadImage(f, 'issues');
        setImages((x) => [...x, url]);
      } catch (err) {
        toast.error(err.message);
      }
    }
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}/issues`, { method: 'POST', body: { type, description, images } });
      toast.success("Thanks — we'll look into it and get back to you");
      onDone?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button className="btn-outline w-full" onClick={() => setOpen(true)}>Report a problem</button>;
  return (
    <form onSubmit={submit} className="card space-y-3 p-5 text-sm">
      <p className="font-semibold">What went wrong?</p>
      <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
        {Object.entries(ISSUE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <textarea className="input min-h-[90px]" required minLength={5} maxLength={1000} placeholder="Describe the problem" value={description} onChange={(e) => setDescription(e.target.value)} />
      <label className="block text-xs font-semibold text-ink-soft">
        Photos (helps us resolve it faster)
        <input type="file" accept="image/*" multiple onChange={onFiles} className="mt-1 block w-full text-xs" disabled={images.length >= 5} />
      </label>
      {images.length > 0 && <p className="text-xs text-ink-muted">{images.length} photo(s) attached</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-outline flex-1" onClick={() => setOpen(false)}>Close</button>
        <button className="btn-dark flex-1" disabled={busy}>{busy ? 'Please wait…' : 'Submit'}</button>
      </div>
    </form>
  );
}
