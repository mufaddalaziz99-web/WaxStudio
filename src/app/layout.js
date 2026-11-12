import { Instrument_Serif, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Providers from '@/components/providers/Providers';
import AnalyticsScripts from '@/components/providers/AnalyticsScripts';
import { getSettings } from '@/lib/server/settings';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function generateMetadata() {
  const { store } = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${store.name} — ${store.tagline}`, template: `%s · ${store.name}` },
    description: store.tagline,
    applicationName: store.name,
    openGraph: { type: 'website', siteName: store.name, locale: 'en_IN' },
    twitter: { card: 'summary_large_image' },
    other: process.env.NEXT_PUBLIC_PINTEREST_VERIFY ? { 'p:domain_verify': process.env.NEXT_PUBLIC_PINTEREST_VERIFY } : {},
  };
}

export const viewport = { themeColor: '#141414' };

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
        <AnalyticsScripts />
        {process.env.VERCEL && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
