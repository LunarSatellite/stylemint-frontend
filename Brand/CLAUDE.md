# StyleMint Seller Center (`Brand/`)

Vendor-facing web app: orders, products, delivery, payouts, returns/questions and store settings
for StyleMint sellers. Served at `https://stylemint.voyageritnepal.com/seller/` (Vite `base: '/seller/'`,
router basename `/seller`). Many sellers use it on a phone — every list has a card layout below the
`sm` breakpoint and the shell has a bottom tab bar.

The previous "Brand Studio" spec that lived here (briefs, creator partnerships, Tailwind/Radix) was
replaced on 2026-10-12 by the decisions in `D:\Stylemint\wt\web-apps-plan.md`.

## Stack

Vite 5 · React 18 · TypeScript strict · Mantine 7 (core, dates, notifications, modals, dropzone) ·
React Router 6 · TanStack Query 5 · zod · @tabler/icons-react · @microsoft/signalr (lazy-loaded) ·
Vitest + Testing Library.

Design = Voyager CX (`~/voyager/cx/apps/admin-web` on the VPS, read-only): forest palette, slate
neutrals, Inter Variable, headings 650, radius 12, soft shadows, accent rails. Tokens live in
`src/theme.ts` (Mantine) and `src/index.css` (`--sm-*` CSS variables, light + dark). The Admin app
uses the same values.

## Commands — run on the VPS only, never on Windows

```bash
# from Windows: copy Brand/ (no node_modules/dist) to ~/web-seller-check/ on the VPS, then there:
docker run --rm -v ~/web-seller-check:/app -w /app node:22-alpine sh -c \
  "npm ci && npm run typecheck && npm run lint && npm test -- --run && npm run build"
```

Scripts: `dev` (proxies `/v1` + `/hubs` to `VITE_DEV_API`, default production), `build`,
`typecheck`, `lint`, `test`.

## API

- Same origin: every call is `/v1/...` (nginx proxies it). No base URL env var, no CORS.
- `src/api/client.ts` is the only HTTP client: bearer token, one refresh-and-retry on 401,
  `Idempotency-Key` (fresh UUID) on every POST/PUT/PATCH/DELETE, RFC 7807 → `ApiError`
  (`code` = backend `errorCode`, message from `title`/`detail`/`errors`).
- **Wire format:** camelCase; StyleMint enums are **integers** (sub-order state, product state,
  identifier type…) except where a DTO declares strings (delivery-routing states, rider-rating tags,
  EMI `approvalMode`). Cursor paging: `PagedResult<T> { items, totalCount, nextCursor, hasMore }` —
  use `useCursorList` for page-by-page navigation.
- No server-side search on orders/products: the UI fetches a 100-item page and filters locally.
- Optional features (EMI, rider profile) hide themselves when the endpoint 404s with no errorCode
  (`isMissingEndpoint`).

## Auth (`src/auth/`)

- Sign-in: email or phone (normalised to `+977…` E.164) + password → `POST /v1/auth/login`
  (`identifierType` 1 Email / 2 Phone, `deviceFingerprint`, `devicePlatform: 3`).
- "Sign in with a code": `POST /v1/auth/login-otp/request` → `/verify` (5 digits). Then
  `GET /v1/registration/{id}/status`; if `hasPassword` is false the seller must create one with the
  **authenticated** `PUT /v1/accounts/{id}/password`. Never call the anonymous
  `/v1/registration/{id}/set-password`.
- "Continue with Google / Apple / Facebook" (`src/auth/social.ts`, `src/auth/thirdParty.ts`,
  `features/auth/SocialSignIn.tsx` + `ProviderButtons.tsx`): buttons only for providers
  `GET /v1/auth/oauth/web-config` reports (404 → none); SDKs lazy-loaded on the login page only;
  token → `POST /v1/auth/oauth/{provider}/native` → same `establish()` with `checkPassword: false`
  (no forced password). CSP for the SDK origins: README "Deploy".
- Role gate: JWT `roles` must contain `Vendor`; otherwise `/application` shows the vendor
  application (`GET /v1/vendor/application`) or "not a seller account".
- Access token in memory; refresh token in sessionStorage (localStorage with "keep me signed in").
  Refresh is single-flight and serialised across tabs with the Web Locks API, because the backend
  rotates refresh tokens and revokes the session on reuse. Silent refresh at 80 % of the TTL.
- Sign out revokes only this session (`POST /v1/accounts/{id}/sessions/{sid}/revoke`); "Sign out
  everywhere" uses `POST /v1/auth/logout {allSessions:true}`.

## Live updates

`src/lib/live.ts` connects to `/hubs/notifications` (`live` events, see
`D:\Stylemint\wt\realtime-contract.md`) and invalidates `['orders']`, `['delivery']`, `['home']`.
Order screens also poll (30 s lists, 15 s moving order detail, 5 s open delivery request).

## Layout

```
src/api/            client, paging types, useCursorList
src/auth/           session store, auth endpoints, JWT, identifier + password policy
src/components/     Shell (AppShell + bottom tab bar), PageHeader, SectionCard, KpiTile, StateBlocks, Pager…
src/features/<area> api.ts (typed endpoints) + pages + components + tests
```

## Rules

- Every list: loading skeleton, error block with retry ("could not load" is never shown as empty),
  empty state, paging. Destructive or customer-visible actions confirm first. Toast on success.
- Money via `formatMoney` ("Rs 1,234"), never hand-formatted.
- No `dangerouslySetInnerHTML`. No auth tokens in localStorage unless "keep me signed in".
- Do not touch `../Admin/` (separate app, separate branch).
