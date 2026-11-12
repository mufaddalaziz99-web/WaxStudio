'use client';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { profileSchema } from '@/lib/validation';

export default function ProfileForm({ initialUser }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: initialUser.name || '', phone: initialUser.phone || '' });
  const [saved, setSaved] = useState({ name: initialUser.name || '', phone: initialUser.phone || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const dirty = form.name !== saved.name || form.phone !== saved.phone;

  async function onSubmit(e) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      for (const i of parsed.error.issues) fe[i.path[0]] ||= i.message;
      setErrors(fe);
      return;
    }
    setBusy(true);
    try {
      const { user } = await api('/api/account/profile', { method: 'PATCH', body: parsed.data });
      setUser(user);
      const next = { name: user.name || '', phone: user.phone || '' };
      setForm(next);
      setSaved(next);
      toast.success('Profile saved');
    } catch (err) {
      if (err.data?.field) setErrors({ [err.data.field]: err.message.replace(/^[^:]+:\s*/, '') });
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const change = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor="profile-name" className="label">Name</label>
        <input id="profile-name" className={`input ${errors.name ? 'input-error' : ''}`} autoComplete="name" value={form.name} onChange={change('name')} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="profile-phone" className="label">Mobile number</label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ink/15 bg-brand-50 px-3 text-sm text-ink-soft">+91</span>
          <input
            id="profile-phone"
            className={`input rounded-l-none ${errors.phone ? 'input-error' : ''}`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={change('phone')}
          />
        </div>
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
