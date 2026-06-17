# Admin App — Complete Developer Pack

Everything the `stylemint-admin-frontend` developer needs, in one folder. These are the authoritative
contracts for the `/v1/admin/*` surface (published from the backend skill — if anything diverges from
the running backend, the backend + `/swagger` win).

## Read in this order
1. **[../ADMIN_DEVELOPER_GUIDE.md](../ADMIN_DEVELOPER_GUIDE.md)** — orientation: how to start, login (SSO/dev-secret, **no username/password**), build order.
2. **[ADMIN_SETUP.md](ADMIN_SETUP.md)** — exact scaffold: Vite + React-TS, dependency set, Tailwind, folder layout, type generation.
3. **[ADMIN_AUTH_FLOW.md](ADMIN_AUTH_FLOW.md)** — full auth lifecycle: SSO id-token exchange, `AdminSessionDto`/JWT shape, step-up TOTP MFA, session control, token revocation, retry semantics.
4. **[ADMIN_API_REFERENCE.md](ADMIN_API_REFERENCE.md)** — **all 40 endpoints** across 11 controllers, with request/response TypeScript types, common types (`PagedList<T>`, `ErrorResponse`, `RowVersion`), and SignalR realtime.

## Environments
- **UAT (use this):** `https://stylemint.voyageritnepal.com` · live `/swagger` · generate types from
  `https://stylemint.voyageritnepal.com/swagger/v1/swagger.json`.
- The API_REFERENCE lists `localhost` dev URLs — **override to the UAT base URL** above.

## Login in 30 seconds (UAT)
No username/password — it's SSO. On UAT, use the dev shared secret from `~/apps/uat/.env.uat`:
```bash
# get the secret + bootstrap admin identity from the VPS:
grep -E "ADMIN_DEV_SSO_SECRET|ADMIN_SSO_SUBJECT|ADMIN_EMAIL" ~/apps/uat/.env.uat

# log in (returns AdminSessionDto with accessToken):
curl -s -X POST https://stylemint.voyageritnepal.com/v1/admin/auth/sso \
  -H "Content-Type: application/json" -H "Idempotency-Key: $(uuidgen)" \
  -d '{"idToken":"<ADMIN_DEV_SSO_SECRET>"}'

# use it:
curl -s https://stylemint.voyageritnepal.com/v1/admin/me -H "Authorization: Bearer <accessToken>"
```

## Endpoint catalog (40 endpoints / 11 controllers)
| Group | Prefix | Endpoints |
|---|---|---|
| Auth | `/v1/admin/auth` | `POST /sso`, `POST /logout`, `POST /logout-all` |
| Me | `/v1/admin/me` | `GET /`, `GET /sessions`, `GET /mfa` |
| MFA (own) | `/v1/admin/auth/mfa/totp` | `POST /enroll`, `POST /confirm`, `POST /verify`, `DELETE /` |
| Admin accounts (SuperAdmin) | `/v1/admin/admins` | list, `POST/DELETE /{id}/roles/{role}`, `/{id}/disable`, `/{id}/enable`, `GET /{id}/sessions`, `/{id}/sessions/revoke-all`, `DELETE /{id}/mfa` |
| KYC review | `/v1/admin/kyc` | `GET /queue`, `GET /{id}`, `POST /{id}/assign`, `POST /{id}/decide` |
| Moderation | `/v1/admin/moderation` | `GET /queue`, `GET /{id}`, `POST /{id}/assign`, `POST /{id}/decide` |
| Audit | `/v1/admin/audit` | `GET /` |
| Feature flags | `/v1/admin/feature-flags` | list, `GET /{key}`, `PUT /{key}`, `PUT/DELETE /{key}/overrides` |
| Platform config | `/v1/admin/platform-config` | list, `GET /{key}`, `PUT /{key}` |
| Payouts | `/v1/admin/payouts` | `POST /{id}/hold`, `/release`, `/force-paid`, `/force-failed` |
| Payments | `/v1/admin/payments` | `POST /{id}/refund` |

## Cross-cutting rules (full detail in API_REFERENCE / AUTH_FLOW)
- **Auth header** `Authorization: Bearer <admin-jwt>` on everything except `/sso`.
- **`Idempotency-Key: <uuid>`** on every POST/PUT/DELETE; re-send the same key when retrying after step-up.
- **Errors = RFC 7807** with stable `errorCode` — branch on it, not `title`.
- **`RowVersion`** optimistic concurrency on updates → `409` means refetch+retry.
- **Cursor/`PagedList`** pagination on list endpoints.
- **Role-gating:** SuperAdmin / KycReviewer / ContentMod / SupportAgent / PayoutsOps / Readonly.
- **Step-up MFA:** sensitive ops 403 with an MFA-required code → verify TOTP → retry with same Idempotency-Key.
- Admin endpoints sit behind IP-allowlist + brute-force + token-revocation middleware (a bare `403` may be the IP allowlist).

> These docs are a published snapshot of the backend `stylemint-admin` module. The live `/swagger`
> on UAT is the runtime source of truth — generate your TS types from it.
