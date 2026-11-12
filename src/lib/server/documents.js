import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { many, one } from './db';
import { getSettings } from './settings';
import { PAYMENT_LABELS } from '../orderRules';

// Invoices and packing slips with pdf-lib's built-in Helvetica (WinAnsi). The ₹ glyph is not in
// WinAnsi, so amounts are written as "Rs. 1,299"; any other unsupported character becomes "?".

const A4 = [595.28, 841.89];
const MARGIN = 40;
const INK = rgb(0.13, 0.11, 0.1);
const MUTED = rgb(0.42, 0.39, 0.36);
const LINE = rgb(0.85, 0.83, 0.8);
const BRAND = rgb(0.74, 0.41, 0.13);

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (n) => `Rs. ${nf.format(Math.round(Number(n) || 0))}`;
const rs2 = (n) => `Rs. ${nf2.format(Number(n) || 0)}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

async function loadOrder(orderId) {
  const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return null;
  order.items = await many('SELECT * FROM order_items WHERE order_id = $1 ORDER BY name, variant_name', [orderId]);
  return order;
}

/** Small drawing helper bound to one document (handles fonts, WinAnsi sanitising, wrapping, pages). */
async function createWriter() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());

  const clean = (s) =>
    Array.from(String(s ?? '').replace(/₹\s?/g, 'Rs. ').replace(/[\r\t]/g, ' '))
      .map((ch) => {
        const cp = ch.codePointAt(0);
        if (ch === '\n' || charset.has(cp)) return ch;
        // Emoji, joiners and variation selectors are dropped; other scripts show as "?".
        return cp > 0xffff || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f) ? '' : '?';
      })
      .join('');

  const w = {
    doc,
    font,
    bold,
    page: null,
    y: 0,
    clean,
    newPage() {
      w.page = doc.addPage(A4);
      w.y = A4[1] - MARGIN;
      return w.page;
    },
    width(text, size = 10, f = font) {
      return f.widthOfTextAtSize(clean(text), size);
    },
    text(text, x, y, { size = 10, f = font, color = INK } = {}) {
      w.page.drawText(clean(text), { x, y, size, font: f, color });
    },
    right(text, xRight, y, opts = {}) {
      w.text(text, xRight - w.width(text, opts.size || 10, opts.f || font), y, opts);
    },
    /** Split text into lines no wider than maxWidth. */
    wrap(text, maxWidth, size = 10, f = font) {
      const out = [];
      for (const para of clean(text).split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const next = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(next, size) <= maxWidth) {
            line = next;
          } else {
            if (line) out.push(line);
            // Hard-break very long words.
            let rest = word;
            while (f.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
              let cut = rest.length - 1;
              while (cut > 1 && f.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
              out.push(rest.slice(0, cut));
              rest = rest.slice(cut);
            }
            line = rest;
          }
        }
        out.push(line);
      }
      return out;
    },
    /** Draw wrapped lines going down from (x, w.y); advances w.y. */
    para(text, x, maxWidth, { size = 10, f = font, color = INK, gap = 3 } = {}) {
      for (const l of w.wrap(text, maxWidth, size, f)) {
        w.ensure(size + gap);
        w.page.drawText(l, { x, y: w.y - size, size, font: f, color });
        w.y -= size + gap;
      }
    },
    hr(y = w.y, x1 = MARGIN, x2 = A4[0] - MARGIN, color = LINE) {
      w.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.7, color });
    },
    /** Start a new page when fewer than `h` points remain. Returns true if it did. */
    ensure(h, onNewPage) {
      if (w.y - h < MARGIN + 20) {
        w.newPage();
        onNewPage?.();
        return true;
      }
      return false;
    },
  };
  return w;
}

function addressLines(a = {}) {
  return [
    a.name,
    a.line1,
    a.line2,
    a.landmark ? `Landmark: ${a.landmark}` : '',
    [a.city, a.state].filter(Boolean).join(', ') + (a.pincode ? ` - ${a.pincode}` : ''),
    a.phone ? `Phone: ${a.phone}` : '',
  ].filter(Boolean);
}

const paymentMethodLabel = (m) => (m === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)');

// ================================ Invoice ==================================

/** Tax invoice for one order. @returns {Promise<Uint8Array>} */
export async function generateInvoicePdf(orderId) {
  const order = await loadOrder(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  const { store } = await getSettings();
  const w = await createWriter();
  w.doc.setTitle(`Invoice ${order.order_number}`);
  w.doc.setAuthor(store.legalName || store.name);
  w.newPage();
  const right = A4[0] - MARGIN;
  const contentW = right - MARGIN;

  // ---- Header: seller (left), invoice meta (right) ----
  const top = w.y;
  w.text(store.legalName || store.name, MARGIN, top - 18, { size: 18, f: w.bold, color: BRAND });
  w.y = top - 26;
  if (store.legalName && store.legalName !== store.name) w.para(`Trading as ${store.name}`, MARGIN, 300, { size: 9, color: MUTED });
  if (store.address) w.para(store.address, MARGIN, 300, { size: 9, color: MUTED });
  const contact = [store.supportEmail, store.supportPhone].filter(Boolean).join(' · ');
  if (contact) w.para(contact, MARGIN, 300, { size: 9, color: MUTED });
  if (store.gstin) w.para(`GSTIN: ${store.gstin}`, MARGIN, 300, { size: 9, f: w.bold });
  const leftBottom = w.y;

  w.right('TAX INVOICE', right, top - 18, { size: 16, f: w.bold });
  w.right(`Invoice no: ${order.order_number}`, right, top - 36, { size: 10 });
  w.right(`Order date: ${fmtDate(order.created_at)}`, right, top - 50, { size: 10 });
  if (order.paid_at) w.right(`Paid on: ${fmtDate(order.paid_at)}`, right, top - 64, { size: 10 });
  w.y = Math.min(leftBottom, top - 72) - 10;
  w.hr();
  w.y -= 14;

  // ---- Bill to / Ship to ----
  const a = order.shipping_address || {};
  const colW = contentW / 2 - 10;
  const blockTop = w.y;
  w.text('BILL TO', MARGIN, blockTop - 9, { size: 8, f: w.bold, color: MUTED });
  w.text('SHIP TO', MARGIN + contentW / 2, blockTop - 9, { size: 8, f: w.bold, color: MUTED });
  w.y = blockTop - 14;
  const bill = [order.name, order.email, `Phone: ${order.phone}`];
  for (const l of bill) w.para(l, MARGIN, colW, { size: 10 });
  const billBottom = w.y;
  w.y = blockTop - 14;
  for (const l of addressLines(a)) w.para(l, MARGIN + contentW / 2, colW, { size: 10 });
  if (a.state) w.para(`Place of supply: ${a.state}`, MARGIN + contentW / 2, colW, { size: 9, color: MUTED });
  w.y = Math.min(billBottom, w.y) - 12;

  // ---- Items table ----
  const cols = [
    { key: 'item', label: 'Item', x: MARGIN, w: 190 },
    { key: 'hsn', label: 'HSN', x: MARGIN + 196, w: 50 },
    { key: 'qty', label: 'Qty', x: MARGIN + 250, w: 30, align: 'right' },
    { key: 'unit', label: 'Unit price', x: MARGIN + 284, w: 64, align: 'right' },
    { key: 'gst', label: 'GST incl.', x: MARGIN + 352, w: 90, align: 'right' },
    { key: 'total', label: 'Amount', x: MARGIN + 446, w: contentW - 446, align: 'right' },
  ];
  const drawHeader = () => {
    w.page.drawRectangle({ x: MARGIN, y: w.y - 18, width: contentW, height: 18, color: rgb(0.96, 0.94, 0.91) });
    for (const c of cols) {
      if (c.align === 'right') w.right(c.label, c.x + c.w, w.y - 12.5, { size: 8.5, f: w.bold });
      else w.text(c.label, c.x + (c === cols[0] ? 4 : 0), w.y - 12.5, { size: 8.5, f: w.bold });
    }
    w.y -= 24;
  };
  drawHeader();

  let taxTotal = 0;
  for (const it of order.items) {
    const rate = Number(it.tax_rate) || 0;
    const tax = rate > 0 ? (it.line_total * rate) / (100 + rate) : 0;
    taxTotal += tax;
    const nameLines = w.wrap(it.variant_name ? `${it.name} (${it.variant_name})` : it.name, cols[0].w - 4, 9.5);
    if (it.sku) nameLines.push(`SKU: ${it.sku}`);
    const rowH = Math.max(nameLines.length, 2) * 12 + 6;
    w.ensure(rowH, drawHeader);
    const y0 = w.y - 9.5;
    nameLines.forEach((l, i) => w.text(l, cols[0].x + 4, y0 - i * 12, { size: i === nameLines.length - 1 && it.sku ? 8 : 9.5, color: i === nameLines.length - 1 && it.sku ? MUTED : INK }));
    w.text(it.hsn_code || '-', cols[1].x, y0, { size: 9.5 });
    w.right(String(it.quantity), cols[2].x + cols[2].w, y0, { size: 9.5 });
    w.right(rs(it.price), cols[3].x + cols[3].w, y0, { size: 9.5 });
    w.right(rate > 0 ? rs2(tax) : '-', cols[4].x + cols[4].w, y0, { size: 9.5 });
    if (rate > 0) w.right(`@ ${nf2.format(rate).replace(/\.00$/, '')}%`, cols[4].x + cols[4].w, y0 - 12, { size: 8, color: MUTED });
    w.right(rs(it.line_total), cols[5].x + cols[5].w, y0, { size: 9.5, f: w.bold });
    w.y -= rowH;
    w.hr(w.y + 3);
  }

  // ---- Totals ----
  const rows = [['Items total', rs(order.items_total)]];
  if (order.discount) rows.push([`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, `- ${rs(order.discount)}`]);
  rows.push(['Shipping', order.shipping_fee ? rs(order.shipping_fee) : 'Free']);
  if (order.cod_fee) rows.push(['COD fee', rs(order.cod_fee)]);
  if (order.gift_wrap_fee) rows.push(['Gift wrap', rs(order.gift_wrap_fee)]);
  w.ensure(rows.length * 15 + 70);
  w.y -= 6;
  const labelX = right - 230;
  for (const [label, value] of rows) {
    w.text(label, labelX, w.y - 10, { size: 10, color: MUTED });
    w.right(value, right, w.y - 10, { size: 10 });
    w.y -= 15;
  }
  w.hr(w.y - 2, labelX, right, INK);
  w.y -= 8;
  w.text('Grand total', labelX, w.y - 12, { size: 12, f: w.bold });
  w.right(rs(order.total), right, w.y - 12, { size: 12, f: w.bold });
  w.y -= 20;
  w.text('GST included in item prices', labelX, w.y - 9, { size: 8.5, color: MUTED });
  w.right(rs2(taxTotal), right, w.y - 9, { size: 8.5, color: MUTED });
  w.y -= 26;

  // ---- Payment ----
  w.ensure(60);
  w.hr();
  w.y -= 14;
  w.text('PAYMENT', MARGIN, w.y - 9, { size: 8, f: w.bold, color: MUTED });
  w.y -= 14;
  w.para(`Method: ${paymentMethodLabel(order.payment_method)}`, MARGIN, contentW, { size: 10 });
  w.para(`Status: ${PAYMENT_LABELS[order.payment_status] || order.payment_status}`, MARGIN, contentW, { size: 10 });
  if (order.razorpay_payment_id && order.razorpay_payment_id !== 'manual') {
    w.para(`Payment ID: ${order.razorpay_payment_id}`, MARGIN, contentW, { size: 9, color: MUTED });
  }
  if (order.fulfillment_status === 'cancelled') {
    w.y -= 4;
    w.para('This order was cancelled.', MARGIN, contentW, { size: 10, f: w.bold, color: rgb(0.7, 0.15, 0.1) });
  }

  w.y -= 18;
  w.para('All prices are inclusive of GST. This is a computer-generated invoice and does not require a signature.', MARGIN, contentW, {
    size: 8.5,
    color: MUTED,
  });
  w.para(`Thank you for shopping with ${store.name}!`, MARGIN, contentW, { size: 9, f: w.bold, color: BRAND });

  return w.doc.save();
}

// ============================= Packing slips ===============================

/** One page per order (prices omitted for gift orders). @returns {Promise<Uint8Array>} */
export async function generatePackingSlipsPdf(orderIds) {
  const ids = [...new Set((orderIds || []).filter(Boolean))];
  const { store } = await getSettings();
  const orders = ids.length ? await many('SELECT * FROM orders WHERE id = ANY($1::uuid[])', [ids]) : [];
  const items = ids.length
    ? await many('SELECT * FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY name, variant_name', [ids])
    : [];
  const byId = new Map(orders.map((o) => [o.id, { ...o, items: [] }]));
  for (const i of items) byId.get(i.order_id)?.items.push(i);

  const w = await createWriter();
  w.doc.setTitle(`Packing slips (${byId.size})`);
  const right = A4[0] - MARGIN;
  const contentW = right - MARGIN;

  for (const id of ids) {
    const order = byId.get(id);
    if (!order) continue;
    const showPrices = !order.is_gift;
    w.newPage();
    const top = w.y;
    w.text(store.name, MARGIN, top - 16, { size: 15, f: w.bold, color: BRAND });
    w.text('PACKING SLIP', MARGIN, top - 32, { size: 9, f: w.bold, color: MUTED });
    w.right(order.order_number, right, top - 18, { size: 20, f: w.bold });
    w.right(fmtDate(order.created_at), right, top - 34, { size: 10, color: MUTED });
    w.y = top - 46;
    w.hr();
    w.y -= 14;

    // Ship to + courier.
    const blockTop = w.y;
    w.text('SHIP TO', MARGIN, blockTop - 9, { size: 8, f: w.bold, color: MUTED });
    w.y = blockTop - 16;
    const a = order.shipping_address || {};
    const lines = addressLines({ ...a, phone: null });
    lines.forEach((l, i) => w.para(l, MARGIN, contentW / 2 + 20, { size: i === 0 ? 13 : 12, f: i === 0 ? w.bold : w.font, gap: 4 }));
    w.para(`Phone: ${a.phone || order.phone}`, MARGIN, contentW / 2 + 20, { size: 12, f: w.bold, gap: 4 });
    const leftBottom = w.y;

    const cx = MARGIN + contentW / 2 + 40;
    w.y = blockTop;
    w.text('SHIPPING', cx, blockTop - 9, { size: 8, f: w.bold, color: MUTED });
    w.y = blockTop - 16;
    const cw = right - cx;
    w.para(order.payment_method === 'cod' ? `COD - collect ${rs(order.total)}` : 'Prepaid', cx, cw, { size: 12, f: w.bold });
    if (order.courier_name) w.para(`Courier: ${order.courier_name}`, cx, cw, { size: 10 });
    if (order.awb_code) w.para(`AWB: ${order.awb_code}`, cx, cw, { size: 11, f: w.bold });
    if (order.shipping_option?.label) w.para(`Service: ${order.shipping_option.label}`, cx, cw, { size: 9, color: MUTED });
    w.y = Math.min(leftBottom, w.y) - 14;

    // Gift + notes go above the items so the packer sees them first.
    if (order.is_gift) {
      w.ensure(80);
      const boxTop = w.y;
      w.text(order.gift_wrap ? 'GIFT - PLEASE GIFT WRAP. NO PRICES IN PARCEL.' : 'GIFT ORDER - NO PRICES IN PARCEL.', MARGIN + 10, w.y - 14, {
        size: 10,
        f: w.bold,
        color: BRAND,
      });
      w.y -= 22;
      if (order.gift_message) {
        w.para('Gift message:', MARGIN + 10, contentW - 20, { size: 9, color: MUTED });
        w.para(`"${order.gift_message}"`, MARGIN + 10, contentW - 20, { size: 12, f: w.bold, gap: 4 });
      }
      w.y -= 8;
      w.page.drawRectangle({ x: MARGIN, y: w.y, width: contentW, height: boxTop - w.y, borderColor: BRAND, borderWidth: 1 });
      w.y -= 14;
    }
    if (order.customer_note) {
      w.ensure(40);
      w.para('Customer note:', MARGIN, contentW, { size: 9, color: MUTED });
      w.para(order.customer_note, MARGIN, contentW, { size: 10.5 });
      w.y -= 8;
    }

    // Items.
    const itemColW = showPrices ? contentW - 160 : contentW - 60;
    const drawHeader = () => {
      w.page.drawRectangle({ x: MARGIN, y: w.y - 18, width: contentW, height: 18, color: rgb(0.96, 0.94, 0.91) });
      w.text('Item', MARGIN + 26, w.y - 12.5, { size: 9, f: w.bold });
      w.right('Qty', MARGIN + itemColW + 50, w.y - 12.5, { size: 9, f: w.bold });
      if (showPrices) {
        w.right('Price', right - 70, w.y - 12.5, { size: 9, f: w.bold });
        w.right('Amount', right, w.y - 12.5, { size: 9, f: w.bold });
      }
      w.y -= 24;
    };
    drawHeader();
    let units = 0;
    for (const it of order.items) {
      units += it.quantity;
      const nameLines = w.wrap(it.variant_name ? `${it.name} - ${it.variant_name}` : it.name, itemColW - 30, 11);
      if (it.sku) nameLines.push(`SKU: ${it.sku}`);
      const rowH = nameLines.length * 14 + 8;
      w.ensure(rowH, drawHeader);
      const y0 = w.y - 11;
      // Tick box for the packer.
      w.page.drawRectangle({ x: MARGIN + 4, y: y0 - 2, width: 11, height: 11, borderColor: INK, borderWidth: 0.8 });
      nameLines.forEach((l, i) => {
        const sku = it.sku && i === nameLines.length - 1;
        w.text(l, MARGIN + 26, y0 - i * 14, { size: sku ? 8.5 : 11, color: sku ? MUTED : INK });
      });
      w.right(`x ${it.quantity}`, MARGIN + itemColW + 50, y0, { size: 12, f: w.bold });
      if (showPrices) {
        w.right(rs(it.price), right - 70, y0, { size: 10 });
        w.right(rs(it.line_total), right, y0, { size: 10 });
      }
      w.y -= rowH;
      w.hr(w.y + 4);
    }
    w.y -= 6;
    w.text(`${order.items.length} line${order.items.length === 1 ? '' : 's'} · ${units} unit${units === 1 ? '' : 's'}`, MARGIN, w.y - 10, {
      size: 10,
      f: w.bold,
    });
    if (showPrices) w.right(`Order total: ${rs(order.total)}`, right, w.y - 10, { size: 11, f: w.bold });
  }

  if (!w.page) {
    w.newPage();
    w.text('No orders found.', MARGIN, w.y - 20, { size: 12 });
  }
  return w.doc.save();
}
