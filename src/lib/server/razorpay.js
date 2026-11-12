import 'server-only';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from './env';

let client = null;
export function razorpay() {
  if (!env.hasRazorpay) throw new Error('Razorpay is not configured');
  if (!client) client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  return client;
}

/** Money is whole rupees in our DB; Razorpay wants paise. */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);

export async function createRazorpayOrder({ amountRupees, receipt, notes = {} }) {
  return razorpay().orders.create({ amount: toPaise(amountRupees), currency: 'INR', receipt, notes });
}

export async function fetchPayment(paymentId) {
  return razorpay().payments.fetch(paymentId);
}

export async function refundPayment(paymentId, amountRupees, notes = {}) {
  return razorpay().payments.refund(paymentId, { amount: toPaise(amountRupees), speed: 'normal', notes });
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** HMAC-SHA256 of "order_id|payment_id" with the key secret, compared in constant time. */
export function verifyCheckoutSignature({ orderId, paymentId, signature, secret = process.env.RAZORPAY_KEY_SECRET }) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhook signature over the RAW request body (re-serialised JSON would break the HMAC). */
export function verifyWebhookSignature(rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
