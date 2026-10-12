# StyleMint Admin (web)

The operations console for StyleMint, served at `https://stylemint.voyageritnepal.com/admin/`.
Vite + React 18 + TypeScript + Mantine 7 + TanStack Query + React Router, styled to match Voyager CX
(forest palette, Inter, the same app shell, cards, tables and states).

It talks to the StyleMint API on the **same origin** (`/v1/admin/...`) with the admin JWT - no API
URL, no CORS.

## Sign-in

`POST /v1/admin/auth/sso { idToken }` turns an identity token into an admin JWT (60 min by default).
Two ways to get the identity token:

- **Single sign-on** (OIDC, authorization code + PKCE, or implicit `id_token`) against the IdP the
  backend's `Admin:Oidc:Authority` trusts. Configure the console at deploy time with
  `/admin/config.json` (see `public/config.example.json`) or at build time with `VITE_SSO_*`.
  The `clientId` must be the IdP app whose audience the backend accepts, with
  `https://<host>/admin/sso/callback` as a redirect URI.
- **Access key**: the environment's `Admin:Oidc:DevSharedSecret` (env `ADMIN_DEV_SSO_SECRET`),
  for environments without an IdP. It is posted once and never stored.

There is **no refresh token** on the admin API. The session (token + expiry) lives in memory and in
this tab's `sessionStorage` (survives a reload, gone with the tab, never in localStorage or a
cookie). Five minutes before expiry the console renews silently through the IdP (`prompt=none` in a
hidden iframe) or offers a one-click renewal; a 401 that cannot be recovered ends the session with a
reason (expired / revoked / security), and logout is broadcast to other tabs.

A new SSO user is auto-registered **with no roles**; they see a "waiting for access" screen until a
Super Admin grants one (Platform → Admins & roles). Roles come from the JWT `admin_role` claim and
drive the menu and route guards (`src/auth/roles.ts`, copied from the controllers'
`[RequireAdminRole]` attributes). The server authorises every call again.

Sensitive writes (`[RequireStepUpMfa]`: role grants, disabling admins, ending their sessions,
resetting their MFA, forcing payouts) answer `403 admin.step_up.required`; the console asks for a
TOTP code once (`POST /v1/admin/auth/mfa/totp/verify`) and replays the write. Operators enrol TOTP
under **My security**.

## Develop and check

```bash
npm ci
npm run dev          # http://localhost:5180/admin/, /v1 proxied to VITE_DEV_API
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

For this repository the checks run on the build host in Docker (never on the Windows workstation):

```bash
docker run --rm -v ~/web-admin-check:/app -w /app node:22-alpine \
  sh -c "npm ci && npm run typecheck && npm run lint && npm test -- --run && npm run build"
```

`src/api/request-bodies.json` freezes the request-body field names from the backend's OpenAPI spec;
`request-bodies-match-the-spec.test.ts` runs the real API client against a recording fetch and fails
if a write sends a field the endpoint would silently ignore. Regenerate it with
`npm run contract:extract -- path/to/swagger.json`.

## Layout

```
src/api/         one typed module per area; client.ts (fetch, bearer, Idempotency-Key, 401 handling), errors.ts, paging.ts
src/auth/        session (SSO exchange, storage, expiry), oidc (PKCE), stepUp, roles (capabilities), guards
src/components/  Shell (AppShell + sidebar), DataTable, DetailDrawer, ActionDialog (reason + confirm + step-up + toast), state blocks
src/features/    one folder per page
```

Every list is `DataTable` + `useListState` (page, size, search, filters and the open item live in the
URL) + a `DetailDrawer`; every write goes through `useActionDialog` (states the consequence, collects
the audit reason, handles step-up, toasts). Loading, error, forbidden and empty are distinct states -
"could not load" is never shown as "none".

## Endpoints from `feat/admin-api-gaps` (built against `wt/admin-api-contract.md`)

Until that backend branch is deployed these answer a bare 404 and the pages degrade - nothing is faked:

- `GET /v1/admin/dashboard/summary` - the dashboard counts each work queue from its own list meanwhile.
- `GET /v1/admin/vendors`, `/{id}`, `/{id}/suspend|reinstate` - Vendors falls back to onboarding applications.
- `GET /v1/admin/products`, `/{id}`, `/{id}/unpublish|restore` - Products says it is not available yet.
- KYC `applicantKind = 4` (riders in the unified queue) and moderation `targetKind = 6` (products) are
  understood; the Riders tab keeps using the courier endpoints, which work before and after.

The API has no order-by-id, order search, payment list, payout detail or customer detail endpoints.

## Deploy

`npm run build` writes `dist/` for the `/admin/` base path. Serve it as static files with an SPA
fallback to `/admin/index.html` (see the nginx block in the hand-off notes), and optionally drop a
`config.json` next to `index.html` to turn on single sign-on.
