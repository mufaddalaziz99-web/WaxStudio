# Wax Studio storefront

Single-product-first e-commerce site (brand **Wax Studio**, product **Hair Removal Powder**), rebuilt
on the same architecture as Yarnimals: Next.js 16 + PostgreSQL, Razorpay + Cash on Delivery, Shiprocket
shipping, Resend email, full admin panel. It starts with one product; add more from **Admin → Products** —
the shop, categories, feeds and sitemap pick them up automatically.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and conventions.

## Quick start (local)

```bash
npm install
npm run db:local                      # terminal 1 — Postgres on :5433 (keep running)
npm run db:migrate
npm run db:seed                       # launch product (scripts/seed-data.mjs), WELCOME10 + SMOOTH50 coupons
npm run admin:create -- you@example.com 'your-password' "Your Name"
npm run dev                           # terminal 2 — http://localhost:3000  (admin: /admin)
```

`.env.local` was generated from `.env.example` with random `AUTH_SECRET` / `CRON_SECRET`.
Every integration is optional and the site degrades gracefully:

| Missing | Behaviour |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Checkout offers Cash on Delivery only |
| `SHIPROCKET_*` | Flat-rate shipping from Admin → Settings; no pincode autofill |
| `GOOGLE_MAPS_API_KEY` | Address search box hidden |
| `RESEND_API_KEY` | Emails printed to the server log |
| `CLOUDINARY_*` | Uploads saved to `public/uploads` (dev only) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Sign-In button hidden |

## Replacing the placeholder product
Admin → Products → *Hair Removal Powder*: change name, slug (old slug keeps redirecting), description,
variants (size / price / stock / weight), images, highlights, how-to-use steps, FAQs. Brand name, tagline,
support contacts, GSTIN, shipping fees and COD rules live in Admin → Settings.

## Tests
Both suites mutate data — run them only against the local database, with `npm run dev` running.
```bash
npm run test:api        # stock race, idempotency, tracking privacy, auth, cancel/restock, expiry
npm run test:razorpay   # payment states via signed webhooks (needs RAZORPAY_WEBHOOK_SECRET set)
```

## Deploying (Vercel + Neon)
1. Create a Neon database; set `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `DATABASE_SSL=true`.
2. Set `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` and whichever integrations you use.
3. Deploy — `vercel-build` runs migrations then `next build`. Region `sin1`, daily cron at 03:00 IST (`vercel.json`).
4. `npm run admin:create` against production once (with the production `DATABASE_URL`).
5. Razorpay: add a webhook to `https://<site>/api/webhooks/razorpay` for `payment.captured`, `payment.failed`,
   `refund.*`; put its secret in `RAZORPAY_WEBHOOK_SECRET`. Place a small real order and check it reaches
   confirmed + paid from both the browser and the webhook (order history notes).
6. Shiprocket: add the tracking webhook `https://<site>/api/webhooks/courier` with header token = `SHIPROCKET_WEBHOOK_TOKEN`.
