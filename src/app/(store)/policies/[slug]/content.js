import Link from 'next/link';
import { formatINR } from '@/lib/rules';
import { ISSUE_REPORT_DAYS } from '@/lib/orderRules';

// Placeholder policy copy for an Indian D2C store. Store name, contact details and shipping / COD
// numbers come from Admin > Settings. Have a professional review these before going live.

export const POLICY_SLUGS = ['shipping', 'returns', 'privacy', 'terms'];

export const POLICY_TITLES = {
  shipping: 'Shipping Policy',
  returns: 'Refund & Cancellation Policy',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

function Contact({ store }) {
  return (
    <ul>
      {store.supportEmail && <li>Email: <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a></li>}
      {store.supportPhone && <li>Phone: {store.supportPhone}</li>}
      {store.whatsapp && <li>WhatsApp: <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener">+{store.whatsapp}</a></li>}
      <li>Contact form: <Link href="/contact">/contact</Link></li>
      {store.address && <li>Address: {store.address}</li>}
    </ul>
  );
}

/** Returns { title, description, body } for a policy slug, or null. */
export function getPolicy(slug, settings) {
  const { store, shipping, payments } = settings;
  const name = store.name;
  const legal = store.legalName || name;
  const free = Number(shipping.freeShippingThreshold) || 0;

  const policies = {
    shipping: {
      description: `How ${name} ships orders across India: dispatch times, delivery estimates, shipping charges and cash on delivery.`,
      body: (
        <>
          <p>
            We ship to almost every serviceable pincode in India through trusted courier partners. You can check
            delivery to your pincode on any product page or at checkout before you pay.
          </p>
          <h2>Dispatch time</h2>
          <p>
            Orders are packed and handed to the courier within 1–2 business days (Monday to Saturday, excluding public
            holidays). Orders placed after 2 pm or on Sundays are processed the next business day.
          </p>
          <h2>Delivery time</h2>
          <p>
            Most orders arrive within {shipping.flatRateEtaDays || '4–7'} business days of dispatch. Metro cities are
            usually quicker; remote areas and the North-East may take a few extra days. The estimate shown at checkout is
            based on your pincode and the courier selected.
          </p>
          <h2>Shipping charges</h2>
          <ul>
            {free > 0 && <li>Free standard shipping on orders of {formatINR(free)} or more (after discounts).</li>}
            <li>Below that, a shipping fee{shipping.flatRate ? ` (usually ${formatINR(shipping.flatRate)})` : ''} is shown at checkout before you pay.</li>
            <li>Express options, where available, are priced separately at checkout.</li>
          </ul>
          {payments.codEnabled && (
            <>
              <h2>Cash on delivery (COD)</h2>
              <p>
                COD is available on eligible pincodes
                {payments.codMaxOrder ? ` for orders up to ${formatINR(payments.codMaxOrder)}` : ''}.
                {payments.codFee ? ` A COD handling fee of ${formatINR(payments.codFee)} applies` : ''}
                {payments.codFee && payments.codFreeAbove ? `, waived on orders of ${formatINR(payments.codFreeAbove)} or more` : ''}
                {payments.codFee ? '.' : ''} Please keep the exact amount ready — repeated refusal of COD parcels may
                disable COD for future orders.
              </p>
            </>
          )}
          <h2>Tracking your order</h2>
          <p>
            As soon as your parcel ships we email you the courier name and tracking number (AWB). You can also check the
            status any time on our <Link href="/track-order">Track Order</Link> page using your order number and phone
            number.
          </p>
          <h2>Delays and failed deliveries</h2>
          <p>
            Weather, festivals, strikes or courier issues can occasionally delay deliveries; we will keep you informed.
            If a delivery fails because the address was incomplete or nobody was available after multiple attempts, the
            parcel returns to us. We can re-ship it once the extra shipping charge is paid, or refund the order value
            minus shipping costs for prepaid orders.
          </p>
          <h2>Damaged or tampered parcels</h2>
          <p>
            If the outer packaging looks damaged or tampered with, please record a short unboxing video and report it
            within {ISSUE_REPORT_DAYS} days of delivery — see our <Link href="/policies/returns">Refund &amp; Cancellation Policy</Link>.
          </p>
          <h2>Questions?</h2>
          <Contact store={store} />
        </>
      ),
    },

    returns: {
      description: `${name}'s policy on order cancellations, returns, replacements and refunds.`,
      body: (
        <>
          <p>
            Our products are personal-care items, so for hygiene reasons we cannot accept returns of opened or used
            products. But if something is wrong with your order, we will make it right.
          </p>
          <h2>Cancelling an order</h2>
          <ul>
            <li>You can cancel an order yourself from your order page until it is shipped (status “Confirmed” or “Packed”).</li>
            <li>Once an order has shipped it can no longer be cancelled. You may refuse delivery of a COD order, but repeated refusals may disable COD for your account.</li>
            <li>Unpaid online orders are cancelled automatically if payment is not completed within 15 minutes.</li>
          </ul>
          <h2>Damaged, wrong or missing items</h2>
          <p>
            If your parcel arrives damaged, has the wrong product, or something is missing, report it within{' '}
            {ISSUE_REPORT_DAYS} days of delivery from your order page (or via our <Link href="/contact">contact form</Link>)
            with clear photos of the product, packaging and shipping label. An unboxing video helps us resolve claims
            faster. Once verified, we will send a free replacement or issue a full refund — your choice, subject to stock.
          </p>
          <h2>Quality concerns</h2>
          <p>
            If you believe the product is defective (for example, wax that does not melt or set as described when used as
            directed), contact us within {ISSUE_REPORT_DAYS} days of delivery with photos and your batch number. We review
            every case individually.
          </p>
          <h2>What is not covered</h2>
          <ul>
            <li>Opened or used products returned for a change of mind.</li>
            <li>Skin reactions where a patch test was not done or the usage instructions were not followed.</li>
            <li>Damage caused by overheating, incorrect storage or misuse.</li>
          </ul>
          <h2>Refunds</h2>
          <ul>
            <li>Prepaid orders are refunded to the original payment method (card, UPI, net banking or wallet).</li>
            <li>COD orders are refunded by bank transfer or UPI to details you share with us.</li>
            <li>Refunds are initiated within 2 business days of approval or cancellation; banks usually credit them within 5–7 business days.</li>
            <li>Shipping and COD fees are refunded when the error was ours.</li>
          </ul>
          <h2>Need help?</h2>
          <Contact store={store} />
        </>
      ),
    },

    privacy: {
      description: `How ${name} collects, uses and protects your personal information.`,
      body: (
        <>
          <p>
            {legal} (“{name}”, “we”, “us”) respects your privacy. This policy explains what personal data we collect when
            you visit our website or place an order, why we collect it, and the choices you have. We process personal data
            in accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
          </p>
          <h2>What we collect</h2>
          <ul>
            <li><b>Order details:</b> name, email, mobile number, delivery address, items purchased and order history.</li>
            <li><b>Account details:</b> name, email, password (stored only as a secure hash) or your Google sign-in profile, saved addresses, wishlist and cart.</li>
            <li><b>Payment details:</b> payments are processed by our payment gateway (Razorpay). We never see or store your full card, UPI PIN or banking credentials.</li>
            <li><b>Messages:</b> anything you send us through the contact form, email or WhatsApp, and product reviews you submit.</li>
            <li><b>Usage data:</b> pages viewed, device and browser type, approximate location and similar analytics collected through cookies.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To process, ship and deliver your orders and send order and delivery updates.</li>
            <li>To provide customer support, handle cancellations, refunds and replacements.</li>
            <li>To prevent fraud and misuse (for example, COD abuse) and to meet legal and tax obligations.</li>
            <li>To improve our website and products using aggregated analytics.</li>
            <li>To send offers only if you have opted in — you can unsubscribe at any time.</li>
          </ul>
          <h2>Who we share it with</h2>
          <p>
            We share only what is needed with service providers who help us run the store: payment gateway, shipping and
            courier partners, email delivery, hosting and analytics providers. They may use your data only to provide
            their service to us. We do not sell your personal data. We may disclose information if required by law.
          </p>
          <h2>Cookies</h2>
          <p>
            We use essential cookies to keep you signed in and remember your cart, and analytics cookies to understand how
            the site is used. You can block or delete cookies in your browser settings; some features may not work without
            them.
          </p>
          <h2>How long we keep it</h2>
          <p>
            Order and invoice records are kept as long as required under Indian tax laws. Account data is kept while your
            account is active; you can ask us to delete your account at any time, subject to those legal requirements.
          </p>
          <h2>Your rights</h2>
          <p>
            You can ask to access, correct or delete your personal data, or withdraw consent for marketing, by writing to
            us. We will respond within a reasonable time and in any case as required by law.
          </p>
          <h2>Security</h2>
          <p>
            We use HTTPS, hashed passwords, restricted access and reputable providers to protect your data. No method of
            transmission or storage is completely secure, but we work hard to protect your information.
          </p>
          <h2>Grievance officer &amp; contact</h2>
          <p>For privacy questions or complaints, contact our grievance officer:</p>
          <Contact store={store} />
          <p>We may update this policy from time to time; the latest version will always be on this page.</p>
        </>
      ),
    },

    terms: {
      description: `The terms that apply when you browse or buy from ${name}.`,
      body: (
        <>
          <p>
            These terms apply to your use of this website and to every purchase from {legal} (“{name}”, “we”). By using the
            site or placing an order, you agree to them. Please also read our{' '}
            <Link href="/policies/privacy">Privacy Policy</Link>, <Link href="/policies/shipping">Shipping Policy</Link> and{' '}
            <Link href="/policies/returns">Refund &amp; Cancellation Policy</Link>, which form part of these terms.
          </p>
          <h2>Products and safe use</h2>
          <ul>
            <li>Our products are for external, cosmetic use by adults only. Keep them away from children.</li>
            <li>Always do a patch test 24 hours before first use and follow the usage instructions on the pack and product page.</li>
            <li>Check the wax temperature before applying. Do not use on broken, sunburnt, irritated or recently treated skin, or on moles and warts.</li>
            <li>If you are pregnant, diabetic, on medication that thins the skin (such as retinoids) or have a skin condition, consult a doctor before use.</li>
            <li>Results vary with hair type and technique. Product images are for illustration; actual colour may vary slightly.</li>
          </ul>
          <h2>Prices and payment</h2>
          <p>
            All prices are in Indian Rupees (₹) and include applicable GST. Shipping, COD and other charges are shown at
            checkout before you pay. We may change prices at any time; the price at the time you place your order applies.
            {store.gstin ? ` Our GSTIN is ${store.gstin}.` : ''}
          </p>
          <h2>Orders</h2>
          <p>
            An order is confirmed once payment succeeds (or, for cash on delivery, once we send a confirmation). We may
            cancel an order and refund any amount paid if a product is out of stock, a pricing error occurred, the
            pincode is not serviceable, or we suspect fraud or misuse. Quantities per order may be limited.
          </p>
          <h2>Coupons and offers</h2>
          <p>
            Coupons are subject to their stated conditions, cannot be exchanged for cash and may be withdrawn at any time.
            Only one coupon can be used per order unless stated otherwise.
          </p>
          <h2>Accounts</h2>
          <p>
            You are responsible for keeping your login details safe and for activity under your account. Please give us
            accurate information. We may suspend accounts that are misused.
          </p>
          <h2>Reviews and content</h2>
          <p>
            Reviews and photos you submit must be honest and your own. By submitting them you allow us to display them on
            our website and social channels. We may moderate or remove content that is abusive, misleading or unrelated.
          </p>
          <h2>Intellectual property</h2>
          <p>
            All content on this site — text, images, logos and design — belongs to {legal} or its licensors and may not be
            copied without written permission.
          </p>
          <h2>Limitation of liability</h2>
          <p>
            To the extent permitted by law, our total liability for any claim relating to an order is limited to the amount
            you paid for that order. We are not liable for indirect or consequential losses, or for reactions resulting from
            use against the instructions above.
          </p>
          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts
            at the place of our registered office.
          </p>
          <h2>Contact</h2>
          <Contact store={store} />
        </>
      ),
    },
  };

  const p = policies[slug];
  return p ? { title: POLICY_TITLES[slug], ...p } : null;
}
