import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { many, one } from '@/lib/server/db';
import ProductImage from '@/components/ui/ProductImage';
import ReviewForm from '@/components/product/ReviewForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Write a review', robots: { index: false } };

// Link from the review-request email (orders.review_token). Reviews written here are "verified buyer".
export default async function ReviewPage({ params }) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();
  const order = await one(`SELECT id, name, order_number, fulfillment_status FROM orders WHERE review_token = $1`, [token]);
  if (!order) notFound();
  if (order.fulfillment_status !== 'delivered') {
    return (
      <div className="container-page max-w-xl py-20 text-center">
        <h1 className="font-display text-3xl">Almost there</h1>
        <p className="mt-3 text-ink-soft">You can review order {order.order_number} once it has been delivered.</p>
        <Link href="/" className="btn-primary mt-6">Back to shop</Link>
      </div>
    );
  }
  const items = await many(
    `SELECT DISTINCT ON (i.product_id) i.product_id, i.name, i.image, p.slug,
       EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = $1 AND r.product_id = i.product_id) AS reviewed
     FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = $1`,
    [order.id],
  );
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="font-display text-4xl">How was your order, {order.name.split(' ')[0]}?</h1>
      <p className="mt-2 text-ink-soft">Order {order.order_number}. Your review helps other shoppers.</p>
      <div className="mt-8 space-y-6">
        {items.map((i) => (
          <section key={i.product_id} className="card p-5">
            <div className="flex items-center gap-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                <ProductImage src={i.image} alt={i.name} fill sizes="64px" className="object-cover" />
              </span>
              <Link href={`/product/${i.slug}`} className="font-semibold hover:underline decoration-brand-400 decoration-2 underline-offset-4">{i.name}</Link>
            </div>
            {i.reviewed ? (
              <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Thanks — you&apos;ve already reviewed this item.</p>
            ) : (
              <ReviewForm productId={i.product_id} token={token} defaultOpen defaultName={order.name} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
