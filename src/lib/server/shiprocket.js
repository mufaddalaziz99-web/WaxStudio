import 'server-only';
import { env } from './env';

// Thin Shiprocket API client. Never call these inside a DB transaction.
const BASE = 'https://apiv2.shiprocket.in/v1/external';
const tokenCache = globalThis.__srToken || (globalThis.__srToken = { token: null, exp: 0 });

async function getToken(force = false) {
  if (!env.hasShiprocket) throw new Error('Shiprocket is not configured');
  if (!force && tokenCache.token && tokenCache.exp > Date.now()) return tokenCache.token;
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(`Shiprocket login failed (${res.status})`);
  tokenCache.token = data.token;
  tokenCache.exp = Date.now() + 9 * 24 * 3600 * 1000; // tokens last 10 days
  return data.token;
}

async function sr(path, { method = 'GET', body, timeout = 12_000, retry = true } = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  if (res.status === 401 && retry) {
    await getToken(true);
    return sr(path, { method, body, timeout, retry: false });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || JSON.stringify(data?.errors || data).slice(0, 300);
    const err = new Error(`Shiprocket ${method} ${path} failed (${res.status}): ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Courier options for pickup -> delivery pincode. */
export async function serviceability({ pickupPincode, deliveryPincode, weightKg, cod = false, length, breadth, height, declaredValue }) {
  const qs = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: cod ? '1' : '0',
    length: String(length),
    breadth: String(breadth),
    height: String(height),
    declared_value: String(declaredValue || 0),
  });
  const data = await sr(`/courier/serviceability/?${qs}`);
  return data?.data?.available_courier_companies || [];
}

const pincodeCache = globalThis.__pincodeCache || (globalThis.__pincodeCache = new Map());

/** { city, state } for a pincode, cached in memory. */
export async function pincodeDetails(pincode) {
  if (pincodeCache.has(pincode)) return pincodeCache.get(pincode);
  const data = await sr(`/open/postcode/details?postcode=${encodeURIComponent(pincode)}`, { timeout: 6000 });
  const d = data?.postcode_details;
  const result = d ? { city: d.city || d.locality?.[0] || '', state: d.state || '' } : null;
  if (pincodeCache.size > 5000) pincodeCache.clear();
  pincodeCache.set(pincode, result);
  return result;
}

export async function createOrder(payload) {
  return sr('/orders/create/adhoc', { method: 'POST', body: payload, timeout: 20_000 });
}
export async function assignAwb(shipmentId, courierId) {
  return sr('/courier/assign/awb', { method: 'POST', body: { shipment_id: String(shipmentId), courier_id: courierId ? String(courierId) : undefined } });
}
export async function generateLabel(shipmentId) {
  return sr('/courier/generate/label', { method: 'POST', body: { shipment_id: [String(shipmentId)] } });
}
export async function schedulePickup(shipmentId) {
  return sr('/courier/generate/pickup', { method: 'POST', body: { shipment_id: [String(shipmentId)] } });
}
export async function cancelShiprocketOrder(shiprocketOrderId) {
  return sr('/orders/cancel', { method: 'POST', body: { ids: [Number(shiprocketOrderId)] } });
}
export async function trackAwb(awb) {
  return sr(`/courier/track/awb/${encodeURIComponent(awb)}`);
}
