/** Scrolling announcement strip. Items are separated by "·"; text is duplicated for a seamless loop. */
export default function Marquee({ text, className = 'bg-ink text-cream/85' }) {
  const items = String(text || '').split('·').map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  const row = (hidden) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[...items, ...items].map((t, i) => (
        <span key={i} className="flex items-center whitespace-nowrap px-6 text-[10.5px] font-medium uppercase tracking-[0.22em]">
          {t}
          <span className="ml-12 h-1 w-1 rounded-full bg-current opacity-50" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`relative overflow-hidden py-2 ${className}`} role="region" aria-label="Offers">
      <p className="sr-only">{items.join('. ')}</p>
      <div className="flex w-max animate-marquee" aria-hidden>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
