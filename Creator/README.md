# StyleMint Creator Studio (web)

The creator-facing web app, served at `https://stylemint.voyageritnepal.com/creator/` (Vite
`base: '/creator/'`). It talks to the StyleMint API on the **same origin** (`/v1/...`, plus
`/api/v1/customer/search` for product search) — no API URL, no CORS, no secrets. Conventions and
commands are in `CLAUDE.md`.

```bash
npm ci && npm run typecheck && npm run lint && npm test -- --run && npm run build
```

## Sign-in

Same model as Seller Center (`../Brand/README.md` has the provider set-up details):

- **Continue with Google / Apple / Facebook** — buttons only for providers
  `GET /v1/auth/oauth/web-config` reports (404 or null → hidden; the endpoint ships in lead360
  `release-20261013`). Token → `POST /v1/auth/oauth/{provider}/native`; raw nonce for Google and
  Apple. For this app add `https://stylemint.voyageritnepal.com/creator/` wherever Seller Center's
  `/seller/` URL is registered (Facebook allowed domains/URLs; Apple return URL from `redirectUri`).
- **Email or phone + password** — `POST /v1/auth/login` (phones normalised to `+977…`).
- **Sign in with a code** — `POST /v1/auth/login-otp/request` → `/verify`; an account without a
  password must create one with the authenticated `PUT /v1/accounts/{id}/password`.
- **Creator role gate** — the JWT `roles` must contain `Creator`. Otherwise `/application` shows
  the creator application (`GET /v1/creator/application`) or "apply in the StyleMint app". For an
  approved application whose role was never switched on, "Open Creator Studio" calls
  `POST /v1/creator/activate` and refreshes the session.

## Screens and the endpoints they use

| Route | Screen | Endpoints |
|---|---|---|
| `/` | Home | `GET /v1/creator/analytics/overview` (7 days), `GET /v1/earnings/balance?role=1`, `GET /v1/creator/boost-offers?state=1` + `POST …/{id}/accept`, `GET /v1/partnerships?states=1`, `POST /v1/partnerships/{id}/accept\|decline`, `GET /v1/creator/campaigns`, `GET /v1/creator/reels`, `GET /v1/social/accounts`, `GET /v1/accounts/{id}/creator-profile`, `GET /v1/creator/studio/tag-nudges`, `GET /v1/creator/studio/coaching/insight`, `GET /v1/creator/activity` |
| `/reels` | Reels | `GET /v1/creator/reels` |
| `/reels/import` | Import | `GET /v1/social/accounts`, `GET /v1/social/accounts/{slug}/content`, `POST /v1/creator/reels/import`, `POST /v1/creator/reels/import/bulk` |
| `/reels/:id` | Reel | `GET /v1/creator/reels/{id}`, `GET\|POST /v1/creator/reels/{id}/tagged-products`, `PUT\|DELETE …/tagged-products/{tagId}`, `GET /v1/tag-picker/items` (fallback `GET /api/v1/customer/search?type=products`), `GET /v1/creator/tag-products/commission`, `POST …/{id}/publish`, `POST …/{id}/submit-for-approval`, `GET …/{id}/approval-rounds`, `POST …/{id}/unpublish`, `PUT …/{id}/caption`, `DELETE /v1/creator/reels/{id}`, `GET /v1/creator/analytics/reels/{id}`, `GET …/{id}/post-publish-report`, `GET /v1/creator/stitched-reel-suggestions/by-reel/{id}` + acknowledge/dismiss, `GET /v1/creator/studio/recipes`, `POST\|DELETE /v1/creator/reels/{id}/cite-recipe` |
| `/studio` | Studio | `GET\|POST\|PUT\|DELETE /v1/creator/studio/drafts`, `POST /v1/creator/studio/analyze`, `GET /v1/creator/studio/recipes`, `GET /v1/creator/story-arcs` + accept/drop, `GET /v1/creator/studio/coaching/insight`, `GET /v1/creator/studio/collab-suggestions` |
| `/analytics` | Analytics | `GET /v1/creator/analytics/overview`, `…/report`, `…/top-reels` |
| `/partnerships`, `/partnerships/:id` | Partnerships | `GET /v1/partnerships`, `GET /v1/partnerships/{id}`, accept/decline, `GET …/{id}/terms/active`, `GET /v1/creator/partnerships/{id}/predict`, `GET /v1/creator/brands/{vendorProfileId}/partnership-record` |
| `/brands` | Find brands | `GET /v1/brands`, `GET /v1/brands/{accountId}`, `GET /v1/creator/matches` + dismiss/propose, `POST /v1/creator/partnerships/request` |
| `/briefs`, `/briefs/:id` | Briefs & campaigns | `GET /v1/creator/campaigns`, `GET /v1/creator/campaigns/{id}`, `POST …/{briefId}/applications`, `GET /v1/creator/campaigns/applications`, `POST …/applications/{id}/withdraw` |
| `/deals` | Squads & retainers | `GET /v1/creator/squads` + accept, `GET /v1/creator/retainers` + accept, `POST /v1/retainers/{id}/pause\|resume\|cancel` |
| `/rate-card` | Rate card | `GET\|POST\|DELETE /v1/creator/rate-card` |
| `/earnings` | Earnings | `GET /v1/earnings/balance`, `…/summary`, `…/entries`, `GET /v1/creator/analytics/top-reels`, `GET /v1/tips/balance`, `GET /v1/tips/history?type=received` |
| `/payouts` | Payouts | `GET /v1/payouts`, `POST /v1/payouts/on-demand`, `POST /v1/payouts/{id}/cancel`, `GET\|POST /v1/payout-destinations`, `POST …/{id}/default`, `DELETE …/{id}` |
| `/profile` | Public profile | `GET\|PATCH /v1/accounts/{id}`, `POST /v1/customer/me/avatar`, `GET\|PATCH /v1/accounts/{id}/creator-profile`, `POST /v1/creator/me/cover`, `GET\|POST\|DELETE /v1/accounts/{id}/creator-specializations` (+ primary), `GET /v1/public/categories`, `GET /v1/public/creators/{id}/reel-stats`, `GET /v1/follows/{id}/stats` |
| `/collections`, `/collections/:id` | Collections & looks | `/v1/creator/collections` (list, get, create, update, publish, archive, items add/remove/order) |
| `/social` | Social accounts | `GET /v1/social/accounts`, `POST /v1/social/connect/{slug}/begin`, `GET /v1/social/accounts/{slug}`, `DELETE …/{slug}`, `POST …/{slug}/refresh`, `GET /v1/social/accounts/audience-summary` |
| `/growth` | Tier & milestones | `GET /v1/creator/me/tier`, `GET /v1/creator/studio/launchpad`, `GET /v1/creator/me/milestones/unlocked` |
| `/community` | Stories, drops & live | `POST /v1/social/media`, `GET /v1/stories/by-author/{id}`, `POST /v1/stories`, `DELETE /v1/stories/{id}`, `GET /v1/live-commerce/mine`, `POST /v1/live-commerce` + start/end, `POST /v1/drop-parties` + go-live/end/cancel, `GET /v1/drop-parties/{id}`, `GET /v1/creator/studio/drop-party-prompt` |
| `/audio` | Audio library | `POST /v1/creator/audio/recommendations`, `POST /v1/creator/audio/interactions`, `GET /v1/creator/audio/trends` |
| `/activity` | Activity | `GET /v1/notifications/inbox` + read/read-all, `GET /v1/creator/activity` |
| `/settings` | Settings | password create/change, `GET /v1/accounts/{id}/sessions` + revoke, `GET\|PATCH /v1/accounts/{id}/notification-preferences/(toggles\|quiet-hours)` |

Live updates: SignalR `/hubs/notifications` (`live`, `notification`) refreshes home, inbox and
activity; screens also refetch on focus.

## Known backend gaps and quirks (worked around in the UI)

- **Boost offers** had no list endpoint — added in lead360 PR "CreatorStudio: list a creator's
  boost offers" (`GET /v1/creator/boost-offers`). Until it is deployed the Home card hides itself.
- **Social connect on the web**: after OAuth the backend always redirects to the app deep link
  (`stylemint://social-connected`). The page opens the provider in a popup and polls
  `GET /v1/social/accounts/{slug}` until the account is Active; a failed connect only shows as
  "never became Active". A validated web return URL would need a backend change.
- **Drop parties**: the server lists only parties that are live now and has no "my parties" list;
  parties scheduled here are remembered in this browser.
- **Campaign applications** store the creator's account id where a profile id is expected, so a
  partnership created when a brand accepts an application may not appear under Partnerships
  (backend fix needed). Insurance and per-partnership affiliate earnings have the same mix-up
  (403 for creators) and are not shown.
- No direct reel **video upload** exists: reels are imported by URL. Story media goes through
  `POST /v1/social/media`; the site caps request bodies at **25 MB**, checked before upload.
- Not available as endpoints: product suggestions for an unimported reel, clicks / add-to-carts
  in analytics (always 0 from the server; shown as "not measured yet"), a "my followers" list.

## Buyer privacy

Buyers' phone numbers and email addresses are never displayed: every response drops contact-named
fields, and text written by other people (tips, notifications, activity) is masked
(`src/lib/redact.ts`). A payout's destination, which the server returns unmasked, is masked.

## Deploy

`npm run build` writes `dist/` for the `/creator/` base path; its contents go to
`/var/www/stylemint-creator/`. `/v1`, `/api` and `/hubs` are already proxied to the API.

nginx, inside the `server` block for `stylemint.voyageritnepal.com`, before the catch-all API
`location /` (same pattern as `/seller/`):

```nginx
location = /creator { return 301 /creator/; }

location ^~ /creator/ {
    alias /var/www/stylemint-creator/;
    try_files $uri $uri/ /creator/index.html;

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
    # img-src https: covers the R2/CDN media of reels, products and social thumbnails.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client https://appleid.cdn-apple.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com/gsi/ https://appleid.apple.com https://graph.facebook.com https://www.facebook.com; frame-src https://accounts.google.com/gsi/ https://appleid.apple.com https://www.facebook.com https://www.youtube-nocookie.com https://www.tiktok.com https://www.instagram.com; frame-ancestors 'none'; form-action 'self' https://appleid.apple.com; base-uri 'self'; object-src 'none'" always;

    location ^~ /creator/assets/ {
        # A nested add_header replaces the parent's, so the security headers are repeated here.
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }
}
```

Notes:

- Do not send `Cross-Origin-Opener-Policy: same-origin` for `/creator/`: the sign-in popups and the
  social-connect popup need their opener (`same-origin-allow-popups` is fine).
- `client_max_body_size 25m;` is the limit the app assumes for story uploads.
- Apple's domain-verification file is the same one Seller Center uses
  (`/.well-known/apple-developer-domain-association.txt`).

To deploy: copy `Creator/` (without `node_modules`/`dist`) to the VPS, run the command block at the
top in `node:22-alpine`, then sync `dist/` to `/var/www/stylemint-creator/` and reload nginx.
