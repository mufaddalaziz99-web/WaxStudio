import 'server-only';
import { many, query } from './db';

// Every setting group has defaults here; rows in the `settings` table override them (shallow merge).
export const SETTINGS_DEFAULTS = {
  store: {
    name: 'Wax Studio',
    tagline: 'Natural hair removal powder for smooth skin',
    supportEmail: 'support@example.com',
    supportPhone: '',
    whatsapp: '',               // digits incl. country code, e.g. 919876543210
    instagram: '',
    address: '',
    gstin: '',
    legalName: '',
    brandColor: '#111111',
  },
  announcement: {
    enabled: true,
    text: 'Free shipping on orders above ₹499 · Use WELCOME10 for 10% off your first order',
  },
  shipping: {
    flatRate: 59,               // used when Shiprocket is not configured or errors
    flatRateEtaDays: '4–7',
    freeShippingThreshold: 499, // items total at/above which the standard option is free (0 = off)
    pickupPincode: '400001',
    packagingWeightGrams: 50,
    defaultWeightGrams: 200,
    defaultLengthCm: 12,
    defaultBreadthCm: 12,
    defaultHeightCm: 8,
  },
  payments: {
    codEnabled: true,
    codFee: 49,
    codFreeAbove: 999,          // COD fee waived at/above this items total (0 = never waived)
    codMaxOrder: 5000,          // COD hidden above this order total (0 = no limit)
  },
  checkout: {
    holidayMode: false,
    holidayMessage: 'We are on a short break. Orders will reopen soon!',
    giftWrapFee: 0,             // gift wrap is free by default
    lowStockThreshold: 5,
  },
  reviews: {
    requestAfterDays: 3,
    autoApprove: false,
  },
};

const CACHE_MS = 30_000;
let cache = globalThis.__settingsCache || null;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && cache.at > Date.now() - CACHE_MS) return cache.value;
  let rows = [];
  try {
    rows = await many('SELECT key, value FROM settings');
  } catch (e) {
    console.error('[settings] failed to load, using defaults', e.message);
  }
  const value = structuredClone(SETTINGS_DEFAULTS);
  for (const r of rows) {
    if (value[r.key] && typeof r.value === 'object' && !Array.isArray(r.value)) {
      value[r.key] = { ...value[r.key], ...r.value };
    } else {
      value[r.key] = r.value;
    }
  }
  cache = globalThis.__settingsCache = { at: Date.now(), value };
  return value;
}

export async function updateSettings(group, patch) {
  if (!SETTINGS_DEFAULTS[group]) throw new Error(`Unknown settings group ${group}`);
  const allowed = Object.keys(SETTINGS_DEFAULTS[group]);
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`,
    [group, JSON.stringify(clean)],
  );
  cache = globalThis.__settingsCache = null;
  return getSettings({ fresh: true });
}

/** Subset safe to send to the browser. */
export function publicSettings(s) {
  return {
    store: s.store,
    announcement: s.announcement,
    shipping: { freeShippingThreshold: s.shipping.freeShippingThreshold, flatRate: s.shipping.flatRate },
    payments: { codEnabled: s.payments.codEnabled, codFee: s.payments.codFee, codFreeAbove: s.payments.codFreeAbove, codMaxOrder: s.payments.codMaxOrder },
    checkout: { holidayMode: s.checkout.holidayMode, holidayMessage: s.checkout.holidayMessage, giftWrapFee: s.checkout.giftWrapFee },
  };
}
