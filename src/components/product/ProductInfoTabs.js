'use client';
import { useState } from 'react';

/** Description · Key ingredients · How to use · Product details (legal metrology table). */
export default function ProductInfoTabs({ product }) {
  const tabs = [
    { id: 'desc', label: 'Description', show: Boolean(product.description) },
    { id: 'ingredients', label: 'Key ingredients', show: product.ingredients.length > 0 },
    { id: 'how', label: 'How to use', show: product.howToUse.length > 0 },
    { id: 'details', label: 'Product details', show: product.specs.length > 0 },
  ].filter((t) => t.show);
  const [active, setActive] = useState(tabs[0]?.id);
  if (!tabs.length) return null;
  const paragraphs = (product.description || '').split(/\n{2,}/).filter(Boolean);

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`relative shrink-0 px-1 pb-4 pt-2 text-[11px] font-medium uppercase tracking-[0.18em] transition sm:px-3 ${active === t.id ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            {t.label}
            {active === t.id && <span className="absolute inset-x-0 -bottom-px h-px bg-ink" />}
          </button>
        ))}
      </div>
      <div className="pt-8" role="tabpanel">
        {active === 'desc' && (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="prose-store max-w-2xl text-[15px]">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
            {product.highlights.length > 0 && (
              <ul className="space-y-3 self-start rounded-2xl bg-white p-6 ring-1 ring-line">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 text-sm text-ink-soft">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />{h}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {active === 'ingredients' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {product.ingredients.map((ing, i) => (
              <div key={ing.name} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                <span className="display text-4xl text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-2 font-display text-2xl">{ing.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{ing.benefit}</p>
              </div>
            ))}
          </div>
        )}
        {active === 'how' && (
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {product.howToUse.map((s, i) => (
              <li key={i} className="rounded-2xl bg-white p-6 ring-1 ring-line">
                <span className="display text-5xl text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s}</p>
              </li>
            ))}
          </ol>
        )}
        {active === 'details' && (
          <dl className="max-w-3xl divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
            {product.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[40%_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
                <dt className="text-ink-muted">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
            {product.hsnCode && (
              <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-4 px-5 py-3.5 text-sm">
                <dt className="text-ink-muted">HSN code</dt>
                <dd>{product.hsnCode}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
