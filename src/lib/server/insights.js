import 'server-only';
import { query } from './db';

const today = () => new Date().toISOString().slice(0, 10);

/** Fire-and-forget counters for the admin Insights page. Never throws. */
export function bumpProductStat(productId, field, by = 1) {
  if (!['views', 'add_to_cart', 'purchases'].includes(field) || !productId) return Promise.resolve();
  return query(
    `INSERT INTO product_stats_daily (product_id, day, ${field}) VALUES ($1, $2, $3)
     ON CONFLICT (product_id, day) DO UPDATE SET ${field} = product_stats_daily.${field} + EXCLUDED.${field}`,
    [productId, today(), by],
  ).catch(() => {});
}

export function bumpCounter(key, by = 1) {
  return query(
    `INSERT INTO daily_counters (day, key, count) VALUES ($1, $2, $3)
     ON CONFLICT (day, key) DO UPDATE SET count = daily_counters.count + EXCLUDED.count`,
    [today(), String(key).slice(0, 60), by],
  ).catch(() => {});
}
