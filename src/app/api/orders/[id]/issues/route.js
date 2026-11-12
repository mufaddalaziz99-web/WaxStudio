import { route, readJson, rateLimit } from '@/lib/server/http';
import { reportIssue } from '@/lib/server/orderIssues';
import { issueSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// "Report a problem" with optional photos, within the deadline after delivery.
export const POST = route(async (req, { params }) => {
  rateLimit(req, 'issues', 5, 10 * 60_000);
  const { id } = await params;
  const input = issueSchema.parse(await readJson(req));
  const issue = await reportIssue(id, input);
  return { issue: { id: issue.id, status: issue.status } };
});
