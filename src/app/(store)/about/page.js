import Link from 'next/link';
import { getSettings } from '@/lib/server/settings';
import { LeafIcon, ShieldIcon, TruckIcon } from '@/components/ui/Icons';

export async function generateMetadata() {
  const { store } = await getSettings();
  return {
    title: 'About us',
    description: `The story behind ${store.name} — ${store.tagline}.`,
    alternates: { canonical: '/about' },
  };
}

const VALUES = [
  {
    Icon: LeafIcon,
    title: 'Gentle by design',
    text: 'A natural wax powder you mix with water — no heating, so removing hair at home feels kinder on your skin.',
  },
  {
    Icon: ShieldIcon,
    title: 'Honest ingredients',
    text: 'No mystery fillers. Every batch is checked before it is packed.',
  },
  {
    Icon: TruckIcon,
    title: 'Made for India',
    text: 'Fast, tracked shipping across the country, cash on delivery, and real people on support when you need help.',
  },
];

export default async function AboutPage() {
  const { store } = await getSettings();
  return (
    <div>
      <section className="bg-brand-50">
        <div className="container-page py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Our story</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Salon-smooth skin, without the salon.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            {store.name} started with a simple frustration: salon waxing is expensive and time-consuming, and most at-home
            options are messy, painful or both. So we set out to make one product really, really well.
          </p>
        </div>
      </section>

      <section className="container-page grid gap-10 py-14 lg:grid-cols-2 lg:gap-16">
        <div className="prose-store">
          <h2>Why hard wax powder?</h2>
          <p>
            Hard wax sets on its own and is removed without strips. Because it shrink-wraps around each hair instead of
            sticking to skin, it is far gentler than strip wax — which is why professionals use it for sensitive areas.
          </p>
          <p>
            We turned it into a fine powder so it melts quickly and evenly in small amounts. You heat only what you need,
            nothing goes to waste, and there is no half-used tin hardening in your cupboard.
          </p>
          <h2>How we work</h2>
          <p>
            We are a small team that tests every batch ourselves and reads every message. If something is not right with
            your order, write to us and we will fix it.
          </p>
        </div>
        <ul className="grid gap-4">
          {VALUES.map(({ Icon, title, text }) => (
            <li key={title} className="card flex gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-ink">
                <Icon />
              </span>
              <div>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pb-16">
        <div className="flex flex-col items-start gap-5 rounded-3xl bg-ink px-6 py-10 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <h2 className="font-display text-3xl">Ready to try it?</h2>
            <p className="mt-2 text-white/70">{store.tagline}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className="btn-primary">Shop now</Link>
            <Link href="/contact" className="btn bg-white/10 text-white hover:bg-white/20">Ask us anything</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
