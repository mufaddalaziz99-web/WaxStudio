import 'server-only';
import { one } from './db';
import { env } from './env';
import { badRequest } from './http';
import { addHistory } from './orderHelpers';
import { pushOrderToShiprocket } from './fulfillment';
import { assignAwb, generateLabel, schedulePickup } from './shiprocket';
import { requireOrder, setOrderShiprocketError } from './admin';

// Admin Shiprocket actions. Each one: read the order, call Shiprocket (no DB transaction is open),
// then write the result with a single UPDATE. Failures are stored in shiprocket_error so the
// dashboard flags them, and cleared on the next success.

const trackingUrlFor = (awb) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;

function assertShippable(order) {
  if (!env.hasShiprocket) throw badRequest('Shiprocket is not configured. Enter the courier and AWB manually.', 'shiprocket_disabled');
  if (order.fulfillment_status === 'cancelled') throw badRequest('This order is cancelled.', 'cancelled');
  if (order.fulfillment_status === 'placed') throw badRequest('This order has not been paid yet.', 'unpaid');
}

function requireShipment(order) {
  if (!order.shiprocket_shipment_id) throw badRequest('Push the order to Shiprocket first.', 'no_shipment');
}

async function fail(orderId, e) {
  const msg = e?.message || String(e);
  await setOrderShiprocketError(orderId, msg);
  throw badRequest(msg, 'shiprocket_failed');
}

export async function shiprocketAction(orderId, action) {
  const order = await requireOrder(orderId);
  assertShippable(order);

  if (action === 'push') {
    if (order.shiprocket_order_id) throw badRequest('Already pushed to Shiprocket.', 'already_pushed');
    const r = await pushOrderToShiprocket(orderId);
    if (r?.skipped) throw badRequest('This order cannot be pushed right now.', 'not_applicable');
    if (!r?.ok) throw badRequest(r?.error || 'Shiprocket push failed', 'shiprocket_failed');
    await addHistory(null, orderId, order.fulfillment_status, `Pushed to Shiprocket (#${r.shiprocketOrderId})`, 'admin', false);
    return requireOrder(orderId);
  }

  requireShipment(order);

  if (action === 'awb') {
    if (order.awb_code) throw badRequest(`Courier already booked (AWB ${order.awb_code}).`, 'already_booked');
    let res;
    try {
      res = await assignAwb(order.shiprocket_shipment_id, order.shiprocket_courier_id);
    } catch (e) {
      return fail(orderId, e);
    }
    const d = res?.response?.data || {};
    const awb = d.awb_code || res?.awb_code;
    if (!awb) {
      return fail(orderId, new Error(d.awb_assign_error || res?.message || 'Shiprocket did not return an AWB'));
    }
    const updated = await one(
      `UPDATE orders SET awb_code = $2, courier_name = COALESCE($3, courier_name), tracking_url = $4,
         shiprocket_courier_id = COALESCE($5, shiprocket_courier_id), shiprocket_error = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [orderId, String(awb), d.courier_name || null, trackingUrlFor(awb), d.courier_company_id ? Number(d.courier_company_id) : null],
    );
    await addHistory(null, orderId, order.fulfillment_status, `Courier booked: ${updated.courier_name || 'courier'} · AWB ${awb}`, 'admin', false);
    return updated;
  }

  if (action === 'label') {
    if (!order.awb_code) throw badRequest('Book the courier (AWB) first.', 'no_awb');
    let res;
    try {
      res = await generateLabel(order.shiprocket_shipment_id);
    } catch (e) {
      return fail(orderId, e);
    }
    const url = res?.label_url;
    if (!url) return fail(orderId, new Error(res?.response || res?.message || 'Shiprocket did not return a label'));
    return one(
      'UPDATE orders SET label_url = $2, shiprocket_error = NULL, updated_at = now() WHERE id = $1 RETURNING *',
      [orderId, url],
    );
  }

  if (action === 'pickup') {
    if (!order.awb_code) throw badRequest('Book the courier (AWB) first.', 'no_awb');
    let scheduledAt = null;
    try {
      const res = await schedulePickup(order.shiprocket_shipment_id);
      const raw = res?.response?.pickup_scheduled_date;
      const parsed = raw ? new Date(String(raw).replace(' ', 'T') + '+05:30') : null;
      scheduledAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    } catch (e) {
      // "Already in Pickup Queue" means it is scheduled — record it rather than failing.
      if (/already/i.test(e?.message || '')) scheduledAt = new Date().toISOString();
      else return fail(orderId, e);
    }
    const updated = await one(
      'UPDATE orders SET pickup_scheduled_at = $2, shiprocket_error = NULL, updated_at = now() WHERE id = $1 RETURNING *',
      [orderId, scheduledAt],
    );
    await addHistory(null, orderId, order.fulfillment_status, 'Pickup scheduled with courier', 'admin', false);
    return updated;
  }

  throw badRequest('Unknown action', 'bad_action');
}
