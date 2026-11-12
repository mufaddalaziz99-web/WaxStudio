import 'server-only';
import { many, one, query } from './db';
import { env } from './env';
import { escapeHtml, layout, sendEmail } from './mailer';
import { getSettings } from './settings';
import { formatINR } from '../rules';

// Each email is "claimed" once through an *_emailed_at column so it is never sent twice.
// If sending fails the claim is released so a later run (cron) can retry.
async function claim(orderId, column) {
  const row = await one(`UPDATE orders SET ${column} = now() WHERE id = $1 AND ${column} IS NULL RETURNING id`, [orderId]);
  return Boolean(row);
}
async function unclaim(orderId, column) {
  await query(`UPDATE orders SET ${column} = NULL WHERE id = $1`, [orderId]);
}
async function withClaim(orderId, column, send) {
  if (!(await claim(orderId, column))) return false;
  try {
    await send();
    return true;
  } catch (e) {
    await unclaim(orderId, column);
    throw e;
  }
}

async function loadOrder(orderId) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return null;
  order.items = await many('SELECT * FROM order_items WHERE order_id = $1 ORDER BY name', [orderId]);
  return order;
}

const orderUrl = (o) => `${env.siteUrl}/order-confirmation/${o.id}`;

function itemsTable(order) {
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0">${escapeHtml(i.name)}${i.variant_name ? ` <span style="color:#7a706a">(${escapeHtml(i.variant_name)})</span>` : ''} × ${i.quantity}</td><td align="right">${formatINR(i.line_total)}</td></tr>`)
    .join('');
  const line = (label, value) => `<tr><td style="padding:4px 0;color:#4a423c">${label}</td><td align="right" style="color:#4a423c">${value}</td></tr>`;
  return `<table width="100%" style="font-size:14px;border-collapse:collapse">${rows}
<tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px"></td></tr>
${line('Items', formatINR(order.items_total))}
${order.discount ? line(`Discount${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ''}`, `−${formatINR(order.discount)}`) : ''}
${line('Shipping', order.shipping_fee ? formatINR(order.shipping_fee) : 'Free')}
${order.cod_fee ? line('COD fee', formatINR(order.cod_fee)) : ''}
${order.gift_wrap_fee ? line('Gift wrap', formatINR(order.gift_wrap_fee)) : ''}
<tr><td style="padding-top:8px;font-weight:bold">Total</td><td align="right" style="padding-top:8px;font-weight:bold">${formatINR(order.total)}</td></tr></table>`;
}

function addressBlock(a) {
  return `<p style="font-size:14px;color:#4a423c;line-height:1.5">${escapeHtml(a.name)}<br>${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ''}<br>${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)}<br>${escapeHtml(a.phone)}</p>`;
}

export async function sendOrderConfirmationEmails(orderId) {
  const order = await loadOrder(orderId);
  if (!order || order.fulfillment_status === 'cancelled') return;
  const settings = await getSettings();
  const payLine = order.payment_method === 'cod'
    ? `<p>Please keep <b>${formatINR(order.total)}</b> ready to pay on delivery.</p>`
    : '<p>We have received your payment.</p>';

  await withClaim(order.id, 'customer_emailed_at', async () => {
    await sendEmail({
      to: order.email,
      subject: `Order confirmed · ${order.order_number}`,
      html: await layout({
        title: `Thank you, ${order.name.split(' ')[0]}!`,
        preheader: `Your order ${order.order_number} is confirmed.`,
        body: `<p>Your order <b>${order.order_number}</b> is confirmed. We will let you know when it ships.</p>${payLine}${itemsTable(order)}<h3 style="font-size:15px;margin-top:24px">Delivering to</h3>${addressBlock(order.shipping_address)}`,
        cta: { href: orderUrl(order), label: 'View your order' },
      }),
    });
  });

  const shopTo = process.env.SHOP_NOTIFY_EMAIL || settings.store.supportEmail;
  await withClaim(order.id, 'shop_emailed_at', async () => {
    await sendEmail({
      to: shopTo,
      subject: `New order ${order.order_number} · ${formatINR(order.total)} · ${order.payment_method === 'cod' ? 'COD' : 'Paid'}`,
      html: await layout({
        title: `New order ${order.order_number}`,
        body: `<p>${escapeHtml(order.name)} · ${escapeHtml(order.phone)} · ${escapeHtml(order.email)}</p>${order.is_gift ? `<p>🎁 Gift${order.gift_wrap ? ' (wrap)' : ''}: ${escapeHtml(order.gift_message || '')}</p>` : ''}${itemsTable(order)}${addressBlock(order.shipping_address)}`,
        cta: { href: `${env.siteUrl}/admin/orders/${order.id}`, label: 'Open in admin' },
      }),
    });
  });
}

export async function sendCancellationEmail(orderId) {
  const order = await loadOrder(orderId);
  if (!order) return;
  await withClaim(order.id, 'cancel_emailed_at', async () => {
    const refundLine = order.payment_status === 'paid' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded'
      ? '<p>Your refund has been initiated and should reach your original payment method in 5–7 working days.</p>'
      : '';
    await sendEmail({
      to: order.email,
      subject: `Order ${order.order_number} cancelled`,
      html: await layout({
        title: 'Your order has been cancelled',
        body: `<p>Order <b>${order.order_number}</b> has been cancelled${order.cancel_reason ? `: ${escapeHtml(order.cancel_reason)}` : ''}.</p>${refundLine}${itemsTable(order)}`,
        cta: { href: orderUrl(order), label: 'View order' },
      }),
    });
  });
}

export async function sendPaymentFailedEmail(orderId) {
  const order = await loadOrder(orderId);
  if (!order || order.payment_status === 'paid') return;
  await withClaim(order.id, 'payment_failed_emailed_at', async () => {
    await sendEmail({
      to: order.email,
      subject: `Your payment didn't go through · ${order.order_number}`,
      html: await layout({
        title: "Your payment didn't go through",
        body: `<p>We held your items for 15 minutes but didn't receive the payment for order <b>${order.order_number}</b>, so it has been released. No money was taken — if any amount was debited it will be refunded automatically by your bank.</p><p>Your items may still be available:</p>${itemsTable(order)}`,
        cta: { href: `${env.siteUrl}/cart`, label: 'Try again' },
      }),
    });
  });
}

export async function sendShippedEmail(orderId) {
  const order = await loadOrder(orderId);
  if (!order) return;
  await withClaim(order.id, 'shipped_emailed_at', async () => {
    await sendEmail({
      to: order.email,
      subject: `Your order ${order.order_number} has shipped`,
      html: await layout({
        title: 'Your order is on its way!',
        body: `<p>Order <b>${order.order_number}</b> has shipped${order.courier_name ? ` with ${escapeHtml(order.courier_name)}` : ''}.</p>${order.awb_code ? `<p>Tracking number (AWB): <b>${escapeHtml(order.awb_code)}</b></p>` : ''}`,
        cta: { href: order.tracking_url || orderUrl(order), label: 'Track your parcel' },
      }),
    });
  });
}

export async function sendReviewRequestEmail(orderId) {
  const order = await loadOrder(orderId);
  if (!order) return false;
  const row = await one(`UPDATE orders SET review_requested_at = now() WHERE id = $1 AND review_requested_at IS NULL RETURNING id`, [orderId]);
  if (!row) return false;
  const first = order.items[0];
  const slug = first?.product_id ? (await one('SELECT slug FROM products WHERE id = $1', [first.product_id]))?.slug : null;
  try {
    await sendEmail({
      to: order.email,
      subject: 'How did you like your order?',
      html: await layout({
        title: `How was it, ${order.name.split(' ')[0]}?`,
        body: `<p>Your order <b>${order.order_number}</b> was delivered a few days ago. A quick review helps other shoppers — and helps us improve.</p>`,
        cta: { href: `${env.siteUrl}/review/${order.review_token}${slug ? `?product=${slug}` : ''}`, label: 'Write a review' },
      }),
    });
    return true;
  } catch (e) {
    await query('UPDATE orders SET review_requested_at = NULL WHERE id = $1', [orderId]);
    throw e;
  }
}

export async function sendVerificationCodeEmail(email, code, purpose = 'verify') {
  const isReset = purpose === 'reset';
  await sendEmail({
    to: email,
    subject: isReset ? `Your password reset code: ${code}` : `Your verification code: ${code}`,
    html: await layout({
      title: isReset ? 'Reset your password' : 'Verify your email',
      body: `<p>Use this code to ${isReset ? 'reset your password' : 'verify your email'}. It expires in 15 minutes.</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:20px 0">${code}</p><p style="color:#7a706a;font-size:13px">If you didn't request this, you can ignore this email.</p>`,
    }),
  });
}

export async function sendBackInStockEmail({ email, productName, slug }) {
  await sendEmail({
    to: email,
    subject: `${productName} is back in stock`,
    html: await layout({
      title: "It's back!",
      body: `<p><b>${escapeHtml(productName)}</b> is back in stock. Stock is limited — grab yours before it sells out again.</p>`,
      cta: { href: `${env.siteUrl}/product/${slug}`, label: 'Shop now' },
    }),
  });
}

export async function sendContactNotification(msg) {
  const s = await getSettings();
  await sendEmail({
    to: process.env.SHOP_NOTIFY_EMAIL || s.store.supportEmail,
    replyTo: msg.email,
    subject: `Contact form: ${msg.name}`,
    html: await layout({
      title: 'New contact message',
      body: `<p><b>${escapeHtml(msg.name)}</b> · ${escapeHtml(msg.email)} · ${escapeHtml(msg.phone || '')}</p><p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>`,
    }),
  });
}
