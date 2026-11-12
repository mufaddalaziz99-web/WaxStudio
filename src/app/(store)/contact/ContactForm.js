'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { contactSchema } from '@/lib/validation';
import { CheckIcon } from '@/components/ui/Icons';

const EMPTY = { name: '', email: '', phone: '', message: '' };

export default function ContactForm() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Pre-fill for signed-in customers (only empty fields).
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '', phone: f.phone || user.phone || '' }));
  }, [user]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      for (const i of parsed.error.issues) fe[i.path[0]] ||= i.message;
      setErrors(fe);
      return;
    }
    setBusy(true);
    try {
      await api('/api/contact', { method: 'POST', body: parsed.data });
      setSent(true);
      setForm(EMPTY);
    } catch (err) {
      if (err.data?.field) setErrors({ [err.data.field]: err.message.replace(/^[^:]+:\s*/, '') });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckIcon /></span>
        <h2 className="mt-4 font-display text-2xl text-ink">Message sent</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">Thanks for writing in. We&apos;ll get back to you by email within one business day.</p>
        <button type="button" className="btn-outline mt-6" onClick={() => setSent(false)}>Send another message</button>
      </div>
    );
  }

  const err = (k) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor="contact-name" className="label">Name</label>
        <input id="contact-name" className={`input ${errors.name ? 'input-error' : ''}`} autoComplete="name" value={form.name} onChange={set('name')} />
        {err('name')}
      </div>
      <div>
        <label htmlFor="contact-email" className="label">Email</label>
        <input id="contact-email" type="email" inputMode="email" className={`input ${errors.email ? 'input-error' : ''}`} autoComplete="email" value={form.email} onChange={set('email')} />
        {err('email')}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="contact-phone" className="label">Mobile (optional)</label>
        <input id="contact-phone" type="tel" inputMode="numeric" className={`input ${errors.phone ? 'input-error' : ''}`} autoComplete="tel-national" placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} />
        {err('phone')}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="contact-message" className="label">Message</label>
        <textarea
          id="contact-message"
          rows={6}
          maxLength={2000}
          className={`input resize-y ${errors.message ? 'input-error' : ''}`}
          placeholder="Include your order number if your question is about an order."
          value={form.message}
          onChange={set('message')}
        />
        {err('message')}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
      </div>
    </form>
  );
}
