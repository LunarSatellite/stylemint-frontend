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

## Customers & CRM (`src/features/crm/`)

Each seller has a private Lead360/OmniFlow CRM workspace (plan + backend contract:
`D:\Stylemint\wt\seller-crm-plan.md`, section "Backend notes").

- **Session** (`session.ts`): `POST /v1/vendor/crm/session` with the StyleMint token →
  `{ accessToken, expiresUtc, tenantId, role, businessName }`. CRM token in memory only, single-flight,
  re-requested 60 s before `expiresUtc` and on any CRM 401 (one retry); dropped on sign-out.
  404 / 503 `seller_crm.disabled` → "CRM is being set up"; 403 → not available.
- **Client** (`client.ts`): `/api/v1/crm/...` (nginx proxies `/api` to the same API). OmniFlow envelope
  `{ success, data, message }` / paged `{ data[], totalCount, pageNumber, pageSize, totalPages }` is
  unwrapped to `CrmPage<T>`; errors become the same `ApiError`. Integer enums, camelCase.
- **Buyer privacy**: every CRM response goes through `redactPii` — phone/email fields are dropped and
  phone numbers / emails inside text are masked. Never render buyer contact details; contact goes
  through StyleMint campaigns/surveys, only to buyers with marketing consent (show consent counts).
- **Roles** (`roles.ts`): vendor Owner/Admin → everything; Member → `Agent`: no delete, no segment
  discovery, no automations toggle, no survey sends. Use `IfCan` / `RequireCap` / `useCan`.
- Pages: Customers (`crm/seller/customers`), profile (seller customer + contact tags + merged
  timeline of activity events and sync signals, notes = comments, follow-up tasks, NPS/feedback,
  deals), Tasks & calendar, Segments (built-in + rule segments stored per workspace in this browser
  + AI segments), Campaigns & automations, Feedback, Deals & quotes, Reports. All lazy chunks.
- Every CRM query key starts with `'crm'` (`CRM_KEY`). Detail views use `DetailSheet` (bottom sheet
  on a phone).

## Insights (`src/features/insights/`)

Analytics for the seller (plan + endpoint inventory + contracts: `D:\Stylemint\wt\seller-insights-plan.md`,
"Backend notes"). Sidebar group "Insights" + phone tab; routes `/insights/{sales,products,demand,reels,
creators,promotions,customers}` (lazy chunks).

- **Range** (`period.ts`, `InsightsLayout.tsx`): preset or custom days + "compare to previous period", kept
  in the URL (`?range=30d`, `?from=…&to=…`, `&compare=0`) and remembered per tab in sessionStorage.
  Pages read it with `useRange()`; query keys use `rangeKey()` (days, never milliseconds).
- **Two data paths** (`contracts.ts` → `preferInsights`): the new vendor-scoped
  `GET /v1/vendor/insights/{sales,products,reels,creators,promotions,demand}` (inclusive Kathmandu days
  `from`/`to`, server-side previous period, plain NPR numbers) — and, while those 404 with no error code,
  the older endpoints (`api.ts`: `analytics/overview|products|creators`, `creator-performance`,
  `store/actions|digital-twin|sponsored`, `pricing/*`, `/api/v1/vendor/{demand-signals,intent-decision-board,unmet-demand}`,
  `reel-approvals`, `partnerships`, `campaign-workspaces`, `emi/products`). `model.ts` turns either into one
  view model per section. Widgets that only the new report can fill say "Coming soon", never "empty".
- Every response goes through `redactPii` (no buyer phone/email, even inside search text).
- **Widgets** (`components.tsx`): `Widget` = own loading / "could not load" + retry / coming soon / empty;
  `DataTable` = sortable table, card list on a phone, "Export CSV" (`csv.ts`: BOM, quoting, formula-safe);
  `KpiGrid`/`MetricTile` + `DeltaBadge` (percent or percentage points, `invert` where down is good).
- **Charts**: `@mantine/charts` (recharts) only inside `charts.tsx`, loaded with `React.lazy` from
  `components.tsx` — nothing else may import `@mantine/charts`, so the main bundle stays chart-free.
  Tests mock `@mantine/charts`.
- Customers links into the CRM areas the seller's CRM role allows (`useVisibleAreas`).

## Creators (`src/features/creators/`)

Plan + backend contract: `D:\Stylemint\wt\seller-creators-plan.md` ("Backend notes"). Routes under
`/creators/*`, sidebar group "Creators", phone chips (`CreatorsLayout`).

- Sections: Find creators (`vendor/matches`, `vendor/partnerships/creators`, public creator profile /
  reel-stats / rate-card, `vendor/creator-performance`), Partnerships (`vendor/partnerships*`, predict,
  insurance), Agreements (`vendor/agreements*`), Briefs & campaigns (`vendor/briefs*`, applications,
  `vendor/campaign-workspaces`), Retainers & squads (`vendor/retainers`, `retainers/{id}/*`,
  `vendor/squads*`), Content approvals (`vendor/reel-approvals*`), Payments (`vendor/creator-performance`
  + retainers).
- **Commission is a fraction on the wire** (0.15 = 15 %) in Partnerships, BrandStudio and agreement
  terms; match prefill uses basis points. Use `pct` / `commissionRange` / `toFraction` from `labels.ts`.
- Agreement detail on the wire is `{ agreement, versions, acceptances, timeline }`; `agreementsApi`
  flattens it (acceptances grouped per version). Signing echoes `{ versionNumber, termsHash }`.
  The counter-party's IP address is never rendered. A missing endpoint (404) shows "being set up".
- Confirmations inside the detail sheet use `confirmAction` from `creators/components` (z-index above
  the sheet), not the shared one.

## Rules

- Every list: loading skeleton, error block with retry ("could not load" is never shown as empty),
  empty state, paging. Destructive or customer-visible actions confirm first. Toast on success.
- Money via `formatMoney` ("Rs 1,234"), never hand-formatted.
- No `dangerouslySetInnerHTML`. No auth tokens in localStorage unless "keep me signed in".
- Do not touch `../Admin/` (separate app, separate branch).
