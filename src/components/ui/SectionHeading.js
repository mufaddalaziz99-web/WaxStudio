import Link from 'next/link';

/** Section heading: small numbered eyebrow, big condensed title, optional sticker and "view all" link. */
export default function SectionHeading({ eyebrow, title, sticker, href, linkLabel = 'View all', dark = false, center = false }) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${center ? 'flex-col items-center text-center' : 'justify-between'}`}>
      <div className={center ? 'flex flex-col items-center' : ''}>
        {eyebrow && (
          <p className={`mb-4 inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] ${dark ? 'text-white/50' : 'text-ink-muted'}`}>
            <span className={`h-px w-8 ${dark ? 'bg-white/40' : 'bg-ink/40'}`} />
            {eyebrow}
          </p>
        )}
        <h2 className={`display relative text-4xl sm:text-5xl lg:text-6xl ${dark ? 'text-white' : 'text-ink'}`}>
          {title}
          {sticker && <span className="sticker absolute -right-4 -top-6 hidden translate-x-full whitespace-nowrap text-base sm:inline-block">{sticker}</span>}
        </h2>
      </div>
      {href && (
        <Link href={href} className={`border-b pb-1 text-[11px] font-medium uppercase tracking-[0.18em] transition ${dark ? 'border-white/40 text-white hover:border-white' : 'border-ink/30 text-ink hover:border-ink'}`}>
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
