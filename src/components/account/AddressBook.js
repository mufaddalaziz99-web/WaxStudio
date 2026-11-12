'use client';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/contexts/ToastContext';
import { savedAddressSchema } from '@/lib/validation';
import { INDIAN_STATES } from '@/lib/rules';
import { PlusIcon, TrashIcon } from '@/components/ui/Icons';

const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', isDefault: false };

export default function AddressBook({ initialAddresses, defaults }) {
  const toast = useToast();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState(null); // null | 'new' | address id
  const [busyId, setBusyId] = useState(null);

  async function reload() {
    const { addresses: list } = await api('/api/account/addresses');
    setAddresses(list);
  }

  async function makeDefault(id) {
    setBusyId(id);
    try {
      await api(`/api/account/addresses/${id}`, { method: 'PATCH', body: { isDefault: true } });
      await reload();
      toast.success('Default address updated');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this address?')) return;
    setBusyId(id);
    try {
      await api(`/api/account/addresses/${id}`, { method: 'DELETE' });
      await reload();
      toast.success('Address deleted');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Saved addresses</h1>
          <p className="mt-1 text-sm text-ink-soft">Your default address is pre-filled at checkout.</p>
        </div>
        {editing !== 'new' && (
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            <PlusIcon /> Add address
          </button>
        )}
      </div>

      {editing === 'new' && (
        <div className="card mt-6 p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">New address</h2>
          <AddressForm
            initial={{ ...EMPTY, ...defaults, isDefault: addresses.length === 0 }}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await reload();
              toast.success('Address saved');
            }}
          />
        </div>
      )}

      {addresses.length === 0 && editing !== 'new' ? (
        <div className="card mt-6 px-6 py-14 text-center">
          <p className="font-display text-2xl text-ink">No saved addresses</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">Add one now, or tick “save this address” at checkout.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {addresses.map((a) =>
            editing === a.id ? (
              <li key={a.id} className="card p-5 sm:p-6 md:col-span-2">
                <h2 className="mb-4 text-lg font-semibold text-ink">Edit address</h2>
                <AddressForm
                  id={a.id}
                  initial={a}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await reload();
                    toast.success('Address updated');
                  }}
                />
              </li>
            ) : (
              <li key={a.id} className={`card flex flex-col p-5 ${a.isDefault ? 'ring-2 ring-brand-300' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink">{a.name}</p>
                  {a.isDefault && <span className="chip">Default</span>}
                </div>
                <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-ink-soft">
                  {a.line1}
                  {a.line2 && <>, {a.line2}</>}
                  {a.landmark && <><br />Near {a.landmark}</>}
                  <br />
                  {a.city}, {a.state} – {a.pincode}
                  <br />
                  +91 {a.phone}
                  {a.email && <> · {a.email}</>}
                </address>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink/5 pt-4">
                  <button type="button" className="btn-outline px-4 py-2" onClick={() => setEditing(a.id)} disabled={busyId === a.id}>
                    Edit
                  </button>
                  {!a.isDefault && (
                    <button type="button" className="btn-ghost py-2" onClick={() => makeDefault(a.id)} disabled={busyId === a.id}>
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost ml-auto py-2 text-red-600 hover:bg-red-50"
                    onClick={() => remove(a.id)}
                    disabled={busyId === a.id}
                    aria-label={`Delete address of ${a.name}`}
                  >
                    <TrashIcon /> Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function AddressForm({ id, initial, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const { id: _id, ...values } = form;
    const parsed = savedAddressSchema.safeParse(values);
    if (!parsed.success) {
      const fe = {};
      for (const i of parsed.error.issues) fe[i.path[0]] ||= i.message;
      setErrors(fe);
      return;
    }
    setBusy(true);
    try {
      if (id) await api(`/api/account/addresses/${id}`, { method: 'PATCH', body: parsed.data });
      else await api('/api/account/addresses', { method: 'POST', body: parsed.data });
      await onSaved();
    } catch (err) {
      if (err.data?.field) setErrors({ [err.data.field]: err.message.replace(/^[^:]+:\s*/, '') });
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const input = (k, label, props = {}) => (
    <div className={props.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`addr-${k}`} className="label">{label}</label>
      <input
        id={`addr-${k}`}
        className={`input ${errors[k] ? 'input-error' : ''}`}
        value={form[k] ?? ''}
        onChange={set(k)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        type={props.type || 'text'}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
      />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {input('name', 'Full name', { autoComplete: 'name' })}
      {input('phone', 'Mobile number', { autoComplete: 'tel-national', inputMode: 'numeric', type: 'tel', placeholder: '10-digit mobile' })}
      {input('line1', 'House / flat, street', { autoComplete: 'address-line1', wide: true })}
      {input('line2', 'Area, locality (optional)', { autoComplete: 'address-line2', wide: true })}
      {input('landmark', 'Landmark (optional)')}
      {input('pincode', 'Pincode', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 })}
      {input('city', 'City', { autoComplete: 'address-level2' })}
      <div>
        <label htmlFor="addr-state" className="label">State</label>
        <select id="addr-state" className={`input ${errors.state ? 'input-error' : ''}`} value={form.state} onChange={set('state')} autoComplete="address-level1">
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
      </div>
      {input('email', 'Email for updates (optional)', { autoComplete: 'email', inputMode: 'email', type: 'email', wide: true })}
      <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
        <input type="checkbox" checked={Boolean(form.isDefault)} onChange={set('isDefault')} className="h-4 w-4 accent-ink" />
        Use as my default address
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
