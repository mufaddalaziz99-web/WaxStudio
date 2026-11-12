import { route, readJson, rateLimit } from '@/lib/server/http';
import { getSessionUser } from '@/lib/server/auth';
import { submitReview } from '@/lib/server/reviews';
import { reviewSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// Reviews go through admin moderation (unless auto-approve is on for verified buyers).
export const POST = route(async (req) => {
  rateLimit(req, 'reviews', 5, 10 * 60_000);
  const input = reviewSchema.parse(await readJson(req));
  const user = await getSessionUser();
  const review = await submitReview(input, { user });
  return { review };
});
