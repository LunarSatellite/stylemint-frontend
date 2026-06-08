# Cross-device QR login — API contract

WhatsApp-Web-style login for the **Brand Studio** (Vendor) and **Creator Studio**
(Creator) web apps. The web shows a QR; the authenticated mobile app scans and
approves; the web exchanges the approval for tokens.

All routes are under `/v1/auth/qr`. Tokens returned are the standard
`AuthResponseVm` (access + refresh) — identical to every other login.

## Sequence

```
Web                         Backend                        Mobile (signed in)
 │  POST /create  ─────────▶ create session (Pending)
 │  ◀── publicToken,                                        
 │      clientSecret, qrPayload, expiresUtc
 │  render QR(qrPayload)
 │                                          scan QR ──▶ POST /{publicToken}/scan
 │                                          ◀── scan info (app, device, ip)
 │                                          user taps Approve
 │                                          POST /{publicToken}/approve ──▶ Approved
 │  POST /exchange (poll ~2s) ─▶ status
 │  ◀── {status:"Pending"|"Scanned"|"Approved"...}
 │  ◀── {status:"Consumed", auth:{accessToken,...}}   ✅ logged in
```

## Endpoints

### `POST /v1/auth/qr/create`  (anonymous — the web)
Request:
```json
{ "targetApp": 1, "deviceFingerprint": "<stable-browser-id>",
  "devicePlatform": 3, "deviceModel": "Chrome", "deviceOsVersion": "Win11" }
```
`targetApp`: `1`=BrandStudio, `2`=CreatorStudio. `devicePlatform` optional (`3`=Web).
`deviceFingerprint` is **required** — generate once and persist in `localStorage`.

Response `200`:
```json
{ "publicToken": "…", "clientSecret": "…",
  "qrPayload": "stylemint://qr-login?token=…&app=brand",
  "expiresUtc": "2026-06-04T12:02:00Z" }
```
Render `qrPayload` as the QR. **Keep `clientSecret` in memory only — never put it
in the QR or the URL.** TTL is 120s.

### `POST /v1/auth/qr/exchange`  (anonymous — the web, poll ~2s)
Request: `{ "publicToken": "…", "clientSecret": "…" }`
Response `200`:
```json
{ "status": "Pending|Scanned|Approved|Consumed|Rejected|Expired",
  "auth": null }
```
When `status` becomes `"Consumed"`, `auth` is the token bundle (returned **once**):
```json
{ "status": "Consumed",
  "auth": { "accountId":"…","sessionId":"…","accessToken":"…",
            "accessExpiresUtc":"…","refreshToken":"…","refreshExpiresUtc":"…",
            "tokenType":"Bearer" } }
```
Stop polling on `Consumed`/`Rejected`/`Expired`. `403` = wrong `clientSecret`;
`404` = unknown token.

### `POST /v1/auth/qr/{publicToken}/scan`  (Bearer — mobile)
Marks the session scanned and returns confirmation-screen info:
```json
{ "targetApp": 1, "webPlatform": 3, "creatorIp": "203.0.113.5",
  "creatorUserAgent": "Mozilla/5.0…", "expiresUtc": "…" }
```
`403` if the caller lacks the required role-profile (Vendor for BrandStudio,
Creator for CreatorStudio). `409` if the session is already terminal.

### `POST /v1/auth/qr/{publicToken}/approve`  (Bearer — mobile)
`204` on success. Binds the caller's account; the web's next `exchange` returns tokens.

### `POST /v1/auth/qr/{publicToken}/reject`  (Bearer — mobile)
`204`. The web's `exchange` then reports `"Rejected"`.

## Security notes
- The QR encodes only `publicToken`. The `clientSecret` lives solely in the web
  tab, so a stranger who photographs the QR cannot collect tokens.
- The phone shows an explicit **Approve / Reject** screen with the requesting
  device + IP before authorizing.
- One-time use, 120s TTL, role-gated per studio. The minted session is a normal
  `UserSession` bound to the web device fingerprint, so logout / refresh /
  revocation all work as usual.
