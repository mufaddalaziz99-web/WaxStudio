'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { insight } from '@/lib/client/analytics';
import { CloseIcon } from '@/components/ui/Icons';

const SORTS = [
  ['featured', 'Featured'],
  ['rating', 'Top rated'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
];
const PRICES = [['', 'Any price'], ['300', 'Under ₹300'], ['500', 'Under ₹500'], ['1000', 'Under ₹1,000']];

function useFilterNav(params) {
  const router = useRouter();
  const pathname = usePathname();
  return (patch, path = pathname) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) next.set(k, v);
    router.push(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
}

function Group({ title, children }) {
  return (
    <div className="border-b border-line py-5 first:pt-0">
      <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-muted">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Option({ active, onClick, href, children, count }) {
  const cls = `flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${active ? 'bg-ink text-cream' : 'text-ink-soft hover:bg-ink/5'}`;
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <span className={`h-3.5 w-3.5 rounded-full border ${active ? 'border-cream bg-cream' : 'border-ink/30'}`} />
        {children}
      </span>
      {count != null && <span className={`text-xs ${active ? 'text-white/70' : 'text-ink-muted'}`}>{count}</span>}
    </>
  );
  return href ? <Link href={href} scroll={false} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** Sidebar filters (also rendered inside the mobile drawer). */
export default function ShopFilters({ params = {}, categories = [], activeCategory }) {
  const go = useFilterNav(params);
  const qs = (() => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return s ? `?${s}` : '';
  })();
  return (
    <div>
      {categories.length > 0 && (
        <Group title="Category">
          <Option href={`/shop${qs}`} active={!activeCategory} count={categories.reduce((s, c) => s + (c.count || 0), 0) || undefined}>All products</Option>
          {categories.map((c) => (
            <Option key={c.slug} href={`/shop/${c.slug}${qs}`} active={activeCategory === c.slug} count={c.count}>{c.name}</Option>
          ))}
        </Group>
      )}
      <Group title="Price">
        {PRICES.map(([v, l]) => <Option key={l} active={(params.max || '') === v} onClick={() => go({ max: v })}>{l}</Option>)}
      </Group>
      <Group title="Availability">
        <Option active={params.stock === '1'} onClick={() => go({ stock: params.stock === '1' ? '' : '1' })}>In stock only</Option>
      </Group>
    </div>
  );
}

/** Result count, search chip, sort select and the mobile "Filter & sort" drawer. */
export function ShopToolbar({ params = {}, count, categories, activeCategory }) {
  const go = useFilterNav(params);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname, params.max, params.stock, params.sort]);
  useEffect(() => {
    if (params.q) insight('search', { query: params.q, results: count });
  }, [params.q, count]);

  const activeCount = [params.max, params.stock].filter(Boolean).length;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold">{count} product{count === 1 ? '' : 's'}</span>
          {params.q && (
            <button onClick={() => go({ q: '' })} className="chip-soft gap-1.5">“{params.q}” <span aria-hidden>✕</span><span className="sr-only">Clear search</span></button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)} className="btn-outline px-4 py-2.5 text-xs lg:hidden">
            Filter{activeCount ? ` (${activeCount})` : ''}
          </button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" className="input w-auto py-2.5 font-semibold" value={params.sort || 'featured'} onChange={(e) => go({ sort: e.target.value === 'featured' ? '' : e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}
          </select>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-cream p-6"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
              role="dialog" aria-label="Filters"
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="display text-3xl">Filter</p>
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-ink/5" aria-label="Close filters"><CloseIcon /></button>
              </div>
              <ShopFilters params={params} categories={categories} activeCategory={activeCategory} />
              <button onClick={() => setOpen(false)} className="btn-primary mt-6 w-full">Show {count} results</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
