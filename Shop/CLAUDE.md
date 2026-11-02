# StyleMint Shop (`Shop/`)

Buyer-facing web shop + installable PWA for people arriving from social links. Served at
`https://stylemint.voyageritnepal.com/shop/` (Vite `base: '/shop/'`, router basename `/shop`) **by the API**
from a host folder — see README "Build, serve, deploy". Contract (source of truth):
`D:\Stylemint\wt\shop-bundles-contract.md` section A (+ B6/B7/B8 for bundles). Re-read its Changelog before
changing behaviour; record deviations there as a `web-shop` line.

## Stack

Vite 5 · React 18 · TypeScript strict · React Router 6 · TanStack Query 5 · Vitest + Testing Library.
**No UI framework** (no Mantine, no icon pack): plain CSS in `src/styles.css` so the initial JS stays well under
250 KB gzipped. Look: dark green `#092A17`, mint `#2ECC71`, reels-first, big images, sticky buy bar
(`BuyBar`), mobile-first max width 560 px. Pages after the first tap (sign-in, checkout, pay return, placed)
are lazy chunks.

## Commands — run on the VPS only, never on Windows

```bash
# from Windows: tar Shop/ (no node_modules/dist), copy to ~/web-shop/ on the VPS, then there:
docker run --rm --cpus=2 --memory=2g -v ~/web-shop/Shop:/app -w /app node:22-alpine sh -c \
  "npm ci && npm run typecheck && npm run lint && npm test -- --run && npm run build"
# clean up (files are root-owned):
docker run --rm -v ~:/h alpine rm -rf /h/web-shop
```

Deploy: `sh Shop/deploy/deploy-shop.sh` on the VPS (build + rsync to `/home/administrator/stylemint-shop/dist`).
Never touch nginx or the live containers from here.

## API rules

- Same origin `/v1/...`; `src/api/client.ts` is a copy of Seller Center's client: bearer token, one
  refresh-and-retry on 401, `Idempotency-Key` on every mutation (stable keys for guest-cart replay and place),
  RFC 7807 → `ApiError` (`code` = `errorCode`). camelCase, enums are integers.
- Public reads use `{ anonymous: true }`. Endpoints that may not be deployed yet (bundles, reel tagged-bundles,
  vendor bundles, cart hand-off, `/v1/cart/bundles*`) must degrade on a bare 404 (`isMissingEndpoint`): hide the
  rail / say "not available", never crash.
- Cart lines carry no vendor id today: group by shop via the public product (`['product', id]` query).
- Order lines have no product id; sub-orders have no vendor name (look it up with `/v1/public/brands/{id}`).

## Auth (`src/auth/`)

Access token in memory, refresh token in localStorage (`sm.shop.rt`), single-flight refresh behind Web Locks,
silent refresh at 80 % TTL. No role gate. In-app browser detection in `inApp.ts`; full-page navigations go
through `lib/nav.ts` (one seam for tests).

## Storage keys

`sm_shop_attr` (attribution, 7 days) · `sm_shop_cart` (guest cart payloads) · `sm_shop_checkout` (checkout
session id across the eSewa round trip) · `sm_shop_last` (last viewed page) · `sm.shop.rt` · `sm.shop.device`.

## Layout

```
pwa/                 sw.js template + Vite plugin that emits dist/sw.js with the precache list
public/              manifest, offline page, icons
src/api/             client, catalog (public), cart, checkout (+ addresses), orders
src/auth/            session, OTP/social endpoints, provider SDK loaders, in-app detection
src/shop/            attribution, guest cart (+ replay), cart hooks, hand-off
src/pages/           one file per route (+ tests)
src/test/            setup, mockApi, fixtures
```

## Tests

`flow.test.tsx` (product → guest cart → phone sign-in → replay with attribution → checkout COD → placed; eSewa
redirect; address validation), `auth/inApp.test.tsx` (UA detection, intent URL, banner, hand-off),
`shop/attribution.test.ts`, `pages/BundlePage.test.tsx`, `pages/PayReturnPage.test.tsx`. `mockApi` answers an
unmatched route with a bare 404, like an undeployed endpoint.
