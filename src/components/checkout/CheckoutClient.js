'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCartSync } from '@/hooks/useCartSync';
import { useRazorpayCheckout } from '@/hooks/useRazorpayCheckout';
import { api } from '@/lib/client/api';
import { ecommerce, track } from '@/lib/client/analytics';
import { addressSchema } from '@/lib/validation';
import { GIFT_MESSAGE_MAX, INDIAN_STATES, PINCODE_RE, formatINR } from '@/lib/rules';
import { codFeeFor, isCodAllowed } from '@/lib/shippingRules';
import OrderSummary, { Totals } from './OrderSummary';
import AddressSearch from './AddressSearch';

const STEPS = ['Address', 'Shipping', 'Pay'];
const EMPTY_ADDRESS = { name: '', phone: '', email: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };
const REQ_KEY = 'checkout_request';
const ADDR_KEY = 'checkout_address';

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

/**
 * Idempotency key for order placement, tied to the cart contents: a double-click, retry or
 * reload reuses it (same order); a changed cart gets a new one.
 */
function requestIdFor(cartHash, fresh = false) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REQ_KEY) || 'null');
    if (!fresh && saved?.hash === cartHash && saved.id) return saved.id;
    const id = uuid();
    sessionStorage.setItem(REQ_KEY, JSON.stringify({ hash: cartHash, id }));
    return id;
  } catch {
    return uuid();
  }
}

export default function CheckoutClient() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const cart = useCart();
  const { synced } = useCartSync();
  const { pay, preload } = useRazorpayCheckout();

  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});
  const [saveAddress, setSaveAddress] = useState(true);
  const [quote, setQuote] = useState({ loading: false, data: null, error: null });
  const [optionId, setOptionId] = useState(null);
  const [gift, setGift] = useState({ isGift: false, wrap: false, message: '' });
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [method, setMethod] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState('');
  const began = useRef(false);
  const lastQuoteKey = useRef('');

  const cartHash = useMemo(
    () => cart.items.map((l) => `${l.productId}:${l.variantId || ''}:${l.quantity}`).sort().join('|'),
    [cart.items],
  );
  const itemsPayload = useMemo(
    () => cart.items.map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity })),
    [cart.items],
  );

  // Load config + prefill.
  useEffect(() => {
    api('/api/checkout/config').then(setConfig).catch(() => setConfig({ razorpayEnabled: false, codEnabled: true, settings: null, addresses: [] }));
    try {
      const saved = JSON.parse(sessionStorage.getItem(ADDR_KEY) || 'null');
      if (saved) setAddress((a) => ({ ...a, ...saved }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!config) return;
    const def = config.addresses?.find((a) => a.is_default) || config.addresses?.[0];
    setAddress((a) => {
      if (a.line1) return a;
      if (def) return { ...EMPTY_ADDRESS, ...def, email: def.email || config.user?.email || '', line2: def.line2 || '', landmark: def.landmark || '' };
      return { ...a, name: a.name || config.user?.name || '', email: a.email || config.user?.email || '', phone: a.phone || config.user?.phone || '' };
    });
    if (config.razorpayEnabled) preload();
  }, [config, preload]);

  // begin_checkout once, when the page loads with items.
  useEffect(() => {
    if (began.current || !cart.hydrated || !cart.items.length) return;
    began.current = true;
    ecommerce('begin_checkout', cart.items);
  }, [cart.hydrated, cart.items]);

  const settings = config?.settings;
  const options = quote.data?.options || [];
  const option = options.find((o) => o.id === optionId) || null;
  const itemsTotal = quote.data?.itemsTotal ?? cart.subtotal;
  const discount = coupon ? Math.min(coupon.discount, itemsTotal) : 0;
  const giftWrapFee = gift.isGift && gift.wrap ? Number(settings?.checkout?.giftWrapFee) || 0 : 0;
  const preCodTotal = itemsTotal - discount + (option?.price || 0) + giftWrapFee;
  const codAvailable = Boolean(config?.codEnabled && option?.cod && settings && isCodAllowed(preCodTotal + codFeeFor(itemsTotal - discount, settings.payments), settings.payments));
  const codFee = method === 'cod' && step === 2 && settings ? codFeeFor(itemsTotal - discount, settings.payments) : 0;
  const total = preCodTotal + codFee;
  const totals = { itemsTotal, discount, couponCode: coupon?.code, shipping: option ? option.price : null, codFee, giftWrapFee, total };
  const holiday = settings?.checkout?.holidayMode;

  // Default / fix payment method when availability changes.
  useEffect(() => {
    if (!config) return;
    const available = [config.razorpayEnabled && 'razorpay', codAvailable && 'cod'].filter(Boolean);
    if (!available.includes(method)) setMethod(available[0] || null);
  }, [config, codAvailable, method]);

  // ---- Shipping quote ----
  const fetchQuote = useCallback(async (pincode) => {
    const key = `${pincode}|${cartHash}`;
    lastQuoteKey.current = key;
    setQuote((q) => ({ ...q, loading: true, error: null }));
    try {
      const data = await api('/api/shipping/quote', { method: 'POST', body: { pincode, items: itemsPayload } });
      if (lastQuoteKey.current !== key) return;
      setQuote({ loading: false, data, error: null });
      track('shipping_quote', { source: data.source, options: data.options.length, unserviceable: !data.serviceable });
      setOptionId((cur) => (data.options.some((o) => o.id === cur) ? cur : data.options[0]?.id || null));
    } catch (e) {
      if (lastQuoteKey.current !== key) return;
      setQuote({ loading: false, data: null, error: e.message });
    }
  }, [cartHash, itemsPayload]);

  // Re-quote when the cart changes after step 1.
  useEffect(() => {
    if (step >= 1 && PINCODE_RE.test(address.pincode) && cart.items.length) fetchQuote(address.pincode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartHash]);

  // ---- Coupon: re-checked automatically when subtotal, email or phone changes ----
  const checkCoupon = useCallback(async (code, { silent = false } = {}) => {
    if (!code) return;
    setCouponError('');
    try {
      const { coupon: c } = await api('/api/coupons/check', { method: 'POST', body: { code, itemsTotal, email: address.email, phone: address.phone } });
      setCoupon(c);
      if (!silent) toast.success(`Coupon ${c.code} applied — you save ${formatINR(c.discount)}`);
    } catch (e) {
      setCoupon(null);
      setCouponError(e.message);
    }
  }, [itemsTotal, address.email, address.phone, toast]);

  useEffect(() => {
    if (coupon) checkCoupon(coupon.code, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsTotal, address.email, address.phone]);

  // ---- Pincode autofill ----
  const onPincode = async (pin) => {
    setAddress((a) => ({ ...a, pincode: pin }));
    if (!PINCODE_RE.test(pin) || !config?.pincodeLookup) return;
    try {
      const r = await api(`/api/address/pincode?pincode=${pin}`);
      if (r.city || r.state) {
        setAddress((a) => ({ ...a, city: a.city || r.city || '', state: INDIAN_STATES.find((s) => s.toLowerCase() === String(r.state || '').toLowerCase()) || a.state || r.state || '' }));
      }
    } catch {}
  };

  // ---- Step 1 submit ----
  const submitAddress = (e) => {
    e.preventDefault();
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) {
      const errs = {};
      for (const i of parsed.error.issues) errs[i.path[0]] ??= i.message;
      setErrors(errs);
      track('checkout_address_error', { fields: Object.keys(errs).join(',') });
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setAddress(parsed.data);
    try { sessionStorage.setItem(ADDR_KEY, JSON.stringify(parsed.data)); } catch {}
    track('checkout_address');
    fetchQuote(parsed.data.pincode); // start loading so step 2 opens already loading
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chooseOption = (id) => {
    setOptionId(id);
    const o = options.find((x) => x.id === id);
    ecommerce('add_shipping_info', cart.items, { shipping_tier: o?.label });
  };

  // ---- Place order ----
  const placeOrder = async ({ retried = false } = {}) => {
    if (!option || !method || placing) return;
    setPlacing(true);
    setNotice('');
    ecommerce('add_payment_info', cart.items, { payment_type: method === 'cod' ? 'cod' : 'online', value: total });
    // Any change to what is being ordered gets a new key; a retry of the same choices reuses the order.
    const choiceHash = [cartHash, method, coupon?.code || '', option.id, JSON.stringify(address), JSON.stringify(gift)].join('#');
    const clientRequestId = requestIdFor(choiceHash, retried);
    try {
      const res = await api('/api/orders', {
        method: 'POST',
        body: {
          clientRequestId,
          items: itemsPayload,
          address,
          shippingOptionId: option.id,
          paymentMethod: method,
          couponCode: coupon?.code || null,
          gift,
          saveAddress: Boolean(user && saveAddress),
        },
      });
      if (res.paymentMethod === 'cod' || res.paymentStatus === 'paid') return finish(res.orderId, res);
      if (!res.razorpay) throw new Error('Could not start the payment. Please try again.');
      await pay(res.razorpay, {
        orderNumber: res.orderNumber,
        onSuccess: async (resp) => {
          setPlacing(true);
          try {
            await api('/api/payments/verify', { method: 'POST', body: { orderId: res.orderId, ...resp } });
          } catch (e) {
            // The webhook is authoritative; the confirmation page waits for it.
            console.warn('verify failed, relying on webhook', e.message);
          }
          finish(res.orderId, res);
        },
        onDismiss: () => {
          setPlacing(false);
          setNotice('Your items are reserved for 15 minutes. Press Pay again to complete your order.');
        },
      });
    } catch (e) {
      setPlacing(false);
      track('checkout_error', { code: e.code || 'unknown' });
      if (e.code === 'order_expired' && !retried) return placeOrder({ retried: true });
      if (e.code === 'shipping_changed' || e.code === 'unserviceable') {
        toast.error(e.message);
        setStep(1);
        fetchQuote(address.pincode);
        return;
      }
      if (e.code?.startsWith('coupon_')) {
        setCoupon(null);
        setCouponError(e.message);
      }
      if (['out_of_stock', 'item_unavailable', 'variant_required', 'max_per_order'].includes(e.code)) {
        // Re-sync live stock into the cart.
        api('/api/products/lookup', { method: 'POST', body: { items: itemsPayload } }).then(({ items }) => cart.applyLookup(items)).catch(() => {});
      }
      toast.error(e.message);
    }
  };

  const finish = (orderId, res) => {
    try {
      sessionStorage.removeItem(REQ_KEY);
      sessionStorage.setItem(`purchase_${orderId}`, JSON.stringify({ items: cart.items, total: res.total, orderNumber: res.orderNumber, coupon: coupon?.code || null, shipping: option?.price || 0 }));
    } catch {}
    cart.clear();
    router.replace(`/order-confirmation/${orderId}`);
  };

  // ---- Render ----
  if (cart.hydrated && !cart.items.length && !placing) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="font-display text-3xl">Your cart is empty</h1>
        <Link href="/shop" className="btn-primary mt-6">Continue shopping</Link>
      </div>
    );
  }

  const field = (name, label, props = {}) => (
    <div className={props.wrapClass || ''}>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input
        id={`f-${name}`}
        className={`input ${errors[name] ? 'input-error' : ''}`}
        value={address[name] || ''}
        onChange={(e) => setAddress((a) => ({ ...a, [name]: e.target.value }))}
        aria-invalid={Boolean(errors[name])}
        {...props.input}
      />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="container-page py-8 sm:py-12" data-clarity-mask="true">
      <h1 className="font-display text-3xl sm:text-4xl">Checkout</h1>
      <ol className="mt-6 flex items-center gap-2 text-sm" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button
              type="button"
              disabled={i > step || placing}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ${i === step ? 'bg-ink text-white' : i < step ? 'bg-brand-100 text-ink' : 'bg-ink/5 text-ink-muted'}`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span>{i < step ? '✓' : i + 1}</span>{s}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-ink/15 sm:w-8" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 lg:order-1">
          {holiday && <div className="mb-6 rounded-2xl bg-brand-100 p-4 text-sm font-medium text-brand-900">{settings.checkout.holidayMessage}</div>}

          {/* Step 1 — Address */}
          {step === 0 && (
            <form onSubmit={submitAddress} className="card space-y-5 p-5 sm:p-7" noValidate>
              <h2 className="font-display text-2xl">Delivery address</h2>
              {!user && (
                <p className="text-sm text-ink-muted">Checking out as a guest. <Link href="/login?next=/checkout" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2">Sign in</Link> to use saved addresses.</p>
              )}
              {config?.addresses?.length > 0 && (
                <div>
                  <p className="label">Saved addresses</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {config.addresses.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => setAddress({ ...EMPTY_ADDRESS, ...a, email: a.email || config.user?.email || '', line2: a.line2 || '', landmark: a.landmark || '' })}
                        className={`rounded-xl border-2 p-3 text-left text-xs ${address.line1 === a.line1 && address.pincode === a.pincode ? 'border-ink bg-brand-50' : 'border-ink/10'}`}
                      >
                        <b className="text-sm">{a.name}</b><br />{a.line1}, {a.city} {a.pincode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {config?.addressSearch && (
                <AddressSearch onPick={(a) => setAddress((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v)) }))} />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('name', 'Full name', { input: { autoComplete: 'name' } })}
                {field('phone', 'Mobile number', { input: { inputMode: 'numeric', autoComplete: 'tel-national', maxLength: 14, placeholder: '10-digit mobile' } })}
                {field('email', 'Email', { wrapClass: 'sm:col-span-2', input: { type: 'email', autoComplete: 'email' } })}
                {field('line1', 'House / flat, building, street', { wrapClass: 'sm:col-span-2', input: { autoComplete: 'address-line1' } })}
                {field('line2', 'Area, locality (optional)', { wrapClass: 'sm:col-span-2', input: { autoComplete: 'address-line2' } })}
                <div>
                  <label className="label" htmlFor="f-pincode">Pincode</label>
                  <input
                    id="f-pincode"
                    className={`input ${errors.pincode ? 'input-error' : ''}`}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    value={address.pincode}
                    onChange={(e) => onPincode(e.target.value.replace(/\D/g, ''))}
                  />
                  {errors.pincode && <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>}
                </div>
                {field('city', 'City', { input: { autoComplete: 'address-level2' } })}
                <div>
                  <label className="label" htmlFor="f-state">State</label>
                  <select id="f-state" className={`input ${errors.state ? 'input-error' : ''}`} value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
                </div>
                {field('landmark', 'Landmark (optional)')}
              </div>
              {user && (
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-ink" />
                  Save this address to my account
                </label>
              )}
              <button className="btn-primary w-full py-3.5 text-base" disabled={!synced}>Continue to shipping</button>
            </form>
          )}

          {/* Step 2 — Shipping */}
          {step === 1 && (
            <div className="card space-y-5 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Shipping</h2>
                  <p className="mt-1 text-sm text-ink-muted">To {address.name}, {address.line1}, {address.city} {address.pincode}</p>
                </div>
                <button className="text-sm font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2" onClick={() => setStep(0)}>Change</button>
              </div>
              {quote.loading && (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-ink/5" />)}
                </div>
              )}
              {quote.error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  {quote.error} <button className="ml-2 font-semibold underline" onClick={() => fetchQuote(address.pincode)}>Retry</button>
                </div>
              )}
              {!quote.loading && quote.data && !quote.data.serviceable && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Sorry, we don&apos;t deliver to {address.pincode} yet. Please try another address.</div>
              )}
              {!quote.loading && options.length > 0 && (
                <div className="space-y-3" role="radiogroup" aria-label="Shipping options">
                  {options.map((o) => (
                    <label key={o.id} className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition ${optionId === o.id ? 'border-ink bg-brand-50' : 'border-ink/10 hover:border-ink/25'}`}>
                      <input type="radio" name="ship" className="h-4 w-4 accent-ink" checked={optionId === o.id} onChange={() => chooseOption(o.id)} />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{o.label}{o.courierName && quote.data.source === 'shiprocket' ? ` · ${o.courierName}` : ''}</span>
                        <span className="block text-xs text-ink-muted">{o.etaText ? `Delivery in ${o.etaText}` : 'Standard delivery'}{o.cod ? ' · COD available' : ''}</span>
                      </span>
                      <span className="text-sm font-bold">
                        {o.price === 0 ? <><span className="mr-1 text-xs font-normal text-ink-muted line-through">{o.originalPrice ? formatINR(o.originalPrice) : ''}</span>Free</> : formatINR(o.price)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button className="btn-primary w-full py-3.5 text-base" disabled={!option || quote.loading} onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Continue to payment
              </button>
            </div>
          )}

          {/* Step 3 — Pay */}
          {step === 2 && option && (
            <div className="space-y-5">
              <div className="card space-y-4 p-5 sm:p-7">
                <h2 className="font-display text-2xl">Gift options</h2>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={gift.isGift} onChange={(e) => setGift((g) => ({ ...g, isGift: e.target.checked }))} />
                  This is a gift <span className="text-xs text-ink-muted">(prices are left out of the parcel)</span>
                </label>
                {gift.isGift && (
                  <div className="space-y-3 pl-7">
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-ink" checked={gift.wrap} onChange={(e) => setGift((g) => ({ ...g, wrap: e.target.checked }))} />
                      Gift wrap {Number(settings?.checkout?.giftWrapFee) > 0 ? `(+${formatINR(settings.checkout.giftWrapFee)})` : '(free)'}
                    </label>
                    <div>
                      <textarea
                        className="input min-h-[80px]"
                        maxLength={GIFT_MESSAGE_MAX}
                        placeholder="Message card (optional)"
                        value={gift.message}
                        onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))}
                      />
                      <p className="mt-1 text-right text-xs text-ink-muted">{gift.message.length}/{GIFT_MESSAGE_MAX}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="card space-y-3 p-5 sm:p-7">
                <h2 className="font-display text-2xl">Coupon</h2>
                {coupon ? (
                  <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm">
                    <span><b>{coupon.code}</b> applied · you save {formatINR(discount)}</span>
                    <button className="font-semibold text-red-600" onClick={() => { setCoupon(null); setCouponInput(''); }}>Remove</button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); checkCoupon(couponInput.trim()); }} className="flex gap-2">
                    <input className="input uppercase" placeholder="Enter coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} aria-label="Coupon code" />
                    <button className="btn-outline shrink-0" disabled={!couponInput.trim()}>Apply</button>
                  </form>
                )}
                {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                <p className="text-xs text-ink-muted">Discounts apply to items only, not to shipping or COD fees.</p>
              </div>

              <div className="card space-y-3 p-5 sm:p-7">
                <h2 className="font-display text-2xl">Payment</h2>
                {config?.razorpayEnabled && (
                  <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${method === 'razorpay' ? 'border-ink bg-brand-50' : 'border-ink/10'}`}>
                    <input type="radio" name="pay" className="h-4 w-4 accent-ink" checked={method === 'razorpay'} onChange={() => setMethod('razorpay')} />
                    <span>
                      <span className="block text-sm font-semibold">Pay online</span>
                      <span className="block text-xs text-ink-muted">UPI, cards, net banking, wallets</span>
                    </span>
                  </label>
                )}
                {codAvailable && (
                  <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${method === 'cod' ? 'border-ink bg-brand-50' : 'border-ink/10'}`}>
                    <input type="radio" name="pay" className="h-4 w-4 accent-ink" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                    <span>
                      <span className="block text-sm font-semibold">Cash on delivery</span>
                      <span className="block text-xs text-ink-muted">
                        {codFeeFor(itemsTotal - discount, settings.payments) > 0 ? `+${formatINR(codFeeFor(itemsTotal - discount, settings.payments))} COD fee` : 'No extra fee'}
                        {settings.payments.codFreeAbove > 0 && codFeeFor(itemsTotal - discount, settings.payments) > 0 ? ` · waived above ${formatINR(settings.payments.codFreeAbove)}` : ''}
                      </span>
                    </span>
                  </label>
                )}
                {!method && <p className="text-sm text-red-600">No payment method is available for this order. Please choose another shipping option or contact us.</p>}
                <div className="lg:hidden"><Totals totals={totals} /></div>
                {notice && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{notice}</p>}
                <button
                  className="btn-primary w-full py-4 text-base"
                  onClick={() => placeOrder()}
                  disabled={!method || placing || holiday}
                >
                  {placing ? 'Processing…' : method === 'cod' ? `Place order · ${formatINR(total)}` : `Pay ${formatINR(total)}`}
                </button>
                <p className="text-center text-xs text-ink-muted">By placing your order you agree to our <Link href="/policies/terms" className="underline">terms</Link> and <Link href="/policies/returns" className="underline">refund policy</Link>.</p>
              </div>
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <OrderSummary items={cart.items} totals={totals} />
        </div>
      </div>
    </div>
  );
}
