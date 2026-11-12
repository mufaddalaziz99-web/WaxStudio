import 'server-only';
import { env } from './env';
import { pincodeDetails } from './shiprocket';

// Google Places API (New) proxied server-side so the key never reaches the browser.
const BASE = 'https://places.googleapis.com/v1';

export async function suggestAddresses(input, sessionToken) {
  if (!env.hasGoogleMaps) return [];
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY },
    body: JSON.stringify({ input, includedRegionCodes: ['in'], sessionToken, languageCode: 'en' }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
  const data = await res.json();
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 5)
    .map((p) => ({ placeId: p.placeId, text: p.text?.text || '', main: p.structuredFormat?.mainText?.text || '', secondary: p.structuredFormat?.secondaryText?.text || '' }));
}

export async function addressDetails(placeId, sessionToken) {
  if (!env.hasGoogleMaps) return null;
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '';
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: { 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'addressComponents,formattedAddress,displayName' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Place details ${res.status}`);
  const d = await res.json();
  const get = (type) => d.addressComponents?.find((c) => c.types?.includes(type))?.longText || '';
  const line1 = [get('premise') || d.displayName?.text, get('street_number'), get('route')].filter(Boolean).join(', ');
  return {
    line1: line1 || d.formattedAddress?.split(',').slice(0, 2).join(',') || '',
    line2: [get('sublocality_level_2'), get('sublocality_level_1') || get('sublocality')].filter(Boolean).join(', '),
    city: get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    pincode: get('postal_code'),
  };
}

/** Pincode -> city/state via Shiprocket (cached). Returns null when unknown or not configured. */
export async function lookupPincode(pincode) {
  if (!env.hasShiprocket) return null;
  try {
    return await pincodeDetails(pincode);
  } catch (e) {
    console.error('[pincode]', pincode, e.message);
    return null;
  }
}
