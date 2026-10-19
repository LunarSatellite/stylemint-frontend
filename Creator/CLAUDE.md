# StyleMint Creator Studio (`Creator/`)

Creator-facing web app: reels (import, product tagging, publish), studio tools, analytics, brand
partnerships / briefs / campaigns, earnings and payouts, public profile and storefront, community and
settings. Served at `https://stylemint.voyageritnepal.com/creator/` (Vite `base: '/creator/'`, router
basename `/creator`). Many creators use it on a phone — every list has a card layout below the `sm`
breakpoint, details open in a bottom sheet, and the shell has a bottom tab bar.

It is the creator counterpart of Seller Center (`../Brand/`). The foundation (auth, HTTP client, shell,
state blocks, theme) was **copied** from Brand — never import across apps, they build separately — and
then adapted. Do not modify `../Admin/` or `../Brand/` from work on this app.

The previous spec that lived here (Tailwind/Radix/Zustand/axios, `.claude/stylemint-creator-fe/`) was
replaced on 2026-10-13 by this Mantine app, matching Seller Center. Its product rules that still hold
are kept under "Rules" below.

## Stack

Vite 5 · React 18 · TypeScript strict · Mantine 7 (core, dates, notifications, modals, dropzone) ·
React Router 6 · TanStack Query 5 · zod · @tabler/icons-react · @microsoft/signalr (lazy-loaded) ·
Vitest + Testing Library.

Design = Voyager CX, identical tokens to Seller Center: forest palette (primary filled `#00784f`), slate
neutrals, Inter Variable, headings 650, radius 12 (sm 8, lg 16), page `#f4f7f5`, text `#0d1f18`, input
fill `#eef3f0` / border `#d5e0da`, soft layered shadows, light + dark. Tokens: `src/theme.ts` (Mantine)
and `src/index.css` (`--sm-*` CSS variables).

## Commands

```bash
npm ci
npm run dev        # http://localhost:5175/creator/ — proxies /v1, /api, /hubs to VITE_DEV_API (default production)
npm run typecheck
npm run lint
npm test -- --run
npm run build      # dist/ for the /creator/ base path
```

## API

- Same origin: every call is `/v1/...` (nginx proxies it); the tag picker is `GET /v1/tag-picker/items`
  (products + service items: hotel stays, travel packages, bank products, with `displayPrice.label`;
  service-items-contract.md v1) and, while that 404s, the older product search
  `/api/v1/customer/search`. No base URL env var, no CORS, no secrets.
- `src/api/client.ts` is the only HTTP client: bearer token, one refresh-and-retry on 401,
  `Idempotency-Key` (fresh UUID) on every POST/PUT/PATCH/DELETE, RFC 7807 → `ApiError`
  (`code` = backend `errorCode`, message from `title`/`detail`/`errors`).
- **Wire format:** camelCase; StyleMint enums are **integers** except where a DTO declares strings.
  Enum maps live next to the endpoints in each feature's `api.ts`, always with `labelOf()` so an
  unknown value renders "Unknown (n)" rather than crashing. Cursor paging
  `PagedResult<T> { items, totalCount, nextCursor, hasMore }` → `useCursorList`.
- Optional features hide themselves when the endpoint 404s with no errorCode (`isMissingEndpoint`).
- Each feature has `api.ts` (typed endpoints, shapes copied from the backend view models — read the
  controller + VM before changing one; never guess a field) and pages. Endpoint ↔ screen table:
  README.md.

## Buyer privacy

Buyers' phone numbers and email addresses are never displayed. `src/lib/redact.ts`:
the client drops every contact-named string field from every response (`privacy: 'contact-fields'`,
the default); endpoints that carry text written by other people (comments, tip messages, notifications,
activity, story replies) pass `privacy: 'mask-text'`, which also masks emails / phone numbers inside
text. Only the creator's own account (`GET /v1/accounts/{self}`) uses `privacy: 'none'`.

## Auth (`src/auth/`) — same model as Seller Center

- Email or phone (normalised to `+977…`) + password → `POST /v1/auth/login`.
- "Sign in with a code": `POST /v1/auth/login-otp/request` → `/verify`; then
  `GET /v1/registration/{id}/status` and, if `hasPassword` is false, the mandatory "Create your
  password" step with the **authenticated** `PUT /v1/accounts/{id}/password`. Never call
  `/v1/registration/{id}/set-password`.
- Google / Apple / Facebook: `GET /v1/auth/oauth/web-config` decides which buttons show (null/404 →
  none); SDK token → `POST /v1/auth/oauth/{provider}/native` (raw nonce for Google/Apple, whose
  hex SHA-256 the provider put in the token). No forced password after a social sign-in.
- Role gate: JWT `roles` must contain `Creator`. Otherwise `/application` shows the creator
  application (`GET /v1/creator/application`) or "apply in the StyleMint app".
- Access token in memory; refresh token in sessionStorage (localStorage only with "keep me signed in");
  refresh is single-flight across tabs (Web Locks); sign-out revokes only this session.

## Layout

```
src/api/            client, paging, useCursorList
src/auth/           session store, auth endpoints, social sign-in, JWT, identifier + password policy
src/components/     Shell (AppShell + bottom tab bar), PageHeader, SectionCard, KpiTile, StateBlocks,
                    DataList (table ↔ cards), DetailSheet (drawer ↔ bottom sheet), Pager…
src/lib/            format (money "Rs 1,234", dates, percent), redact, notify, live (SignalR), useTab
src/features/<area> api.ts + pages + tests
```

## Rules

- Every data surface: loading skeleton, error block with retry, empty state. "Could not load" is never
  shown as "none" (`QueryState` / `ErrorBlock` / `EmptyBlock`).
- Destructive or brand-visible actions confirm first. Toast on success.
- Money via `formatMoney` ("Rs 1,234"), never hand-formatted. Fractions via `formatPercent`.
- Studio `/analyze` answering 429 is not the creator's fault: soft "still working" message, never the
  generic error.
- Recipe citation answering `state.duplicate` means "already cited": swallow it silently.
- Boost offers are free to accept — never show payment UI for them.
- Audio items link out to `externalListenUrl`; no inline playback.
- Stitched-reel suggestions and other optional AI fields may be null: degrade, never crash.
- Uploads: the site caps request bodies at 25 MB; check size client-side before sending.
- No `dangerouslySetInnerHTML`. No auth tokens in localStorage unless "keep me signed in".
- All pages are lazy routes.
