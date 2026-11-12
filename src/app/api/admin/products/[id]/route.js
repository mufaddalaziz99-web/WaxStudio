import { after } from 'next/server';
import { route, readJson, notFound } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/auth';
import { parseId } from '@/lib/server/admin';
import { deleteProduct, getAdminProduct, saveProduct, toggleProduct } from '@/lib/server/adminCatalog';
import { refreshStorefront } from '@/lib/server/revalidate';
import { sendBackInStockAlerts } from '@/lib/server/stockAlerts';
import { adminProductToggleSchema, productInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Product');
  const product = await getAdminProduct(id);
  if (!product) throw notFound('Product not found');
  return { product };
});

// PUT — full save (product fields + variants). Back-in-stock alerts go out when stock went 0 → >0.
export const PUT = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Product');
  const input = productInputSchema.parse(await readJson(req));
  const { product, restocked } = await saveProduct(id, input);
  refreshStorefront();
  if (restocked) after(() => sendBackInStockAlerts().catch((e) => console.error('[admin] stock alerts', e.message)));
  return { ok: true, product: { id: product.id, slug: product.slug }, restocked };
});

// PATCH { is_hidden?, is_featured? } — quick toggles from the list.
export const PATCH = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Product');
  const patch = adminProductToggleSchema.parse(await readJson(req));
  const row = await toggleProduct(id, patch);
  refreshStorefront();
  if (patch.is_hidden === false) after(() => sendBackInStockAlerts().catch(() => {}));
  return { ok: true, product: row };
});

// DELETE — products that were ever ordered are hidden instead.
export const DELETE = route(async (req, { params }) => {
  await requireAdmin();
  const id = parseId((await params).id, 'Product');
  const result = await deleteProduct(id);
  refreshStorefront();
  return { ok: true, ...result };
});
