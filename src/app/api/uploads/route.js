import { route, rateLimit, badRequest, forbidden } from '@/lib/server/http';
import { storeUpload } from '@/lib/server/storage';
import { getSessionUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
const PUBLIC_FOLDERS = ['reviews', 'issues'];
const ADMIN_FOLDERS = ['products', 'categories', 'misc'];

// Server-side upload (local /public/uploads in dev, or Cloudinary). Product/category images: admins only.
export const POST = route(async (req) => {
  rateLimit(req, 'upload', 20, 10 * 60_000);
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest('Expected multipart form data', 'bad_form');
  const folder = String(form.get('folder') || 'misc');
  if (ADMIN_FOLDERS.includes(folder)) {
    const user = await getSessionUser();
    if (!user?.is_admin) throw forbidden();
  } else if (!PUBLIC_FOLDERS.includes(folder)) {
    throw badRequest('Unknown upload folder', 'bad_folder');
  }
  const url = await storeUpload(form.get('file'), folder);
  return { url };
});
