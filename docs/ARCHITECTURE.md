# Architecture & conventions

Single-product-first storefront (placeholder brand **Wax Studio**, product **Hard Wax Powder**) built to the
same design as Yarnimals: Next.js 16 App Router (JavaScript), React 19, PostgreSQL via `pg`, Tailwind 3.4 for the
storefront, Ant Design 6 for the admin, Zod 4, Razorpay + COD, Shiprocket (flat-rate fallback), Resend (console
fallback), Cloudinary (local `/public/uploads` fallback). Catalog supports many products/categories — the home
page simply leads with the featured product.

## Principles
1. **Server is the source of truth.** Prices, stock, coupons, shipping recomputed on the server at order time.
   The browser sends only product ids, variant ids, quantities, an address and choices.
2. **Reserve stock at order creation, release on expiry.** `placeOrder()` locks rows and decrements stock in one
   transaction. Unpaid online orders are released after 15 minutes (`releaseExpiredOrders`).
3. **Every payment path converges** on `markOrderPaid()` / `cancelAndRestock()` in `src/lib/server/orderHelpers.js`.
4. **Degrade gracefully.** No Razorpay keys → COD only. No Shiprocket → flat rate. No Google Maps → no search box.
5. **No external HTTP inside a DB transaction.**

## Layout
| Path | What |
|---|---|
| `src/app/(store)` | Storefront pages (share header/footer from `(store)/layout.js`) |
| `src/app/admin` | Admin panel (Ant Design) |
| `src/app/api` | Thin route handlers. All logic in `src/lib/server` |
| `src/lib/server` | Domain logic, `import 'server-only'` |
| `src/lib` | Shared browser+server: `validation.js` (Zod), `rules.js`, `orderRules.js`, `shippingRules.js`, `cartLine.js`, `imageUrl.js` |
| `src/lib/client` | Browser helpers: `api.js` (fetch wrapper + `uploadImage`), `analytics.js` (GA4 `track`, `ecommerce`, `insight`) |
| `src/contexts` | `CartContext`, `WishlistContext`, `AuthContext`, `ToastContext` |
| `db/migrations` | Numbered SQL; `npm run db:migrate` |
| `scripts` | `db-local`, `migrate`, `seed`, `create-admin`, tests |

## Conventions
- **Route handlers** are wrapped in `route()` from `src/lib/server/http.js`:
  ```js
  import { route, readJson, rateLimit } from '@/lib/server/http';
  export const POST = route(async (req, { params }) => {
    const { id } = await params;              // params are Promises in Next 16
    const body = someSchema.parse(await readJson(req));
    return { ok: true };                      // plain objects become JSON
  });
  ```
  Throw `HttpError` (`badRequest`, `notFound`, `unauthorized`, `forbidden`, `conflict`) for expected failures;
  a `ZodError` becomes a 400 naming the field. Errors are `{ error, code }`.
- **DB**: `query / one / many (text, params, client?)` and `withTransaction(fn)` from `src/lib/server/db.js`.
  Money = whole rupees in INTEGER columns; paise only when talking to Razorpay.
- **Auth**: `getSessionUser()`, `requireUser()`, `requireAdmin()`, `setSessionCookie(userId)`, `clearSessionCookie()`,
  `publicUser(u)`, `hashPassword`, `verifyPassword`, `issueCode(userId, 'verify'|'reset')`,
  `consumeCode(userId, purpose, code)`, `verifyGoogleIdToken(idToken)` in `src/lib/server/auth.js`.
  Every admin API handler starts with `await requireAdmin()`. Admin pages are guarded in `src/app/admin/layout.js`.
- **Settings**: `getSettings()` / `updateSettings(group, patch)` / `SETTINGS_DEFAULTS` in `src/lib/server/settings.js`
  (groups: store, announcement, shipping, payments, checkout, reviews).
- **Cache invalidation**: after stock/review changes call `refreshProducts(productIds)`; after admin edits to
  settings/categories/products call `refreshStorefront()` (`src/lib/server/revalidate.js`).
- **Emails**: `src/lib/server/orderEmails.js` (claimed once via `*_emailed_at` columns), `mailer.js` (`sendEmail`, `layout`).
- **Post-response work**: `import { after } from 'next/server'` and `after(() => runConfirmedFollowUps(id))`.
- **Validation**: add/extend schemas only in `src/lib/validation.js`.
- **Pages**: catalog pages are ISR (`revalidate = 86400` on the store layout); cart/checkout/account/auth/order pages
  are `export const dynamic = 'force-dynamic'`. `params`/`searchParams` must be awaited.
- **Styling (storefront)**: minimal premium look — near-black `ink`, warm ivory `cream`, white cards, hairline
  `line` borders, and one muted sand accent (`brand-100/200` for soft surfaces; use sparingly). Fonts:
  `font-display` = Instrument Serif (use `.display`; `italic` for the accent word), `font-sans` = Inter at light
  weights (the theme caps `font-bold`/`font-black` at 600). Labels are small uppercase with wide tracking.
  Component classes in `src/app/globals.css`: `container-page`, `btn-primary` (black pill), `btn-accent` /
  `btn-outline` (outlined), `btn-ghost`, `card`, `input`, `label`, `chip`, `chip-soft`, `display`, `sticker` (small quiet tag), `prose-store`.
  Grids with `fr` tracks must use `minmax(0,…fr)` so horizontally scrolling rows can't widen the page.
- **Product page content** (Admin → Products → "Product page content"): tagline, badge, "highly rated for" chips,
  ticked claims, key ingredients, free-from badges, per-variant badge ("Best value"). Specs double as the legal
  "Product details" table (generic name, net quantity, shelf life, marketed by, customer care, country of origin).
- **Analytics**: never send names, emails, phones or addresses to GA4.

## Order lifecycle
`placed+pending` (online, awaiting payment) → `confirmed+paid` via `markOrderPaid` → `packed` → `shipped` →
`out_for_delivery` → `delivered`; or `cancelled`. COD starts at `confirmed+pending` and becomes `paid` on delivery.
Every change writes `order_status_history`. Courier statuses are forward-only (`applyCourierStatus`).

## Local development
```bash
npm install
cp .env.example .env.local      # already generated with random secrets
npm run db:local                # terminal 1: Postgres on :5433
npm run db:migrate && npm run db:seed
npm run admin:create -- you@example.com 'a-strong-password' "Your Name"
npm run dev                     # terminal 2: http://localhost:3000
```
