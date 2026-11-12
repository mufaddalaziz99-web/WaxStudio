import { route, readJson, notFound } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { resolveIssue } from '@/lib/server/orderIssues';
import { adminIssueSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// PATCH { status, adminNote }
export const PATCH = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Issue');
  const input = adminIssueSchema.parse(await readJson(req));
  const issue = await resolveIssue(id, input);
  if (!issue) throw notFound('Issue not found');
  return { ok: true, issue };
});
