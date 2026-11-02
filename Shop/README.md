# StyleMint Shop (web)

The buyer web shop for people arriving from Instagram, Facebook and TikTok: open a shared reel / product /
bundle / shop link, add to cart, sign in (Google, Facebook or a phone code), pay with eSewa or cash on
delivery, then get sent to the app to track the order. Installable PWA. Served at
`https://stylemint.voyageritnepal.com/shop/` **by the API itself** (no nginx change). Contract:
`D:\Stylemint\wt\shop-bundles-contract.md`, section A. Conventions: `CLAUDE.md`.

## Pages (router basename `/shop`)

| URL | Page |
|---|---|
| `/shop/r/{reelId}` | Reel full screen (muted autoplay) with its tagged products and bundles; a tap opens the item with the reel tag as attribution |
| `/shop/p/{productId}` | Gallery, price (flash-sale strike-through), variant chips, seller row, sticky **Add / Buy now** bar |
| `/shop/b/{bundleId}` | Bundle: items from several shops, variant picker per item, prices per contract B7, **Add bundle to cart** |
| `/shop/s/{vendorAccountId}` | Shop: cover, logo, bundles rail, product grid |
| `/shop/cart` | Guest cart (localStorage) or the account's cart; grouped by shop, bundle cards on top |
| `/shop/signin?next=` | Google / Facebook / phone code; in-app-browser banner |
| `/shop/checkout` | Address (saved or new, GPS pin or Maps link) → delivery → eSewa / COD → place |
| `/shop/pay/return?payment=success\|pending\|failed&o=` | eSewa return: success → placed page; pending → polls the saved session; failed → retry / COD |
| `/shop/orders/{orderNumber}/placed` | Order number, one parcel per shop, store buttons, **Open in app** → `/app/orders/{no}` |
| `/shop/` | Last viewed reel/product/bundle/shop, or a minimal landing |

## Attribution

`?t={taggedProductId|taggedBundleId}&ref={affiliateCode}&utm_*=` on any entry URL is stored as `sm_shop_attr`
(localStorage, 7 days, last click wins). `ref` goes on every add as `affiliateCode`; `t` goes only on the item
it was shared for (`reelTagContextId` for a product, `taggedBundleId` for a bundle). The reel page writes the
tag of the item tapped.

## Sign-in and in-app browsers

- Providers: `GET /v1/auth/oauth/web-config` (404 → phone only). Google = GIS popup with a SHA-256 nonce;
  Facebook = JS SDK `FB.login`; the token goes to `POST /v1/auth/oauth/{google|facebook}/native`. Phone =
  `POST /v1/auth/login-otp/request|verify` (`identifierType: 2`, `+977…`). 409 → "Sign in with your phone
  number". No role gate: new accounts are customers.
- In-app browsers (UA `Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Snapchat|Line/`)
  hide Google and show "Open in your browser to sign in with Google". Android: **Open in Chrome** →
  `intent://…&restore={token}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=…;end`.
  iOS: "Tap ··· → Open in browser" + **Copy link**. Facebook stays inside Facebook/Messenger. Phone always works.
- Cart hand-off: `POST /v1/public/shop/cart-handoff {lines, bundles, attr}` → `{token}`; the reopened page
  redeems `?restore={token}` once (`GET …/cart-handoff/{token}`) and drops it from the URL. A missing endpoint
  just means the link has no token.
- The guest cart is the add-call payloads; after sign-in each is replayed to `POST /v1/cart/lines` /
  `POST /v1/cart/bundles` with its own `Idempotency-Key`, added to whatever the account already has.

## Checkout

`POST /v1/checkout/sessions {"surface":"shop"}` → `GET /v1/addresses` (or `POST /v1/addresses`, which needs
lat/lng or a Maps link) → `POST …/address {addressId}` + `POST …/delivery` → `GET …/delivery-options` →
`POST …/payment-method {paymentMethod: 3 eSewa | 4 COD}` → `POST …/place` (stable Idempotency-Key per attempt).
COD answers with `orderNumber` → placed page. eSewa answers with `paymentRedirectUrl` → full-page redirect; the
session id is kept in `sm_shop_checkout` because the return URL carries none. `422 bundle_unavailable` offers
"Remove bundle" / "Buy items separately"; `422 method_not_available_on_web` is explained.

## PWA

`manifest.webmanifest` (StyleMint Shop, start/scope `/shop/`, standalone, 192/512 + maskable icons) and `sw.js`,
generated at build time by `pwa/swPlugin.ts` from `pwa/sw.js`: precaches the app shell only (index.html, hashed
assets, offline page, manifest, icons); `/v1/*` and `/payments/*` network-only; images stale-while-revalidate,
60 entries max; no push, no background sync. Registered in production builds only.

## Build, serve, deploy

- Build **on the VPS only** (never `npm` on Windows): `deploy/deploy-shop.sh` runs `npm ci`, typecheck, lint,
  tests and build in `node:22-alpine`, then rsyncs `dist/` to `/home/administrator/stylemint-shop/dist`.
- The API serves that folder at `/shop/` (`ShopSpaEndpoints`, `Shop:RootPath`, default `/app/shop`, mounted
  read-only from `/home/administrator/stylemint-shop/dist`): hashed `/shop/assets/*` immutable for a year,
  `index.html` and `sw.js` `no-cache`, `sw.js` with `Service-Worker-Allowed: /shop/`, every other `/shop/*`
  path → `index.html`. A shop release is an rsync — no API rebuild.
- CSP / COOP / Permissions-Policy for `/shop/*` are set by the API (contract A3). The app needs: scripts from
  `accounts.google.com/gsi/client` and `connect.facebook.net`, `geolocation=(self)` for the address pin,
  images from the R2 public host.
- `VITE_APP_STORE_URL` (optional, build time): the App Store listing; defaults to an App Store search for
  "StyleMint" until the listing id is known. Google Play uses `app.stylemint.stylemint_mobile_frontend`.
