import Link from 'next/link';
import { getSettings } from '@/lib/server/settings';
import { WhatsAppIcon } from '@/components/ui/Icons';
import ContactForm from './ContactForm';

export async function generateMetadata() {
  const { store } = await getSettings();
  return {
    title: 'Contact us',
    description: `Questions about an order or how to use ${store.name}? Get in touch — we usually reply within a day.`,
    alternates: { canonical: '/contact' },
  };
}

export default async function ContactPage() {
  const { store } = await getSettings();
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink underline decoration-brand-400 decoration-2 underline-offset-2">We&apos;re here to help</p>
          <h1 className="mt-1 font-display text-4xl text-ink">Contact us</h1>
          <p className="mt-3 max-w-xl text-ink-soft">
            Questions about your order, how to use the wax or anything else? Send us a message and we&apos;ll reply within
            one business day.
          </p>
          <div className="card mt-8 p-5 sm:p-8">
            <ContactForm />
          </div>
        </div>

        <aside className="space-y-4 lg:pt-24">
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp}`}
              target="_blank"
              rel="noopener"
              data-ref="contact"
              className="card flex items-center gap-4 p-5 transition hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700"><WhatsAppIcon /></span>
              <span>
                <span className="block font-semibold text-ink">Chat on WhatsApp</span>
                <span className="text-sm text-ink-muted">Fastest for quick questions</span>
              </span>
            </a>
          )}
          <div className="card space-y-3 p-5 text-sm">
            {store.supportEmail && (
              <p>
                <span className="label">Email</span>
                <a href={`mailto:${store.supportEmail}`} className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 hover:underline">{store.supportEmail}</a>
              </p>
            )}
            {store.supportPhone && (
              <p>
                <span className="label">Phone</span>
                <a href={`tel:${store.supportPhone.replace(/\s/g, '')}`} className="font-semibold text-ink">{store.supportPhone}</a>
              </p>
            )}
            {store.address && (
              <p>
                <span className="label">Address</span>
                <span className="whitespace-pre-line text-ink-soft">{store.address}</span>
              </p>
            )}
            <p className="text-ink-muted">Support hours: Mon–Sat, 10 am – 6 pm IST</p>
          </div>
          <div className="rounded-2xl bg-brand-50 p-5 text-sm text-ink-soft">
            Looking for your parcel? <Link href="/track-order" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 underline">Track your order</Link>{' '}
            with your order number and phone.
          </div>
        </aside>
      </div>
    </div>
  );
}
