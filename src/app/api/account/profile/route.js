import { route, readJson } from '@/lib/server/http';
import { publicUser, requireUser } from '@/lib/server/auth';
import { profileSchema } from '@/lib/validation';
import { updateProfile } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await requireUser();
  return { user: publicUser(user) };
});

// PATCH /api/account/profile { name, phone? } -> { user }
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = profileSchema.parse(await readJson(req));
  return { user: await updateProfile(user.id, body) };
});
