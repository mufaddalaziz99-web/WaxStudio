import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { deleteCategory, saveCategory } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { categoryInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// PUT — a slug change keeps the old URL working via category_redirects.
export const PUT = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Category');
  const category = await saveCategory(id, categoryInputSchema.parse(await readJson(req)));
  refreshStorefront();
  return { ok: true, category };
});

// DELETE — products in it become uncategorised.
export const DELETE = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Category');
  await deleteCategory(id);
  refreshStorefront();
  return { ok: true };
});
