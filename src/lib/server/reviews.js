import 'server-only';
import { many, one, query } from './db';
import { badRequest } from './http';
import { getSettings } from './settings';
import { refreshProducts } from './revalidate';
import { sendReviewRequestEmail } from './orderEmails';

export async function recomputeRating(productId) {
  await query(
    `UPDATE products SET
       rating_avg = COALESCE((SELECT round(avg(rating)::numeric, 2) FROM reviews WHERE product_id = $1 AND status = 'approved'), 0),
       rating_count = (SELECT count(*) FROM reviews WHERE product_id = $1 AND status = 'approved'),
       updated_at = now()
     WHERE id = $1`,
    [productId],
  );
}

/** Submit a review. With a valid review token (from the review-request email) it is marked verified. */
export async function submitReview(input, { user } = {}) {
  const product = await one('SELECT id FROM products WHERE id = $1', [input.productId]);
  if (!product) throw badRequest('Product not found', 'product_not_found');
  let orderId = null;
  let verified = false;
  if (input.token) {
    const order = await one(
      `SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.review_token = $1 AND i.product_id = $2 AND o.fulfillment_status = 'delivered' LIMIT 1`,
      [input.token, input.productId],
    );
    if (order) {
      orderId = order.id;
      verified = true;
      const dup = await one('SELECT 1 FROM reviews WHERE order_id = $1 AND product_id = $2', [orderId, input.productId]);
      if (dup) throw badRequest('You have already reviewed this item. Thank you!', 'already_reviewed');
    }
  } else if (user) {
    const bought = await one(
      `SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = $1 AND i.product_id = $2 AND o.fulfillment_status = 'delivered' LIMIT 1`,
      [user.id, input.productId],
    );
    verified = Boolean(bought);
  }
  const settings = await getSettings();
  const status = settings.reviews.autoApprove && verified ? 'approved' : 'pending';
  const review = await one(
    `INSERT INTO reviews (product_id, order_id, user_id, name, email, rating, title, body, images, status, is_verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, status`,
    [input.productId, orderId, user?.id || null, input.name, input.email || user?.email || null, input.rating,
      input.title || '', input.body, JSON.stringify(input.images || []), status, verified],
  );
  if (status === 'approved') {
    await recomputeRating(input.productId);
    await refreshProducts([input.productId]);
  }
  return review;
}

export async function moderateReview(id, { status, adminReply }) {
  const review = await one(
    `UPDATE reviews SET status = COALESCE($2, status), admin_reply = COALESCE($3, admin_reply) WHERE id = $1 RETURNING *`,
    [id, status || null, adminReply ?? null],
  );
  if (!review) return null;
  await recomputeRating(review.product_id);
  await refreshProducts([review.product_id]);
  return review;
}

export async function deleteReview(id) {
  const review = await one('DELETE FROM reviews WHERE id = $1 RETURNING product_id', [id]);
  if (review) {
    await recomputeRating(review.product_id);
    await refreshProducts([review.product_id]);
  }
  return review;
}

/** Daily cron: review request emails 3+ days after delivery. */
export async function sendDueReviewRequests() {
  const settings = await getSettings();
  const due = await many(
    `SELECT id FROM orders WHERE fulfillment_status = 'delivered' AND review_requested_at IS NULL
       AND delivered_at < now() - ($1 || ' days')::interval AND delivered_at > now() - interval '30 days'
     LIMIT 50`,
    [String(settings.reviews.requestAfterDays)],
  );
  let sent = 0;
  for (const { id } of due) {
    try {
      if (await sendReviewRequestEmail(id)) sent++;
    } catch (e) {
      console.error('[review-request]', id, e.message);
    }
  }
  return sent;
}
