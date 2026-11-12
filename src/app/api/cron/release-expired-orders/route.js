import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { many } from '@/lib/server/db';
import { releaseExpiredOrders } from '@/lib/server/orderHelpers';
import { sendBackInStockAlerts } from '@/lib/server/stockAlerts';
import { sendDueReviewRequests } from '@/lib/server/reviews';
import { sendPaymentFailedEmail, sendOrderConfirmationEmails } from '@/lib/server/orderEmails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') || '';
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Daily backstop (Vercel Cron, 03:00 IST): release expired checkouts, back-in-stock alerts,
// review requests, and retry any un-sent payment-failed / confirmation emails.
export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = {};
  const step = async (name, fn) => {
    try {
      result[name] = await fn();
    } catch (e) {
      console.error(`[cron:${name}]`, e);
      result[name] = { error: e.message };
    }
  };
  await step('released', async () => (await releaseExpiredOrders()).length);
  await step('paymentReminders', async () => {
    const rows = await many(
      `SELECT id FROM orders WHERE expired AND payment_failed_emailed_at IS NULL AND payment_status <> 'paid'
         AND cancelled_at > now() - interval '3 days' LIMIT 50`,
    );
    for (const r of rows) await sendPaymentFailedEmail(r.id).catch(() => {});
    return rows.length;
  });
  await step('confirmationRetries', async () => {
    const rows = await many(
      `SELECT id FROM orders WHERE fulfillment_status NOT IN ('placed','cancelled')
         AND (customer_emailed_at IS NULL OR shop_emailed_at IS NULL) AND created_at > now() - interval '3 days' LIMIT 50`,
    );
    for (const r of rows) await sendOrderConfirmationEmails(r.id).catch(() => {});
    return rows.length;
  });
  await step('backInStock', sendBackInStockAlerts);
  await step('reviewRequests', sendDueReviewRequests);
  return NextResponse.json({ ok: true, ...result });
}
