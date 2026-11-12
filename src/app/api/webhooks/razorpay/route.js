import { after, NextResponse } from 'next/server';
import { one, many } from '@/lib/server/db';
import { verifyWebhookSignature, toPaise } from '@/lib/server/razorpay';
import { markOrderPaid, addHistory } from '@/lib/server/orderHelpers';
import { runConfirmedFollowUps } from '@/lib/server/fulfillment';
import { applyRefundWebhook } from '@/lib/server/refunds';
import { refreshProducts } from '@/lib/server/revalidate';

export const dynamic = 'force-dynamic';

// Authoritative path (server to server, in case the browser closes).
// Bad signature → 400. Processing error → 500 so Razorpay retries.
export async function POST(req) {
  const raw = await req.text(); // RAW body — re-serialised JSON would break the HMAC
  const signature = req.headers.get('x-razorpay-signature');
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const event = evt.event;
    if (event === 'payment.captured') {
      const p = evt.payload?.payment?.entity;
      const order = p?.order_id ? await one('SELECT * FROM orders WHERE razorpay_order_id = $1', [p.order_id]) : null;
      if (!order) return NextResponse.json({ ok: true, ignored: 'unknown order' });
      if (Number(p.amount) !== toPaise(order.total)) {
        console.error('[webhook] amount mismatch', order.order_number, p.amount, order.total);
        await addHistory(null, order.id, order.fulfillment_status, `Webhook payment amount mismatch (${p.amount} paise)`, 'webhook', false);
        return NextResponse.json({ ok: true, ignored: 'amount mismatch' });
      }
      const r = await markOrderPaid(order.id, { paymentId: p.id, source: 'webhook' });
      if (r.transitioned) {
        if (r.outcome === 'restored') {
          const items = await many('SELECT product_id FROM order_items WHERE order_id = $1', [order.id]);
          await refreshProducts(items.map((i) => i.product_id));
        }
        after(() => runConfirmedFollowUps(order.id));
      }
      return NextResponse.json({ ok: true, outcome: r.outcome });
    }

    if (event === 'payment.failed') {
      // Recorded only — the customer may retry in the same modal.
      const p = evt.payload?.payment?.entity;
      const order = p?.order_id ? await one('SELECT id, fulfillment_status FROM orders WHERE razorpay_order_id = $1', [p.order_id]) : null;
      if (order) {
        const reason = p.error_description || p.error_reason || 'unknown reason';
        await addHistory(null, order.id, order.fulfillment_status, `Payment attempt failed: ${reason}`, 'webhook', false);
      }
      return NextResponse.json({ ok: true });
    }

    if (event?.startsWith('refund.')) {
      const refund = evt.payload?.refund?.entity;
      if (refund) await applyRefundWebhook(refund);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, ignored: event });
  } catch (e) {
    console.error('[webhook:razorpay]', e);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
