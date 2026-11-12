import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import ProductView from '@/components/product/ProductView';
import ProductInfoTabs from '@/components/product/ProductInfoTabs';
import ProductStory from '@/components/product/ProductStory';
import SectionHeading from '@/components/ui/SectionHeading';
import ProductReviews from '@/components/product/ProductReviews';
import ProductCard from '@/components/product/ProductCard';
import JsonLd from '@/components/seo/JsonLd';
import {
  getAllProductSlugs, getApprovedReviews, getProductBySlug, getRatingBreakdown, getRelatedProducts, getSiteOffers,
} from '@/lib/server/catalog';
import { getSettings } from '@/lib/server/settings';
import { feedImageUrl } from '@/lib/imageUrl';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Every product page is pre-built at deploy time (skipped on preview deployments).
export async function generateStaticParams() {
  if (process.env.VERCEL_ENV === 'preview') return [];
  try {
    return (await getAllProductSlugs()).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = await getProductBySlug(slug);
  if (!r?.product) return {};
  const p = r.product;
  const description = p.shortDescription || p.description.slice(0, 160);
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: 'website', title: p.name, description, url: `/product/${p.slug}` },
    twitter: { card: 'summary_large_image', title: p.name, description },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const r = await getProductBySlug(slug);
  if (!r) notFound();
  if (r.redirect) permanentRedirect(`/product/${r.redirect}`);
  const product = r.product;

  const [settings, reviews, breakdown, related, offers] = await Promise.all([
    getSettings(),
    getApprovedReviews(product.id),
    getRatingBreakdown(product.id),
    getRelatedProducts(product, 4),
    getSiteOffers(),
  ]);

  const url = `${siteUrl}/product/${product.slug}`;
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description.slice(0, 500),
    image: product.images.map((i) => feedImageUrl(i, siteUrl)),
    sku: product.sku || product.id,
    brand: { '@type': 'Brand', name: settings.store.name },
    ...(product.ratingCount > 0 && {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.ratingCount },
    }),
    offers: product.hasVariants
      ? {
          '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: product.minPrice, highPrice: product.maxPrice,
          offerCount: product.variants.length, availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url,
        }
      : { '@type': 'Offer', priceCurrency: 'INR', price: product.price, availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url },
  };
  const crumbs = [
    { name: 'Home', url: siteUrl },
    ...(product.category ? [{ name: product.category.name, url: `${siteUrl}/shop/${product.category.slug}` }] : [{ name: 'Shop', url: `${siteUrl}/shop` }]),
    { name: product.name, url },
  ];
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbLd} />
      <nav aria-label="Breadcrumb" className="mb-6 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="mx-2">/</span>
        {product.category ? <Link href={`/shop/${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> : <Link href="/shop" className="hover:text-ink">Shop</Link>}
        <span className="mx-2">/</span>
        <span className="text-ink-soft">{product.name}</span>
      </nav>

      <ProductView
        product={product}
        offers={offers}
        freeShippingThreshold={settings.shipping.freeShippingThreshold}
        codEnabled={settings.payments.codEnabled}
        holidayMode={settings.checkout.holidayMode}
        holidayMessage={settings.checkout.holidayMessage}
      />

      <section className="mt-20"><ProductInfoTabs product={product} /></section>
      <div className="mt-16"><ProductStory product={product} /></div>
      <div className="mt-20"><ProductReviews product={product} reviews={reviews} breakdown={breakdown} /></div>

      {product.faqs.length > 0 && (
        <section className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="self-start lg:sticky lg:top-24"><SectionHeading eyebrow="FAQ" title="Before you buy" /></div>
          <div className="divide-y divide-line border-y border-line">
            {product.faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold">
                  {f.q}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg transition group-open:rotate-45 group-open:bg-ink group-open:text-white">+</span>
                </summary>
                <p className="mt-3 pr-12 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-20">
          <SectionHeading eyebrow="Goes well with" title="Complete the look" href="/shop" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
