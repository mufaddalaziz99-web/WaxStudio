import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listAdminCategories, saveCategory } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { categoryInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return { categories: await listAdminCategories() };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const category = await saveCategory(null, categoryInputSchema.parse(await readJson(req)));
  refreshStorefront();
  return { ok: true, category };
});
