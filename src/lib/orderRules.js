// Order status rules shared by browser and server.
export const FULFILLMENT_STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export const STATUS_LABELS = {
  placed: 'Awaiting payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};

export const CUSTOMER_CANCELLABLE = ['confirmed', 'packed'];
export const ADMIN_CANCELLABLE = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'];

export const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Delivery is taking too long',
  'Want to change address or items',
  'Other',
];

export const ISSUE_TYPES = {
  damaged: 'Item arrived damaged',
  wrong_item: 'Received the wrong item',
  missing_item: 'Item missing from parcel',
  quality: 'Quality problem',
  other: 'Something else',
};
export const ISSUE_REPORT_DAYS = 7; // days after delivery a problem can be reported

export function stepIndex(status) {
  return FULFILLMENT_STEPS.indexOf(status);
}

/** Forward-only: true if moving from `from` to `to` is a step forward. */
export function isForward(from, to) {
  const a = stepIndex(from);
  const b = stepIndex(to);
  return a >= 0 && b > a;
}

export function canCustomerCancel(order) {
  return CUSTOMER_CANCELLABLE.includes(order.fulfillment_status);
}
