import { after, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { applyCourierStatus } from '@/lib/server/orders';
import { sendShippedEmail } from '@/lib/server/orderEmails';

export const dynamic = 'force-dynamic';

function tokenOk(given) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Shiprocket tracking webhook (token in x-api-key). Forward-only and idempotent.
// RTO / NDR / lost events are recorded but never move the order.
export async function POST(req) {
  if (!tokenOk(req.headers.get('x-api-key'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    const scans = Array.isArray(body.scans) ? body.scans : [];
    const last = scans[scans.length - 1];
    const r = await applyCourierStatus({
      awb: body.awb ? String(body.awb) : null,
      orderNumber: body.order_id ? String(body.order_id) : null,
      rawStatus: body.current_status || body.shipment_status || last?.activity || 'UNKNOWN',
      location: last?.location || body.current_location || null,
      eventTime: body.current_timestamp || last?.date || null,
      payload: body,
    });
    if (r.changed && r.status === 'shipped' && r.orderId) {
      after(() => sendShippedEmail(r.orderId).catch((e) => console.error('[shipped email]', e.message)));
    }
    // Always 200 for well-formed, authenticated calls so Shiprocket doesn't disable the hook.
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[webhook:courier]', e);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
