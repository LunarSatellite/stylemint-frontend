# StyleMint Seller Center (web)

The seller-facing web app, served at `https://stylemint.voyageritnepal.com/seller/` (Vite
`base: '/seller/'`). It talks to the StyleMint API on the **same origin** (`/v1/...`) — no API URL,
no CORS. Conventions and commands are in `CLAUDE.md`.

## Products: Try-on & sizes

The product editor has a "Try-on & sizes" step (after Delivery): a size chart editor (garment type,
cm/inch, one row per size, labels prefilled from the Size option) and a try-on image uploader
(front view, garment only, transparent PNG/WebP, ≥ 600 px shortest side, ≤ 5 MB — checked in the
browser before upload, and again by the server). Products with a Size option cannot be published
without a size chart; the try-on image is recommended. Until the backend ships the endpoints the
step says "Try-on setup is coming soon" and publishing is not blocked.

## Sign-in

- **Continue with Google / Apple / Facebook** — above the email/phone form, behind an "or" divider.
  The page asks `GET /v1/auth/oauth/web-config` which providers are web-ready and their public ids,
  and renders a button only for those (`null`, a missing id, or a 404 hides it; the form always
  stays). Each provider's script is loaded only on the sign-in page and only when its button shows:
  - **Google** — Google Identity Services, ID-token popup, Google's own button
    (`google.clientId`, initialised with the SHA-256 of a fresh nonce). In the Google Cloud OAuth
    client (the **Web** client, `Identity:OAuth:Google:WebClientIds`), add
    `https://stylemint.voyageritnepal.com` as an authorised JavaScript origin.
  - **Apple** — Sign in with Apple JS, popup mode (`apple.servicesId`, `apple.redirectUri`). The
    Services ID needs the domain `stylemint.voyageritnepal.com` and the return URL from
    `redirectUri` registered, and Apple's domain-verification file served at
    `/.well-known/apple-developer-domain-association.txt`. The page passes the SHA-256 of a fresh
    nonce to Apple and sends the raw nonce to the server; the person's name (Apple sends it only on
    the first authorization) goes along as `displayName`.
  - **Facebook** — the Facebook JS SDK, `FB.login({ scope: 'email' })` (`facebook.appId`). In the
    Facebook app, add the domain and `https://stylemint.voyageritnepal.com/seller/` under Facebook
    Login → Allowed domains for the JavaScript SDK. The SDK is initialised with
    `facebook.graphVersion` when web-config gives one. A declined email permission is explained and
    asked for again (`auth_type: 'rerequest'`) on the next try.

  The token goes to `POST /v1/auth/oauth/{google|apple|facebook}/native`
  (`{ identityToken, nonce, displayName?, deviceFingerprint, devicePlatform: 3, … }`; the raw
  `nonce` is required for Google and Apple — the server checks the token's `nonce` claim equals its
  lowercase hex SHA-256 — and not sent for Facebook), which answers
  with the same AuthResponse as a password sign-in, so tokens, refresh, the Vendor-role gate and the
  application-status screen are shared. A social sign-in does **not** force "create your password"
  (the Security page still offers it). An account without the Vendor role lands on "This account
  isn’t a seller account", told to sign in with the phone or email the shop was registered with.
- **Email or phone + password** — `POST /v1/auth/login`.
- **Sign in with a code** — `POST /v1/auth/login-otp/request` → `/verify`, then the mandatory
  "create your password" step when the account has none (authenticated
  `PUT /v1/accounts/{id}/password`).

## Deploy

`npm run build` writes `dist/` for the `/seller/` base path; its contents go to
`/var/www/stylemint-seller/`. The API stays where it is; `/v1` is already proxied.

nginx, inside the `server` block for `stylemint.voyageritnepal.com`, before the catch-all API
`location /`:

```nginx
location = /seller { return 301 /seller/; }

location /seller/ {
    alias /var/www/stylemint-seller/;
    try_files $uri $uri/ /seller/index.html;

    # index.html (and every SPA route) must never be cached; hashed assets below may be.
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    # Google sign-in: script, button iframe and stylesheet under accounts.google.com/gsi/.
    # Apple sign-in: script from appleid.cdn-apple.com; its popup and frames on appleid.apple.com.
    # Facebook sign-in: SDK from connect.facebook.net, its frames on www.facebook.com, Graph calls.
    # Live updates: the SignalR hub is same-origin (wss: on the same host is covered by 'self').
    # Inline styles are Mantine's (CSS variables, positioning); scripts stay 'self' plus the three SDKs.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client https://appleid.cdn-apple.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com/gsi/ https://appleid.apple.com https://graph.facebook.com https://www.facebook.com; frame-src https://accounts.google.com/gsi/ https://appleid.apple.com https://www.facebook.com; frame-ancestors 'none'; form-action 'self' https://appleid.apple.com; base-uri 'self'; object-src 'none'" always;

    location /seller/assets/ {
        # A nested add_header replaces the parent's, so the security headers are repeated here.
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }
}

# Apple's domain verification for the Services ID (nginx already serves /var/www/html/.well-known/).
location = /.well-known/apple-developer-domain-association.txt {
    root /var/www/html;
}
```

Notes on the policy:

- Do not send `Cross-Origin-Opener-Policy: same-origin` for `/seller/`: the Google, Apple and
  Facebook popups need to talk back to the page (`same-origin-allow-popups` is fine).
- `img-src https:` covers the R2 media domain product photos come from.
- `form-action https://appleid.apple.com` is only needed if Apple ever falls back from the popup to
  its form-post flow; the popup itself is a separate window and not governed by this policy.
- If a browser reports a blocked Facebook frame from another `facebook.com` host in some region,
  add that exact host to `frame-src` rather than a wildcard.
- As of 2026-10-13 the live `/seller/` sends no CSP (only `Cache-Control`, `Referrer-Policy` and
  `X-Frame-Options: SAMEORIGIN`), so nothing blocks the SDKs today; this block is what to apply
  when the policy is tightened.
