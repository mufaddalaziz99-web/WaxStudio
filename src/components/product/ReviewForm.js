'use client';
import { useState } from 'react';
import { api, uploadImage } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { StarIcon } from '@/components/ui/Icons';

/** Review form. With `token` (from a review-request email) the review is marked as a verified purchase. */
export default function ReviewForm({ productId, token, defaultOpen = false, defaultName = '', onDone }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [form, setForm] = useState({ name: defaultName, email: '', title: '', body: '' });
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  if (!open) {
    return <button className="btn-outline mt-6 w-full" onClick={() => setOpen(true)}>Write a review</button>;
  }
  if (status === 'done') {
    return <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm text-green-800">Thank you! Your review will appear once it&apos;s approved.</div>;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Please choose a star rating');
    setStatus('loading');
    setError('');
    try {
      await api('/api/reviews', {
        method: 'POST',
        body: { productId, rating, name: form.name || user?.name || '', email: form.email || user?.email || '', title: form.title, body: form.body, images, token: token || undefined },
      });
      setStatus('done');
      onDone?.();
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 4 - images.length);
    for (const f of files) {
      try {
        const url = await uploadImage(f, 'reviews');
        setImages((x) => [...x, url]);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={rating === s}
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(s)}
          >
            <StarIcon size={28} fill={(hover || rating) >= s ? 1 : 0} />
          </button>
        ))}
      </div>
      {!user && (
        <>
          <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} required maxLength={60} />
          <input className="input" type="email" placeholder="Email (not shown)" value={form.email} onChange={set('email')} />
        </>
      )}
      <input className="input" placeholder="Title (optional)" value={form.title} onChange={set('title')} maxLength={100} />
      <textarea className="input min-h-[110px]" placeholder="What did you like or dislike?" value={form.body} onChange={set('body')} required minLength={10} maxLength={2000} />
      <div>
        <label className="text-xs font-semibold text-ink-soft">
          Add photos (optional)
          <input type="file" accept="image/*" multiple onChange={onFiles} className="mt-1 block w-full text-xs" disabled={images.length >= 4} />
        </label>
        {images.length > 0 && <p className="mt-1 text-xs text-ink-muted">{images.length} photo(s) attached</p>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={status === 'loading'}>{status === 'loading' ? 'Submitting…' : 'Submit review'}</button>
    </form>
  );
}
