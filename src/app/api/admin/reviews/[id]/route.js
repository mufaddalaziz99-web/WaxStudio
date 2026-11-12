import { route, readJson, notFound } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { deleteReview, moderateReview } from '@/lib/server/reviews';
import { adminReviewSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// PATCH { status?, adminReply? } — approve / reject / reply.
export const PATCH = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Review');
  const input = adminReviewSchema.parse(await readJson(req));
  const review = await moderateReview(id, { status: input.status, adminReply: input.adminReply });
  if (!review) throw notFound('Review not found');
  return { ok: true, review };
});

export const DELETE = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Review');
  const review = await deleteReview(id);
  if (!review) throw notFound('Review not found');
  return { ok: true };
});
