import 'server-only';
import { env } from './env';
import { getSettings } from './settings';
import { getProductById, lookupLines } from './catalog';
import { serviceability } from './shiprocket';
import { codFeeFor, qualifiesForFreeShipping } from '../shippingRules';
import { query } from './db';

/**
 * Merge the cart into one parcel: packaging weight + Σ(weight × qty), the largest
 * length and breadth, and stacked height. Missing dimensions fall back to Settings defaults.
 */
export function buildPackage(lines, products, shippingSettings) {
  const s = shippingSettings;
  let grams = Number(s.packagingWeightGrams) || 0;
  let length = 0;
  let breadth = 0;
  let height = 0;
  for (const l of lines) {
    const p = products.get(l.productId) || {};
    const w = Number(l.weightGrams || p.weightGrams || s.defaultWeightGrams) || 0;
    grams += w * l.quantity;
    length = Math.max(length, Number(p.dimensions?.length || s.defaultLengthCm));
    breadth = Math.max(breadth, Number(p.dimensions?.breadth || s.defaultBreadthCm));
    height += Number(p.dimensions?.height || s.defaultHeightCm) * l.quantity;
  }
  return {
    weightKg: Math.max(0.05, Math.round(grams) / 1000),
    length: Math.max(1, Math.ceil(length)),
    breadth: Math.max(1, Math.ceil(breadth)),
    height: Math.max(1, Math.ceil(height)),
  };
}

function etdDays(c) {
  const d = Number(c.estimated_delivery_days);
  return Number.isFinite(d) && d > 0 ? d : 99;
}

/** Turn raw Shiprocket couriers into our options: cheapest, fastest, + a COD-capable one if neither collects cash. */
function pickCourierOptions(couriers) {
  if (!couriers.length) return [];
  const usable = couriers.filter((c) => c.blocked !== 1 && Number(c.rate) > 0);
  if (!usable.length) return [];
  const byPrice = [...usable].sort((a, b) => Number(a.rate) - Number(b.rate) || etdDays(a) - etdDays(b));
  const byEta = [...usable].sort((a, b) => etdDays(a) - etdDays(b) || Number(a.rate) - Number(b.rate));
  const picked = [];
  const add = (c, kind) => {
    if (!c || picked.some((p) => p.courierId === c.courier_company_id)) return;
    picked.push({
      id: `sr_${c.courier_company_id}`,
      kind,
      courierId: c.courier_company_id,
      courierName: c.courier_name,
      price: Math.ceil(Number(c.rate)),
      etaDays: etdDays(c) === 99 ? null : etdDays(c),
      etd: c.etd || null,
      cod: Number(c.cod) === 1,
    });
  };
  add(byPrice[0], 'standard');
  add(byEta[0], 'express');
  if (!picked.some((p) => p.cod)) add(byPrice.find((c) => Number(c.cod) === 1), 'cod');
  return picked;
}

function flatOption(settings) {
  return {
    id: 'flat_standard',
    kind: 'standard',
    courierId: null,
    courierName: 'Standard delivery',
    price: Number(settings.shipping.flatRate) || 0,
    etaDays: null,
    etaText: `${settings.shipping.flatRateEtaDays} days`,
    cod: Boolean(settings.payments.codEnabled),
  };
}

/** Free shipping on the standard option when the items total meets the threshold; labels. */
export function finalizeOptions(options, itemsTotal, settings) {
  const free = qualifiesForFreeShipping(itemsTotal, settings.shipping.freeShippingThreshold);
  return options.map((o) => {
    const price = free && o.kind === 'standard' ? 0 : o.price;
    const label = o.kind === 'express' ? 'Express' : o.kind === 'cod' ? 'Standard (Cash on Delivery)' : 'Standard';
    const etaText = o.etaText || (o.etaDays ? `${o.etaDays} day${o.etaDays > 1 ? 's' : ''}` : o.etd ? `by ${o.etd}` : null);
    return { ...o, label, price, originalPrice: o.price, free: price === 0 && o.price > 0, etaText };
  });
}

const quoteCache = globalThis.__quoteCache || (globalThis.__quoteCache = new Map());

async function courierQuote(settings, pincode, pkg, declaredValue) {
  const key = `${pincode}:${pkg.weightKg}:${pkg.length}x${pkg.breadth}x${pkg.height}`;
  const hit = quoteCache.get(key);
  if (hit && hit.at > Date.now() - 10 * 60_000) return hit.value;
  const couriers = await serviceability({
    pickupPincode: settings.shipping.pickupPincode,
    deliveryPincode: pincode,
    ...pkg,
    declaredValue,
  });
  const value = pickCourierOptions(couriers);
  if (quoteCache.size > 2000) quoteCache.clear();
  quoteCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Shipping quote for a cart. Uses Shiprocket when configured; falls back to the flat rate
 * from Settings when it is not configured or errors. Prices come from the server, never the browser.
 * @returns {{ source, serviceable, options, itemsTotal, codFee, lines }}
 */
export async function getShippingQuote({ pincode, items, settings: s, recordCheck = 'checkout' }) {
  const settings = s || (await getSettings());
  const lines = await lookupLines(items);
  const available = lines.filter((l) => l.available);
  const qtyByKey = new Map(items.map((i) => [`${i.productId}:${i.variantId || ''}`, i.quantity]));
  const priced = available.map((l) => ({ ...l, quantity: qtyByKey.get(`${l.productId}:${l.variantId || ''}`) || 1 }));
  const itemsTotal = priced.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const products = new Map();
  for (const id of new Set(priced.map((l) => l.productId))) products.set(id, await getProductById(id));
  const pkg = buildPackage(priced, products, settings.shipping);

  let source = 'flat';
  let raw = [flatOption(settings)];
  let serviceable = true;
  if (env.hasShiprocket) {
    try {
      const options = await courierQuote(settings, pincode, pkg, itemsTotal);
      source = 'shiprocket';
      raw = options;
      serviceable = options.length > 0;
    } catch (e) {
      console.error('[shipping] Shiprocket quote failed, using flat rate:', e.message);
    }
  }
  const options = finalizeOptions(raw, itemsTotal, settings);
  if (recordCheck) {
    query('INSERT INTO pincode_checks (pincode, serviceable, source) VALUES ($1, $2, $3)', [pincode, serviceable, recordCheck]).catch(() => {});
  }
  return {
    source,
    serviceable,
    options,
    itemsTotal,
    package: pkg,
    codFee: codFeeFor(itemsTotal, settings.payments),
    freeShippingThreshold: settings.shipping.freeShippingThreshold,
    lines: priced,
  };
}
