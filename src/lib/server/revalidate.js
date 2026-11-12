import 'server-only';
import { revalidatePath } from 'next/cache';
import { many } from './db';

function safeRevalidate(path, type) {
  try {
    revalidatePath(path, type);
  } catch (e) {
    // Not allowed during render (e.g. lazy sweep triggered from a page); the daily ISR refresh covers it.
    if (process.env.NODE_ENV !== 'production') console.warn('[revalidate] skipped', path, e.message);
  }
}

/**
 * Targeted revalidation after stock / review changes: only the affected product pages
 * plus listing pages. (Whole-site revalidation on every order exhausts ISR write quotas.)
 */
export async function refreshProducts(productIds = []) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length) {
    const rows = await many('SELECT slug FROM products WHERE id = ANY($1::uuid[])', [ids]).catch(() => []);
    for (const r of rows) safeRevalidate(`/product/${r.slug}`);
  }
  safeRevalidate('/');
  safeRevalidate('/shop');
  safeRevalidate('/shop/[categorySlug]', 'page');
}

/** Admin edits: mark the whole storefront stale. */
export function refreshStorefront() {
  safeRevalidate('/', 'layout');
}
