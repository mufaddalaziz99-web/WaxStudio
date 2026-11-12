import 'server-only';
import { many, query } from './db';
import { sendBackInStockEmail } from './orderEmails';

export async function createStockAlert({ productId, variantId, email }) {
  await query(
    `INSERT INTO stock_alerts (product_id, variant_id, email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [productId, variantId || null, email],
  );
}

/** Daily cron (and after restocking in admin): email everyone waiting on an item that is back. */
export async function sendBackInStockAlerts() {
  const due = await many(
    `SELECT a.id, a.email, p.name, p.slug, v.name AS variant_name
     FROM stock_alerts a JOIN products p ON p.id = a.product_id
     LEFT JOIN product_variants v ON v.id = a.variant_id
     WHERE a.notified_at IS NULL AND p.is_hidden = false
       AND (CASE WHEN a.variant_id IS NOT NULL THEN v.stock > 0
                 ELSE (p.stock > 0 OR EXISTS (SELECT 1 FROM product_variants x WHERE x.product_id = p.id AND x.stock > 0 AND NOT x.is_hidden)) END)
     LIMIT 200`,
  );
  let sent = 0;
  for (const a of due) {
    try {
      const claimed = await query('UPDATE stock_alerts SET notified_at = now() WHERE id = $1 AND notified_at IS NULL', [a.id]);
      if (!claimed.rowCount) continue;
      await sendBackInStockEmail({ email: a.email, productName: a.variant_name ? `${a.name} (${a.variant_name})` : a.name, slug: a.slug });
      sent++;
    } catch (e) {
      await query('UPDATE stock_alerts SET notified_at = NULL WHERE id = $1', [a.id]);
      console.error('[stock-alert]', a.id, e.message);
    }
  }
  return sent;
}
