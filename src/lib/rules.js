// Shared rules used by both browser and server.
export const MAX_QTY_PER_LINE = 10;
export const MAX_CART_LINES = 30;
export const PHONE_RE = /^[6-9]\d{9}$/;           // 10-digit Indian mobile
export const PINCODE_RE = /^[1-9]\d{5}$/;         // 6-digit Indian pincode
export const GIFT_MESSAGE_MAX = 200;
export const PAYMENT_HOLD_MINUTES = 15;           // unpaid online orders are released after this
export const CART_STORAGE_KEY = 'store_cart_v1';
export const WISHLIST_STORAGE_KEY = 'store_wishlist_v1';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
/** Format whole rupees as ₹1,299 */
export function formatINR(rupees) {
  return inr.format(Math.round(Number(rupees) || 0));
}

export function discountPercent(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
