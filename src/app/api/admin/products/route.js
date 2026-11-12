import { route, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { listAdminProducts, saveProduct } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { productInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return { products: await listAdminProducts() };
});

export const POST = route(async (req) => {
  await requireAdmin();
  const input = productInputSchema.parse(await readJson(req));
  const { product } = await saveProduct(null, input);
  refreshStorefront();
  return { ok: true, product: { id: product.id, slug: product.slug } };
});
