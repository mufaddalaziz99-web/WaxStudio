// Shipping rules shared by browser and server.
export function qualifiesForFreeShipping(itemsTotal, threshold) {
  return Number(threshold) > 0 && itemsTotal >= Number(threshold);
}

export function amountToFreeShipping(itemsTotal, threshold) {
  if (!threshold || threshold <= 0) return null;
  return Math.max(0, threshold - itemsTotal);
}

export function codFeeFor(itemsTotalAfterDiscount, payments) {
  if (!payments?.codEnabled) return 0;
  if (payments.codFreeAbove && itemsTotalAfterDiscount >= payments.codFreeAbove) return 0;
  return Number(payments.codFee) || 0;
}

export function isCodAllowed(orderTotal, payments) {
  if (!payments?.codEnabled) return false;
  if (payments.codMaxOrder && orderTotal > payments.codMaxOrder) return false;
  return true;
}
