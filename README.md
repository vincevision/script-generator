# EPIC WEAR — Official Store

**BUILT FOR THOSE WHO STAND OUT.**

This is the official EPIC WEAR online store: premium Kenyan streetwear with M-PESA checkout, optional customer accounts, order tracking and a secure admin CMS. It keeps the launch site's visual identity: the dark cinematic aesthetic, the cut EPIC wordmark, the loader sequence, particles, light streaks, magnetic buttons and line-art icons.

---

## Features

**Storefront**
- **Pages:** Home (hero, The Latest Drop, campaigns, collab teaser, manifesto), Shop, Product, Collections, New Drop, EPIC × Sharon collab, About (founder: Vincent Omondi), Contact, Wishlist, Track My Order, Checkout, Order confirmation, Account, Help (shipping, returns, FAQ).
- **Shop:** 11 categories. Filters for size, price, gender, collection and availability. Sort by Featured, Newest, Price low→high and Price high→low. Filters are saved in the URL so they can be shared. On mobile, filters open in a bottom sheet.
- **Search:** global search overlay with live suggestions. It understands synonyms, e.g. "black hoodie", "cargo pants", "tee" or "trousers".
- **Search with image:** upload a photo or use the camera. The site matches it to similar EPIC products using colour and tone analysis, entirely in the browser. The photo never leaves the device.
- **Product page:**
  - gallery with thumbnails, hover zoom, fullscreen lightbox and swipe on mobile;
  - colours, sizes with live stock, and a size guide;
  - quantity, Add to Bag, Buy Now and wishlist;
  - "You may also like" suggestions and a sticky mobile buy bar.
- **Cart drawer:** the bag icon animates when you add something. You can edit quantities and see subtotal, delivery and total. Delivery is calculated by region: Nairobi, rest of Kenya, or international.
- **Checkout:**
  - Step 1: delivery details, with Kenyan counties. International addresses are supported.
  - Step 2: review, then M-PESA payment. You can enter a discount code (`WELCOME10` is seeded).
  - While paying, the page shows live states: *Waiting for payment…*, *Payment confirmed* or *Payment could not be completed*.
  - Step 3: **ORDER CONFIRMED / WELCOME TO EPIC.** with the order number.
- **Order tracking:** Order Placed → Processing → Packed → Shipped → Delivered, shown as an animated timeline.
- **Accounts (optional):** register or sign in, order history, saved addresses, profile, password and logout. The wishlist syncs to the account when you're signed in. Guest checkout always works.
- **Motion:** respects `prefers-reduced-motion`. The custom cursor appears on desktop only. A lighter "lite" mode switches on for low-power devices.

**Admin / CMS** (`/admin`)
- Dashboard: revenue, orders waiting to be fulfilled, low-stock alerts and payment-mode status.
- Orders: filter and search, see full order details, and move orders through the fulfilment statuses. Each status change can carry an optional note that customers see in their tracking timeline. Cancelling an order returns its stock.
- Products: create, edit and delete. Upload images and drag to reorder them. Set prices, sale prices, sizes, per-size stock, colours, collections, the featured flag and draft/active status.
- Also manage: collections (campaign banners), discount codes, customers (accounts and guest buyers), homepage hero, About page, collab campaign, store settings (contact details, announcement bar, socials), the contact-form inbox and subscribers (with CSV export).

**SEO:** every URL gets server-rendered titles, meta descriptions, canonical links and OG/Twitter tags. Product, Organization, WebSite and BreadcrumbList data is included as JSON-LD. `sitemap.xml` and `robots.txt` are generated.

---

## Quick start

Requires **Node.js 22.5+**. The store uses the built-in `node:sqlite`, so no database server is needed.

```bash
npm install
cp .env.example .env              # then set ADMIN_EMAIL and ADMIN_PASSWORD
npm start                         # → http://localhost:3000
```

- The database (`data/epic.db`) is created and seeded with the catalogue on the first run.
- In development, **the M-PESA simulator** runs automatically, so no real money moves:
  - a phone number ending in `000` simulates a payment cancelled on the phone;
  - a phone number ending in `111` simulates insufficient funds;
  - any other number simulates a successful payment.
- Admin: open `/admin` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. You can also create an admin at any time:

  ```bash
  npm run create-admin -- you@example.com "a-long-unique-password" "Your Name"
  ```

---

## Going live with M-PESA (Safaricom Daraja STK Push)

1. Create an app at <https://developer.safaricom.co.ke>, test in the sandbox, then apply to **Go Live** for your Paybill or Till number.
2. Fill in the `MPESA_*` variables in `.env` on the **server**:
   - consumer key and consumer secret;
   - shortcode and passkey;
   - transaction type;
   - `MPESA_CALLBACK_SECRET`, which must be a long random string.
3. Set `SITE_URL` (or `MPESA_CALLBACK_BASE`) to your public **HTTPS** URL. Safaricom posts results to `/api/payments/mpesa/callback/<secret>`.
4. Set `NODE_ENV=production` and `MPESA_ENV=production`. The simulator switches off automatically.

How payments work:
- The server re-prices every order from the database, so the browser never decides the amount.
- The server checks that the amount paid matches the order total.
- If the callback is lost, the server confirms the payment with the STK Query API instead.
- Unpaid orders release their reserved stock after 30 minutes.

Adding another payment provider (card, PayPal…) means adding a module in `server/payments/` and registering it in `server/payments/index.js`. The checkout UI already shows Card as "coming soon".

---

## Security

- **No secrets in the frontend.** M-PESA keys, admin credentials and the database exist only on the server, in `.env` (git-ignored).
- **Real server-side auth:**
  - passwords are hashed with scrypt;
  - sessions use random tokens, stored hashed, sent as `HttpOnly` + `SameSite=Lax` cookies (`Secure` in production);
  - sign-in and registration are rate-limited.
- **Admin is protected on the server:**
  - every `/api/admin/*` route requires an admin session;
  - the CMS script (`/admin/app.js`) is only ever served to signed-in admins; everyone else gets the login screen and a `401`;
  - admin pages send `noindex`.
- **Validated input:** checkout, contact, account and admin data are validated on the server. Prices, discounts, delivery and stock are always computed server-side.
- **Uploads:** only JPG, PNG, WebP and AVIF are accepted. The file's actual content is checked, not just the extension. Files get random names, with an 8 MB limit.
- **Headers:** strict CSP (no inline scripts), `X-Content-Type-Options`, `Referrer-Policy`, frame protection in production, and a CSRF guard (custom request header) on every state-changing API call.

---

## Hosting

This is a Node server, so it needs a Node host (**GitHub Pages cannot run it**). Any of these work:

- **Render / Railway / Fly.io:** connect the repo, set the start command `npm start`, add the env vars and attach a persistent disk mounted at `DATA_DIR`. The database and uploads live there.
- **VPS (Ubuntu):** `npm ci --omit=dev`, run it with `pm2` or systemd, and put Nginx or Caddy in front for HTTPS. Set `TRUST_PROXY=true`.

Back up `DATA_DIR`, which holds `epic.db` and `uploads/`.

---

## Project structure

```
public/                    storefront (static, no build step)
  index.html               app shell: loader, nav, footer, cart drawer, search, SVG sprite
  assets/css/              core.css (launch design system) + store.css
  assets/js/app.js         boot: loader, router, cursor, particles
  assets/js/lib/           dom, api, store (cart/wishlist/catalog), fx, loader, router
  assets/js/ui/            product card, cart drawer, search, image search, dialogs, toasts
  assets/js/pages/         one lazily loaded module per page
  assets/img/products/     AVIF + WebP, 480/960 widths, 4:5
server/
  index.js                 Express app: static files, API, admin gate, SEO-injected SPA shell
  config.js  db.js  seed.js  catalog.js  auth.js  security.js  validate.js  orders.js  seo.js
  payments/                provider registry + M-PESA (Daraja STK Push + simulator)
  routes/                  public, account, checkout, admin APIs
  admin-ui/                admin login + CMS (served only to admins)
  scripts/create-admin.js
tools/process-images.sh    raw photo → 4:5 AVIF/WebP at 480 & 960
```

### Adding product photos

```bash
tools/process-images.sh raw/photo.jpg <product-slug>      # writes public/assets/img/products/<slug>/<n>-{480,960}.{avif,webp}
```

Use `IDX=2 tools/process-images.sh raw/back.jpg <product-slug>` to add a second (third…) photo. You can also upload photos in **Admin → Products**.

Replacing an existing photo in place? Catalogue images are cached for 30 days, so bump `IMG_V` in `public/assets/js/lib/dom.js` (e.g. `?v=2` → `?v=3`) so visitors get the new file straight away.

### Adding a new drop from code

New collections and products can ship with a deploy by adding an entry to `DROPS` in `server/seed.js`. For example, `2026-09-epic-evening` adds the EPIC Evening collection and its four dresses.

- Each drop is applied once per database on start-up and recorded under the `_seed_drops` key. Existing live stores receive it on their next restart.
- Anything an admin edits or deletes afterwards is never overwritten.
- Put the images in `public/assets/img/products/<slug>/`. Collection banners go in `public/assets/img/collections/<slug>/`.

---

© 2026 EPIC WEAR. All rights reserved. · +254 742 850 266
