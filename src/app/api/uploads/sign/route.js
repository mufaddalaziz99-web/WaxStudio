import { route, rateLimit } from '@/lib/server/http';
import { cloudinarySignature } from '@/lib/server/storage';
import { getSessionUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
const PUBLIC_FOLDERS = ['reviews', 'issues'];
const ADMIN_FOLDERS = ['products', 'categories', 'misc'];

// Cloudinary signed direct-upload params, or { signature: null } → client falls back to POST /api/uploads.
export const GET = route(async (req) => {
  rateLimit(req, 'upload-sign', 30, 10 * 60_000);
  let folder = new URL(req.url).searchParams.get('folder') || 'misc';
  if (ADMIN_FOLDERS.includes(folder)) {
    const user = await getSessionUser();
    if (!user?.is_admin) return { signature: null };
  } else if (!PUBLIC_FOLDERS.includes(folder)) {
    folder = 'issues';
  }
  const sig = await cloudinarySignature(folder);
  return sig || { signature: null };
});
