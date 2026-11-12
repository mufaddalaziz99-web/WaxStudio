import Link from 'next/link';
import { getSettings } from '@/lib/server/settings';

export const metadata = { title: 'Page not found', robots: { index: false } };

export default async function NotFound() {
  const { store } = await getSettings();
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="container-page py-6">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">{store.name}</Link>
      </header>
      <main className="container-page flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-7xl text-brand-300 sm:text-8xl" aria-hidden>404</p>
        <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl">We couldn&apos;t find that page</h1>
        <p className="mt-3 max-w-md text-ink-soft">
          The link may be old or the page may have moved. Let&apos;s get you back to smooth skin.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/shop" className="btn-outline">Shop all products</Link>
        </div>
        <p className="mt-8 text-sm text-ink-muted">
          Looking for an order? <Link href="/track-order" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 underline">Track it here</Link>
          {' · '}
          <Link href="/contact" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 underline">Contact us</Link>
        </p>
      </main>
    </div>
  );
}
