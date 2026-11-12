import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/server/settings';
import { POLICY_SLUGS, POLICY_TITLES, getPolicy } from './content';

// Content pages are static (ISR via the store layout); only the four known slugs exist.
export const dynamicParams = false;

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!POLICY_SLUGS.includes(slug)) return {};
  const settings = await getSettings();
  const policy = getPolicy(slug, settings);
  return {
    title: policy.title,
    description: policy.description,
    alternates: { canonical: `/policies/${slug}` },
  };
}

export default async function PolicyPage({ params }) {
  const { slug } = await params;
  if (!POLICY_SLUGS.includes(slug)) notFound();
  const settings = await getSettings();
  const policy = getPolicy(slug, settings);
  if (!policy) notFound();

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Policies" className="order-last lg:order-first">
          <p className="label">Store policies</p>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {POLICY_SLUGS.map((s) => (
              <li key={s}>
                <Link
                  href={`/policies/${s}`}
                  aria-current={s === slug ? 'page' : undefined}
                  className={`inline-block rounded-full px-3 py-1.5 text-sm transition lg:rounded-lg ${
                    s === slug ? 'bg-brand-100 font-semibold text-ink' : 'text-ink-soft hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  {POLICY_TITLES[s]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="card max-w-3xl p-6 sm:p-10">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{policy.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{settings.store.name}</p>
          <div className="prose-store mt-8">{policy.body}</div>
        </article>
      </div>
    </div>
  );
}
