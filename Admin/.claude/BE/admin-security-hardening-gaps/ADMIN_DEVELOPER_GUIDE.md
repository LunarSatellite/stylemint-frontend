# Admin App — Developer Onboarding Guide

How to start building the **Style Mint operator console** (`stylemint-admin-frontend`) against the
`/v1/admin/*` backend surface. Base URL (UAT): `https://stylemint.voyageritnepal.com`.

> **Authoritative references** (read these — this guide orients, they specify):
> - `.claude/skills/stylemint-admin-frontend/SKILL.md` — stack, folder layout, conventions, per-feature guidance
> - `.../SETUP.md` — exact scaffold + dependencies
> - `.../AUTH_FLOW.md` — full SSO + step-up MFA lifecycle, JWT shape, retry
> - `.../API_REFERENCE.md` — all 40 endpoints across 11 controllers

---

## 1. There is NO username/password — admin login is SSO

The admin console does **not** use a username + password. Authentication is an **OIDC SSO id-token
exchange**: the IdP issues an `id_token`, the client posts it to the backend, and the backend returns
a Style Mint **admin JWT** (`AdminSessionDto`). Sensitive operations then require **step-up TOTP MFA**.

### The login call
```
POST /v1/admin/auth/sso
Idempotency-Key: <uuid>
Content-Type: application/json

{ "idToken": "<the credential>" }

→ 200 AdminSessionDto { accessToken, sessionId, adminAccountId, role, expiresUtc, ... }
```
Use `accessToken` as `Authorization: Bearer <token>` on every subsequent `/v1/admin/*` call.

### What `idToken` is, per environment
- **Production:** a real **OIDC id-token** from the corporate IdP (verified by the backend's
  provider-agnostic `OidcAssertionVerifier`). This is the long-term path.
- **UAT / dev (no corporate IdP):** a **config-gated dev shared secret**. Posting
  `{ "idToken": "<ADMIN_DEV_SSO_SECRET>" }` logs you in as the **bootstrap SuperAdmin**
  (subject = `ADMIN_SSO_SUBJECT`, email = `ADMIN_EMAIL`). This is your "login credential" on UAT.

### Where to get the UAT credential (it's a secret — not in this repo)
The dev secret and bootstrap identity live in `~/apps/uat/.env.uat` on the VPS, **never committed**.
Retrieve them from the VPS (or whoever owns it):
```bash
grep -E "ADMIN_DEV_SSO_SECRET|ADMIN_SSO_SUBJECT|ADMIN_EMAIL" ~/apps/uat/.env.uat
```
- `ADMIN_DEV_SSO_SECRET` → the value you put in `idToken` to log in.
- `ADMIN_SSO_SUBJECT` / `ADMIN_EMAIL` → the bootstrap SuperAdmin you'll be logged in as.

> If `ADMIN_DEV_SSO_SECRET` is unset on the box, dev login is disabled — set it (any strong string)
> in `.env.uat` and recreate the api container, or ask the backend owner. The bootstrap SuperAdmin
> is auto-seeded on boot only when zero admin accounts exist.

### Quick manual login (curl, to test before the UI exists)
```bash
curl -s -X POST https://stylemint.voyageritnepal.com/v1/admin/auth/sso \
  -H "Content-Type: application/json" -H "Idempotency-Key: $(uuidgen)" \
  -d '{"idToken":"<ADMIN_DEV_SSO_SECRET>"}'
# → copy accessToken, then:
curl -s https://stylemint.voyageritnepal.com/v1/admin/me -H "Authorization: Bearer <accessToken>"
```

---

## 2. Stack & scaffold (from SETUP.md)
React + TypeScript on **Vite**. Run NEXT TO `stylemint-backend` (not inside it):
```bash
npm create vite@latest stylemint-admin-frontend -- --template react-ts
```
Core deps: `react-router-dom@6`, `axios`, `zustand`, `@tanstack/react-query`, `@tanstack/react-table`,
`react-hook-form` + `zod`, Radix UI primitives, `tailwindcss@3`, `lucide-react`, `sonner`,
`qrcode.react` (TOTP enrollment QR), `date-fns`/`date-fns-tz`, `@microsoft/signalr`. Dev:
`openapi-typescript` (generate types from `/swagger`), `vitest` + Testing Library, `@playwright/test`.
See SETUP.md for the exact commands, Tailwind config, and folder layout.

**Generate API types** from the live UAT Swagger so requests/responses stay in sync:
```bash
npx openapi-typescript https://stylemint.voyageritnepal.com/swagger/v1/swagger.json -o src/api/schema.d.ts
```

---

## 3. Step-up MFA (sensitive operations)
Many admin actions (payout overrides, refunds, admin-account changes, etc.) require a **fresh TOTP
step-up**. The pattern:
1. Call the sensitive endpoint normally.
2. On **403 with `errorCode: mfa_required`** (or similar), prompt for the 6-digit TOTP.
3. Verify via `POST /v1/admin/auth/mfa/totp/verify`, then **retry the original request** (re-send the
   same `Idempotency-Key`).
First-time admins enroll TOTP via `POST /v1/admin/auth/mfa/totp/enroll` → render the QR with
`qrcode.react` → confirm with `POST /v1/admin/auth/mfa/totp/confirm`. Full sequence in AUTH_FLOW.md.

---

## 4. Request conventions (apply to every `/v1/admin/*` call)
- **Auth header:** `Authorization: Bearer <admin accessToken>` on all but `/auth/sso`.
- **Errors are RFC 7807 Problem Details**, keyed on a stable `errorCode` (machine-readable) +
  optional `field` + `correlationId`. Branch UI on `errorCode`, never on the human `title`.
- **`Idempotency-Key` header (UUID) on every POST/PUT/DELETE** — and re-send the *same* key when
  retrying after a step-up. Safe to retry; never generates duplicates.
- **Optimistic concurrency:** entities carry a `rowVersion`; send it back on updates. A `409
  ConcurrencyConflict` means refetch + retry.
- **Cursor pagination** on list endpoints (`PagedResult` with a cursor — no offset paging).
- **Role-gated:** the JWT carries an admin `role`; endpoints enforce it (SuperAdmin, KycReviewer,
  ContentMod, SupportAgent, PayoutsOps, Readonly). Hide/disable UI the role can't use.

---

## 5. API surface (40 endpoints, 11 controllers) — see API_REFERENCE.md
| Group | Route prefix | Purpose |
|---|---|---|
| Auth | `/v1/admin/auth` | `sso` login, `logout`, `logout-all` |
| Me | `/v1/admin/me` | current admin, own sessions, own MFA status |
| MFA | `/v1/admin/auth/mfa/totp` | enroll / confirm / verify / remove TOTP |
| Admin accounts | `/v1/admin/admins` | (SuperAdmin) manage admins, roles, sessions, MFA |
| KYC review | `/v1/admin/kyc` | creator/vendor KYC queue + decisions |
| Moderation | `/v1/admin/moderation` | content/profile moderation queue (incl. the creator trust-flag items) |
| Payments | `/v1/admin/payments` | payment lookups / refund overrides |
| Payouts | `/v1/admin/payouts` | payout dispute / override handling |
| Feature flags | `/v1/admin/feature-flags` | toggles + overrides |
| Platform config | `/v1/admin/platform-config` | platform settings |
| Privacy dashboard | `/v1/admin/privacy-dashboard` | GDPR/data-rights ops |
| Audit | `/v1/admin/audit` | ops audit log |

---

## 6. Suggested build order
1. **Auth shell:** SSO callback → exchange → store JWT (zustand) → axios interceptor (Bearer +
   Idempotency-Key + 401→re-login, 403 `mfa_required`→step-up). `GET /v1/admin/me` to bootstrap.
2. **App frame:** role-aware nav, RFC-7807 error toast (sonner), TanStack Query client.
3. **First feature — Moderation queue** (`/v1/admin/moderation`): list (cursor) → detail → assign →
   decide. It now surfaces the creator **trust-flag** items, so it's immediately useful.
4. Then KYC review, Payouts/Payments overrides (step-up MFA), Feature flags, Platform config, Audit.
5. Admin-account management (SuperAdmin) last.

---

## 7. Gotchas
- **No username/password** — don't build a password form; build the SSO callback + (UAT) a
  dev-secret entry for local testing only.
- `/swagger` is enabled on UAT (`SWAGGER_ENABLED=true`) — use it as the live contract.
- Admin endpoints sit behind extra middleware (IP allowlist, brute-force guard, token revocation);
  a `403` with empty body may be the IP allowlist, not your token.
- The admin JWT `sub` is the admin subject (e.g. `admin-001`), **not** a customer account GUID.
- Step-up MFA failures and revoked sessions both surface as `401`/`403` — distinguish by `errorCode`.

Questions / shape mismatches → `/swagger` on UAT, the four skill docs above, or ping backend.
