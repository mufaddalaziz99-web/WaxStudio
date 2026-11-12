'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';

/** Google Places search, proxied by our server so the API key never reaches the browser. */
export default function AddressSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const token = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

  useEffect(() => {
    if (q.trim().length < 3) {
      setItems([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api('/api/address/suggest', { method: 'POST', body: { input: q, sessionToken: token.current }, signal: ctrl.signal })
        .then((r) => {
          setItems(r.suggestions || []);
          setOpen(true);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const pick = async (s) => {
    setOpen(false);
    setQ(s.text);
    try {
      const { address } = await api('/api/address/details', { method: 'POST', body: { placeId: s.placeId, sessionToken: token.current } });
      if (address) onPick(address);
    } catch {}
    token.current = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  };

  return (
    <div className="relative">
      <label className="label" htmlFor="addr-search">Search your address</label>
      <input id="addr-search" className="input" placeholder="Start typing your building, street or area" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => items.length && setOpen(true)} autoComplete="off" />
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lg" role="listbox">
          {items.map((s) => (
            <li key={s.placeId}>
              <button type="button" className="block w-full px-4 py-3 text-left text-sm hover:bg-brand-50" onClick={() => pick(s)}>
                <span className="font-medium">{s.main}</span> <span className="text-ink-muted">{s.secondary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-ink-muted">or fill in the fields below</p>
    </div>
  );
}
