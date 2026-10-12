# StyleMint Admin (web)

The operations console for StyleMint, served at `https://stylemint.voyageritnepal.com/admin/`.
Vite + React 18 + TypeScript + Mantine 7 + TanStack Query + React Router, styled to match Voyager CX
(forest palette, Inter, the same app shell, cards, tables and states).

It talks to the StyleMint API on the **same origin** (`/v1/admin/...`) with the admin JWT - no API
URL, no CORS.

## Sign-in

Only the email addresses of existing, enabled admin accounts can sign in, whichever way they do it
(`wt/admin-login-contract.md`). The sign-in page asks `GET /v1/admin/auth/methods` what to show and
hides a provider the server reports as `null`:

- **Continue with Google** - Google Identity Services (ID token flow, popup). Google's own button
  is rendered with the `clientId` from `/methods`; the ID token goes to `POST /v1/admin/auth/google`.
  In the Google Cloud OAuth client, add `https://<host>` as an authorised JavaScript origin.
- **Continue with Facebook** - the Facebook JS SDK (`FB.login`, `scope=email`) with the `appId` from
  `/methods`; the user access token goes to `POST /v1/admin/auth/facebook`. In the Facebook app, add
  `https://<host>/admin/` under Facebook Login → Allowed domains for the JavaScript SDK.
- **Email + password** - `POST /v1/admin/auth/password`. "Forgot password?" posts
  `/v1/admin/auth/password/reset-request` and always shows the same "if that email belongs to an
  admin" answer. The emailed link (and a Super Admin's invitation link) opens
  `/admin/set-password?token=…`, which checks the rules live (12+ characters, a letter and a digit)
  and posts `/v1/admin/auth/password/set`.

The two SDKs are loaded only on the sign-in page and only for a configured provider. Refusals are
`admin_auth.invalid_credentials` (one message, nothing enumerable), `admin_auth.locked` (15 minutes,
with `Retry-After`) and `admin_auth.method_unavailable`.

**Other ways to sign in** (folded away below the form, shown only when configured - `/methods`
reports `sso` and `accessKey`):

- **Single sign-on** (OIDC, authorization code + PKCE, or implicit `id_token`) against the IdP the
  backend's `Admin:Oidc:Authority` trusts, exchanged at `POST /v1/admin/auth/sso { idToken }`.
  Shown when `/methods` does not say `"sso": false` and the console has the IdP settings:
  `/admin/config.json` (see `public/config.example.json`) or `VITE_SSO_*` at build time. The
  `clientId` must be the IdP app whose audience the backend accepts, with
  `https://<host>/admin/sso/callback` as a redirect URI.
- **Access key**: the environment's `Admin:Oidc:DevSharedSecret` (env `ADMIN_DEV_SSO_SECRET`),
  shown when `/methods` says `"accessKey": true` (if the server does not say, `"accessKey": true`
  in `config.json` or `VITE_ADMIN_ACCESS_KEY=true` decides). It is posted once and never stored.

Against an API that predates `/methods` (a bare 404) the page offers single sign-on and the access
key as before, since those are then the only ways in.

Super Admins invite people from **Platform → Admins & roles → Invite admin** (email, display name,
roles; asks for the authenticator): `POST /v1/admin/admins/invite` emails a set-password link valid
for 72 hours. When the server could not deliver the email it returns the link once; the dialog shows
it with a copy button and forgets it on close. The list shows each admin's sign-in methods and when
(and how) they last signed in.

There is **no refresh token** on the admin API. The session (token + expiry) lives in memory and in
this tab's `sessionStorage` (survives a reload, gone with the tab, never in localStorage or a
cookie). Five minutes before expiry an SSO session renews silently through the IdP (`prompt=none` in a
hidden iframe) or offers a one-click renewal - Google, Facebook, password and key sessions ask the
operator to sign in again; a 401 that cannot be recovered ends the session with a
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
src/auth/        session (Google / Facebook / password / SSO exchanges, storage, expiry), thirdParty (lazy SDK loaders), oidc (PKCE), stepUp, roles, guards
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

`npm run build` writes `dist/` for the `/admin/` base path. Copy its contents to the web root's
`admin/` folder (below: `/var/www/stylemint/admin/`), optionally with a `config.json` next to
`index.html` (single sign-on, access key). The API stays where it is; `/v1` is already proxied.

nginx, inside the `server` block for `stylemint.voyageritnepal.com`, before the catch-all API
`location /`:

```nginx
location = /admin { return 301 /admin/; }

location /admin/ {
    root /var/www/stylemint;              # serves /var/www/stylemint/admin/...
    try_files $uri $uri/ /admin/index.html;

    # index.html (and every SPA route) must never be cached; hashed assets below may be.
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    # Google sign-in: script, button iframe and stylesheet under accounts.google.com/gsi/.
    # Facebook sign-in: SDK from connect.facebook.net, its frames on www.facebook.com, Graph calls.
    # Inline styles are Mantine's (CSS variables, positioning); scripts stay 'self' only.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com/gsi/ https://graph.facebook.com https://www.facebook.com; frame-src https://accounts.google.com/gsi/ https://www.facebook.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'" always;

    location /admin/assets/ {
        # A nested add_header replaces the parent's, so the security headers are repeated here.
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }
}
```

Notes on the policy:

- Do not send `Cross-Origin-Opener-Policy: same-origin` for `/admin/`: the Google and Facebook
  popups need to talk back to the page (`same-origin-allow-popups` is fine).
- With single sign-on configured, add the IdP's origin (e.g. `https://login.microsoftonline.com`)
  to `connect-src` (discovery and token endpoint) and to `frame-src` (silent renewal).
- `img-src https:` covers the R2 media domain that KYC documents and product images come from.
- The API's own responses keep their `default-src 'none'` policy; this block only governs the
  console's pages.
- If a browser reports a blocked Facebook frame from another `facebook.com` host in some region,
  add that exact host to `frame-src` rather than a wildcard.
