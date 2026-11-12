import 'server-only';
import { many, one } from './db';
import { badRequest, notFound } from './http';
import { SETTINGS_DEFAULTS } from './settings';
import { env } from './env';

// ---------------------------------------------------------------------------
// Admin: reviews list, contact messages, stock alerts, insights, settings helpers.
// (Review moderation and issue resolution live in reviews.js / orderIssues.js.)
// ---------------------------------------------------------------------------

export async function listAdminReviews({ status } = {}) {
  return many(
    `SELECT r.*, p.name AS product_name, p.slug AS product_slug, o.order_number
       FROM reviews r JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id
      ${status ? 'WHERE r.status = $1' : ''}
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 300`,
    status ? [status] : [],
  );
}

export async function listMessages({ handled } = {}) {
  const filter = handled === 'true' ? 'WHERE handled' : handled === 'false' ? 'WHERE NOT handled' : '';
  return many(`SELECT * FROM contact_messages ${filter} ORDER BY handled, created_at DESC LIMIT 300`);
}

export async function setMessageHandled(id, handled) {
  const row = await one('UPDATE contact_messages SET handled = $2 WHERE id = $1 RETURNING *', [id, Boolean(handled)]);
  if (!row) throw notFound('Message not found');
  return row;
}

/** Back-in-stock requests grouped per product/variant with current stock. */
export async function listStockAlerts() {
  return many(
    `SELECT a.product_id, p.name AS product_name, p.slug, a.variant_id, v.name AS variant_name,
       COALESCE(v.stock, p.stock) AS stock, p.is_hidden,
       count(*) FILTER (WHERE a.notified_at IS NULL)::int AS pending,
       count(*) FILTER (WHERE a.notified_at IS NOT NULL)::int AS notified,
       max(a.created_at) AS last_requested_at
     FROM stock_alerts a JOIN products p ON p.id = a.product_id
     LEFT JOIN product_variants v ON v.id = a.variant_id
     GROUP BY a.product_id, p.name, p.slug, a.variant_id, v.name, v.stock, p.stock, p.is_hidden
     ORDER BY pending DESC, last_requested_at DESC`,
  );
}

/** Last `days` days of storefront insights. */
export async function getInsights(days = 30) {
  const d = Math.min(Math.max(Number(days) || 30, 1), 365);
  const since = `(current_date - ($1::int - 1))`;
  const params = [d];

  const [products, daily, searches, zeroSearches, pincodes, pincodeTotals, counters, counterDaily] = await Promise.all([
    many(
      `SELECT p.id, p.name, p.slug, COALESCE(sum(s.views), 0)::int AS views, COALESCE(sum(s.add_to_cart), 0)::int AS add_to_cart,
         COALESCE(sum(s.purchases), 0)::int AS purchases
       FROM product_stats_daily s JOIN products p ON p.id = s.product_id
       WHERE s.day >= ${since} GROUP BY p.id, p.name, p.slug ORDER BY views DESC, purchases DESC`,
      params,
    ),
    many(
      `SELECT s.day::text AS day, sum(s.views)::int AS views, sum(s.add_to_cart)::int AS add_to_cart, sum(s.purchases)::int AS purchases
       FROM product_stats_daily s WHERE s.day >= ${since} GROUP BY s.day ORDER BY s.day DESC`,
      params,
    ),
    many(
      `SELECT lower(trim(query)) AS query, count(*)::int AS count, round(avg(results_count))::int AS avg_results,
         count(*) FILTER (WHERE results_count = 0)::int AS zero_results
       FROM search_events WHERE created_at >= ${since} GROUP BY lower(trim(query)) ORDER BY count DESC LIMIT 50`,
      params,
    ),
    one(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE results_count = 0)::int AS zero
       FROM search_events WHERE created_at >= ${since}`,
      params,
    ),
    many(
      `SELECT pincode, count(*)::int AS checks,
         count(*) FILTER (WHERE serviceable = false)::int AS unserviceable,
         count(*) FILTER (WHERE source = 'checkout')::int AS at_checkout,
         bool_or(serviceable) AS ever_serviceable
       FROM pincode_checks WHERE created_at >= ${since} GROUP BY pincode ORDER BY checks DESC LIMIT 50`,
      params,
    ),
    one(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE serviceable = false)::int AS unserviceable,
         count(*) FILTER (WHERE serviceable IS NOT NULL)::int AS known, count(DISTINCT pincode)::int AS distinct_pincodes
       FROM pincode_checks WHERE created_at >= ${since}`,
      params,
    ),
    many(
      `SELECT key, sum(count)::int AS count FROM daily_counters WHERE day >= ${since} GROUP BY key ORDER BY count DESC`,
      params,
    ),
    many(
      `SELECT day::text AS day, key, count FROM daily_counters WHERE day >= ${since} ORDER BY day DESC, key`,
      params,
    ),
  ]);

  const totals = products.reduce(
    (t, p) => ({ views: t.views + p.views, add_to_cart: t.add_to_cart + p.add_to_cart, purchases: t.purchases + p.purchases }),
    { views: 0, add_to_cart: 0, purchases: 0 },
  );
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const funnel = {
    ...totals,
    viewToCart: pct(totals.add_to_cart, totals.views),
    cartToPurchase: pct(totals.purchases, totals.add_to_cart),
    viewToPurchase: pct(totals.purchases, totals.views),
  };

  // Pivot daily counters into one row per day.
  const counterKeys = counters.map((c) => c.key);
  const byDay = new Map();
  for (const r of counterDaily) {
    if (!byDay.has(r.day)) byDay.set(r.day, { day: r.day });
    byDay.get(r.day)[r.key] = r.count;
  }

  return {
    days: d,
    funnel,
    products: products.map((p) => ({ ...p, cartRate: pct(p.add_to_cart, p.views), conversion: pct(p.purchases, p.views) })),
    daily,
    searches,
    searchTotals: { ...zeroSearches, zeroPct: pct(zeroSearches.zero, zeroSearches.total) },
    pincodes,
    pincodeTotals: { ...pincodeTotals, unserviceablePct: pct(pincodeTotals.unserviceable, pincodeTotals.known) },
    counters,
    counterKeys,
    counterDaily: [...byDay.values()],
  };
}

// ------------------------------- Settings ----------------------------------

/**
 * Coerce a settings patch to the types of SETTINGS_DEFAULTS[group] (numbers stay numbers,
 * booleans stay booleans). Unknown keys are dropped by updateSettings anyway.
 */
export function coerceSettingsPatch(group, patch) {
  const defaults = SETTINGS_DEFAULTS[group];
  if (!defaults) throw notFound('Unknown settings group');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw badRequest('Invalid settings', 'validation');
  const out = {};
  for (const [key, def] of Object.entries(defaults)) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (typeof def === 'number') {
      const n = Number(v);
      if (v === null || v === '' || !Number.isFinite(n) || n < 0) throw badRequest(`${key}: Enter a number (0 or more)`, 'validation', { field: key });
      out[key] = n;
    } else if (typeof def === 'boolean') {
      out[key] = Boolean(v);
    } else {
      const s = v == null ? '' : String(v).trim();
      if (s.length > 2000) throw badRequest(`${key}: Too long`, 'validation', { field: key });
      out[key] = s;
    }
  }
  if (group === 'store' && out.brandColor && !/^#[0-9a-fA-F]{6}$/.test(out.brandColor)) {
    throw badRequest('brandColor: Use a hex colour like #d6852a', 'validation', { field: 'brandColor' });
  }
  if (group === 'store' && out.whatsapp) out.whatsapp = out.whatsapp.replace(/\D/g, '');
  if (group === 'shipping' && out.pickupPincode && !/^[1-9]\d{5}$/.test(out.pickupPincode)) {
    throw badRequest('pickupPincode: Enter a valid 6-digit pincode', 'validation', { field: 'pickupPincode' });
  }
  return out;
}

export function integrationStatus() {
  return {
    razorpay: env.hasRazorpay,
    razorpayWebhook: env.hasRazorpayWebhook,
    shiprocket: env.hasShiprocket,
    googleMaps: env.hasGoogleMaps,
    googleSignIn: env.hasGoogleSignIn,
    resend: env.hasResend,
    cloudinary: env.hasCloudinary,
    storageDriver: env.storageDriver,
    siteUrl: env.siteUrl,
    orderPrefix: env.orderPrefix,
  };
}
