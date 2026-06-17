# Style Mint Admin API — Frontend Reference

Companion to `SKILL.md`. Every endpoint under `/v1/admin/*`, with
request and response shapes as TypeScript types. Mirrors the
backend's `stylemint-admin` module verbatim — if anything here
diverges from the running backend, the backend wins; flag and
update this doc.

**Base URL** development: `http://localhost:5020` (http) or `https://localhost:7277` (https). Verified against `src/StyleMint.Core.Api/Properties/launchSettings.json` — adjust if the backend dev changes the launch profile.
**API version** in path: `/v1/`
**Auth header** (except `/sso`): `Authorization: Bearer <admin-jwt>`
**Idempotency**: every mutation accepts `Idempotency-Key: <uuid>` header.

Common types referenced below:

```ts
// PagedList<T> — every list endpoint
type PagedList<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

// ErrorResponse — every non-2xx
type ErrorResponse = {
  type: string;
  title: string;
  status: number;
  errorCode: string;
  field?: string;
  correlationId: string;
  errors?: { field: string; code: string; message: string }[];
};

// ISO 8601 UTC string, e.g. "2026-05-26T11:42:31.123Z"
type DateTimeOffset = string;
type Guid = string;
type RowVersion = string;   // opaque
```

---

## Auth (3 endpoints)

### POST `/v1/admin/auth/sso`

Anonymous. Exchanges an IdP id-token for a Style Mint admin JWT.

**Request**

```ts
type SsoLoginVm = {
  idToken: string;   // OIDC id_token; ≥ 20 chars
};
// Headers: Idempotency-Key: <uuid>  (optional but recommended)
```

**Response — 200**

```ts
type AdminSessionDto = {
  accessToken:    string;        // the admin JWT — store in memory only
  expiresAtUtc:   DateTimeOffset;
  adminAccountId: Guid;
  email:          string;
  displayName:    string;
  roles:          AdminRoleName[];   // e.g. ["SuperAdmin"]
};
type AdminRoleName =
  | "SuperAdmin" | "KycReviewer" | "ContentMod"
  | "SupportAgent" | "PayoutsOps" | "Readonly";
```

**Errors**

- 400 — `validation.failed` (idToken too short)
- 401 — `auth.idp.invalid_token` (signature or issuer check failed)
- 401 — `auth.idp.expired_token`
- 403 — `admin.account.disabled` (admin row found but state = Disabled)
- 403 — `admin.account.not_provisioned` (sso_subject matches no admin row)
- 403 — `mfa.required` (IdP didn't assert MFA per platform policy)
- 429 — `ratelimit.exceeded` (SSO brute-force gate — 5/min/IP, 20/hour/IP, 10/min/email)

---

### POST `/v1/admin/auth/logout`

Authenticated. Revokes the current session.

**Request** — no body.

**Response — 200** — `number` (count of rows revoked, always 1).

**Errors** — 401 if token already revoked; 429 if logout rate limit hit.

---

### POST `/v1/admin/auth/logout-all`

Authenticated. Revokes every active session of the calling admin.

**Request** — no body.

**Response — 200** — `number` (count revoked, ≥ 1).

---

## Me (3 endpoints)

### GET `/v1/admin/me`

Authenticated. Returns the calling admin's own account record.

**Response — 200**

```ts
type AdminAccountDto = {
  id:           Guid;
  ssoSubject:   string;
  email:        string;
  displayName:  string;
  state:        1 | 2;        // AdminAccountState (Active=1, Disabled=2)
  lastLoginUtc: DateTimeOffset;
  createdUtc:   DateTimeOffset;
  updatedUtc:   DateTimeOffset;
  rowVersion:   RowVersion | null;
  roles: AdminRoleAssignmentDto[];
};

type AdminRoleAssignmentDto = {
  id:                Guid;
  adminAccountId:    Guid;
  role:              1 | 2 | 3 | 4 | 5 | 6;  // AdminRole enum
  assignedUtc:       DateTimeOffset;
  assignedByAdminId: Guid;
};
```

### GET `/v1/admin/me/sessions`

Authenticated. Lists active sessions belonging to the calling admin.

**Response — 200** — `AdminSessionDto[]`:

```ts
type AdminSessionDto = {
  id:                Guid;
  adminAccountId:    Guid;
  jti:               Guid;                // match against your JWT's jti claim to highlight "this session"
  issuedUtc:         DateTimeOffset;
  expiresUtc:        DateTimeOffset;
  lastSeenUtc:       DateTimeOffset;
  sourceIp:          string;
  userAgent:         string;
  mfaAssertedUtc:    DateTimeOffset | null;
  mfaAcr:            string | null;
  revokedUtc:        DateTimeOffset | null;
  revokedReason:     1 | 2 | 3 | 4 | 5 | 6 | 7 | null;  // AdminSessionRevocationReason
  revokedByAdminId:  Guid | null;
  lastStepUpUtc:     DateTimeOffset | null;
  rowVersion:        RowVersion | null;
};
```

### GET `/v1/admin/me/mfa`

Authenticated. MFA status for the calling admin.

**Response — 200**

```ts
type AdminMfaStatusDto = {
  hasTotp:               boolean;          // true once enroll has been called
  totpConfirmed:         boolean;          // true once confirm has succeeded
  totpLastVerifiedUtc:   DateTimeOffset | null;
  totpLocked:            boolean;          // true while in 15-min lockout
  sessionLastStepUpUtc:  DateTimeOffset | null;
  sessionStepUpFresh:    boolean;          // true iff a step-up-gated endpoint will currently succeed
  stepUpMaxAgeMinutes:   number;           // default 5
};
```

---

## MFA — own credential (4 endpoints)

### POST `/v1/admin/auth/mfa/totp/enroll`

Authenticated. Starts TOTP enrollment. **Secret is shown ONCE.**

**Request**

```ts
type EnrollMfaVm = { label?: string };   // e.g. "iPhone Authy"
```

**Response — 200**

```ts
type AdminMfaEnrollmentDto = {
  credentialId:    Guid;
  secretBase32:    string;     // human-typeable fallback
  provisioningUri: string;     // otpauth://totp/StyleMint:<email>?secret=...&issuer=StyleMint&...
  digits:          6;
  periodSeconds:   30;
};
```

Render the QR code from `provisioningUri`. Show `secretBase32` as
plain text under the QR for manual entry.

**Errors**

- 409 — `mfa.totp.already_confirmed` (admin already has a confirmed TOTP — delete it first).

---

### POST `/v1/admin/auth/mfa/totp/confirm`

Authenticated. Confirms enrollment by verifying the first code.

**Request**

```ts
type VerifyMfaVm = { code: string };   // 6 digits
```

**Response — 200**

```ts
type AdminMfaCredentialDto = {
  id:              Guid;
  adminAccountId:  Guid;
  kind:            1 | 2;             // MfaCredentialKind (Totp=1)
  label:           string;
  confirmedUtc:    DateTimeOffset | null;
  lastVerifiedUtc: DateTimeOffset | null;
  failedAttempts:  number;
  lockedUntilUtc:  DateTimeOffset | null;
  createdUtc:      DateTimeOffset;
  rowVersion:      RowVersion | null;
};
```

**Errors**

- 400 — `mfa.totp.invalid_code`
- 404 — `mfa.totp.not_enrolled` (no pending enrollment)

---

### POST `/v1/admin/auth/mfa/totp/verify`

Authenticated. Step-up verify — stamps `lastStepUpUtc` on the
current session for the configured window.

**Request** — same `VerifyMfaVm`.

**Response — 204** — no body.

**Errors**

- 400 — `mfa.totp.invalid_code`
- 403 — `mfa.totp.locked` (5 consecutive failures → 15 min lockout)
- 429 — `ratelimit.exceeded`

---

### DELETE `/v1/admin/auth/mfa/totp`

Authenticated. Removes the calling admin's own credential. **Requires step-up.**

**Response — 204**.

**Errors**

- 403 — `mfa.step_up_required` (no fresh step-up on this session)

---

## Admin accounts — SuperAdmin only (8 endpoints)

### GET `/v1/admin/admins`

**Query** — `pageNumber=1`, `pageSize=50`.
**Response — 200** — `PagedList<AdminAccountDto>`.

### POST `/v1/admin/admins/{adminAccountId}/roles/{role}`

Grant a role. `role` is the **string name** (e.g. `KycReviewer`).
**Step-up required.**
**Response — 200** — updated `AdminAccountDto`.
**Errors** — 404 if no such admin; 400 if role already granted (idempotent — actually returns 200 with no change on the second call).

### DELETE `/v1/admin/admins/{adminAccountId}/roles/{role}`

Revoke a role. **Step-up required.**
**Response — 200** — updated `AdminAccountDto`.

### POST `/v1/admin/admins/{adminAccountId}/disable`

Disable an admin. **Step-up required.** Revokes all their sessions
as a side effect.
**Response — 204**.

### POST `/v1/admin/admins/{adminAccountId}/enable`

Re-enable a previously disabled admin. **Step-up required.**
**Response — 204**.

### GET `/v1/admin/admins/{adminAccountId}/sessions`

List sessions for another admin (SuperAdmin only).
**Response — 200** — `AdminSessionDto[]`.

### POST `/v1/admin/admins/{adminAccountId}/sessions/revoke-all`

Force-kill every session of the target admin.
**Query** — `reason` (string, optional but include it).
**Step-up required.**
**Response — 200** — `number` (count revoked).

### DELETE `/v1/admin/admins/{adminAccountId}/mfa`

Force-remove another admin's MFA credential (recovery flow).
**Query** — `reason` (string, optional).
**Step-up required.**
**Response — 204**.

---

## KYC review (4 endpoints)

### GET `/v1/admin/kyc/queue`

**Query**

```ts
type KycQueueFilter = {
  applicantKind?: 1 | 2;          // Creator=1, Vendor=2
  state?:         1 | 2 | 3;       // Pending=1, InReview=2, Decided=3
  reviewerId?:    Guid;
  overdueOnly?:   boolean;         // dueByUtc < now AND state != Decided
  pageNumber?:    number;          // default 1
  pageSize?:      number;          // default 50
};
```

**Response — 200** — `PagedList<KycReviewItemDto>`:

```ts
type KycReviewItemDto = {
  id:                  Guid;
  applicantKind:       1 | 2;        // KycApplicantKind
  applicationId:       Guid;
  accountId:           Guid;
  state:               1 | 2 | 3;
  assignedReviewerId:  Guid | null;
  submittedUtc:        DateTimeOffset;
  dueByUtc:            DateTimeOffset;   // submittedUtc + 3 business days
  decidedUtc:          DateTimeOffset | null;
  decision:            1 | 2 | 3 | null;
  decisionReasonCode:  string | null;    // see KycReasonCodes in SKILL §8.4
  decisionNote:        string | null;
  rowVersion:          RowVersion | null;
};
```

### GET `/v1/admin/kyc/{kycItemId}`

**Response — 200** — `KycReviewItemDto`.
**Errors** — 404.

### POST `/v1/admin/kyc/{kycItemId}/assign`

**Request** — `{ reviewerAdminId: Guid }`.
**Response — 200** — updated `KycReviewItemDto` (state transitions to InReview).
**Errors** — 400 (already decided), 404.

### POST `/v1/admin/kyc/{kycItemId}/decide`

**Request**

```ts
type DecideKycVm = {
  decision: 1 | 2 | 3;                 // Approved=1, RejectedRetryable=2, RejectedTerminal=3
  decisionReasonCode?: string;         // required if decision != 1; must be in closed set
  decisionNote?: string;               // ≤ 1000 chars
};
```

**Response — 200** — terminal `KycReviewItemDto`.
**Errors**

- 400 — `validation.failed` (reason code missing on rejection, or code not in closed set, or note > 1000).
- 422 — `kyc.already_decided` (idempotency-key replay protects against double-submits but a fresh call against a decided item fails here).

---

## Moderation (4 endpoints)

### GET `/v1/admin/moderation/queue`

**Query**

```ts
type ModerationQueueFilter = {
  targetKind?: 1 | 2 | 3 | 4;        // Reel/Review/ReelComment/Profile
  state?:      1 | 2 | 3;            // Open/InReview/Decided
  source?:     1 | 2 | 3;            // UserReport/AutomatedScanner/AdminSpot
  reviewerId?: Guid;
  pageNumber?: number;
  pageSize?:   number;
};
```

**Response — 200** — `PagedList<ModerationItemDto>`:

```ts
type ModerationItemDto = {
  id:                 Guid;
  targetKind:         1 | 2 | 3 | 4;
  targetId:           string;          // stringified key in the owning module
  source:             1 | 2 | 3;
  reporterAccountId:  Guid | null;
  reportReasonCode:   string | null;   // one of ModerationReportReasonCode
  state:              1 | 2 | 3;
  assignedReviewerId: Guid | null;
  submittedUtc:       DateTimeOffset;
  decidedUtc:         DateTimeOffset | null;
  action:             1 | 2 | 3 | 4 | 5 | 6 | null;  // ModerationAction
  decisionNote:       string | null;
  rowVersion:         RowVersion | null;
};
```

### GET `/v1/admin/moderation/{moderationItemId}` — 200 `ModerationItemDto` / 404.

### POST `/v1/admin/moderation/{id}/assign`

**Request** — `{ reviewerAdminId: Guid }`.
**Response — 200** — updated `ModerationItemDto`.

### POST `/v1/admin/moderation/{id}/decide`

**Request**

```ts
type DecideModerationVm = {
  action: 1 | 2 | 3 | 4 | 5 | 6;        // ModerationAction
  decisionNote?: string;
};
```

**Response — 200** — terminal `ModerationItemDto`.
**Errors**

- 422 — `moderation.invalid_action` (e.g. SuspendAuthor on a Profile target).

---

## Audit log (1 endpoint)

### GET `/v1/admin/audit`

**Query**

```ts
type AdminAuditQuery = {
  adminAccountId?: Guid;
  action?:         string;            // dotted action code (substring match)
  targetKind?:     string;            // e.g. "KycReviewItem", "ModerationItem", "Payout"
  targetId?:       string;
  fromUtc?:        DateTimeOffset;
  toUtc?:          DateTimeOffset;
  pageNumber?:     number;
  pageSize?:       number;
};
```

**Response — 200** — `PagedList<AdminAuditEntryDto>`:

```ts
type AdminAuditEntryDto = {
  id:             Guid;
  adminAccountId: Guid;
  action:         string;          // e.g. "kyc.creator.approved"
  targetKind:     string;
  targetId:       string;
  reason:         string | null;
  payloadJson:    string;          // already PII-redacted
  sourceIp:       string;
  userAgent:      string;
  occurredUtc:    DateTimeOffset;
};
```

The table is range-partitioned by `occurredUtc` — wide-window queries
are slow. Always filter to ≤ 90 days unless absolutely necessary.

---

## Feature flags (5 endpoints)

### GET `/v1/admin/feature-flags` — 200 `FeatureFlagDto[]`

```ts
type FeatureFlagDto = {
  id:             Guid;
  key:            string;
  defaultEnabled: boolean;
  description:    string | null;
  createdUtc:     DateTimeOffset;
  updatedUtc:     DateTimeOffset;
  rowVersion:     RowVersion | null;
  overrides:      FeatureFlagOverrideDto[];
};

type FeatureFlagOverrideDto = {
  id:            Guid;
  featureFlagId: Guid;
  audience:      1 | 2;                          // Role=1, Account=2
  roleKind:      1 | 2 | 3 | null;               // Customer=1, Creator=2, Vendor=3
  accountId:     Guid | null;
  enabled:       boolean;
};
```

### GET `/v1/admin/feature-flags/{key}` — 200 `FeatureFlagDto` / 404.

### PUT `/v1/admin/feature-flags/{key}`

**Request** — `{ defaultEnabled: boolean, description?: string }`.
**Response — 200** — `FeatureFlagDto` (created or updated).

### PUT `/v1/admin/feature-flags/{key}/overrides`

**Request**

```ts
type SetOverrideVm = {
  roleKind?: "Customer" | "Creator" | "Vendor";    // string name, not number
  accountId?: Guid;
  enabled: boolean;
};
```

Exactly one of `roleKind` / `accountId` must be set.

**Response — 200** — `FeatureFlagDto` with the new/updated override row.
**Errors**

- 400 — `feature_flag.override_invalid_audience` (both set, or neither).
- 404 — flag not found.

### DELETE `/v1/admin/feature-flags/{key}/overrides`

Same body shape as PUT. Removes the matching override row.
**Response — 200** — `FeatureFlagDto`.

---

## Platform config (3 endpoints)

### GET `/v1/admin/platform-config` — 200 `PlatformConfigEntryDto[]`

```ts
type PlatformConfigEntryDto = {
  id:          Guid;
  key:         string;
  valueJson:   string;            // raw JSON string — may be "null", "true", a number, an object, etc.
  description: string;
  createdUtc:  DateTimeOffset;
  updatedUtc:  DateTimeOffset;
  rowVersion:  RowVersion | null;
};
```

### GET `/v1/admin/platform-config/{key}` — 200 / 404.

### PUT `/v1/admin/platform-config/{key}`

**Request** — `{ valueJson: string, description?: string }`.
`valueJson` must parse as JSON server-side. Returns 400
`platform_config.invalid_json` otherwise.

**Response — 200** — `PlatformConfigEntryDto`.

After mutation the backend invalidates a Redis cache cross-process —
no client-side cache work required beyond TanStack Query invalidation.

---

## Payouts (4 endpoints)

All POST. All return **204** on success.

### POST `/v1/admin/payouts/{payoutId}/hold`

**Request** — `{ reason: string }`.

### POST `/v1/admin/payouts/{payoutId}/release`

**Request** — `{ reason: string }`.

### POST `/v1/admin/payouts/{payoutId}/force-paid`

**Step-up required.** Stamps provider id as `admin:{adminId:N}`
sentinel for reconciliation.
**Request** — `{ reason: string }`.

### POST `/v1/admin/payouts/{payoutId}/force-failed`

**Step-up required.**
**Request** — `{ reason: string }`.

**Errors (all four)** — 404 not found, 422
`payouts.invalid_state` if the state machine forbids the transition
(e.g. release on a non-held payout).

---

## Payments (1 endpoint)

### POST `/v1/admin/payments/{paymentIntentId}/refund`

**Request**

```ts
type IssueRefundVm = {
  amount:    number;             // > 0
  currency:  string;             // 3-letter ISO, e.g. "NPR"
  reasonTag: string;             // slug ^[a-z0-9_-]+$, ≤ 60 chars
  reason:    string;             // free text, ≤ 1000 chars
};
```

**Response — 200**

```ts
type RefundResult = {
  refundId:           Guid;
  paymentIntentId:    Guid;
  amount:             { amount: number; currency: string };
  status:             string;    // adapter-dependent
  providerRefundId:   string | null;
  acknowledgedUtc:    DateTimeOffset | null;
};
```

**Errors**

- 422 — refund exceeds captured amount, intent not in a refundable state, etc.

---

## SignalR — realtime notifications (optional)

Backend exposes a SignalR hub at `/hubs/notifications`
(see `Program.cs` line 1182). Admin JWT works as-is. Browser
WebSocket can't set headers, so pass the token as a query string:

```ts
import { HubConnectionBuilder } from "@microsoft/signalr";

const conn = new HubConnectionBuilder()
  .withUrl(`${BASE_URL}/hubs/notifications?access_token=${token}`)
  .withAutomaticReconnect()
  .build();

conn.on("notification", (msg) => { /* ... */ });
conn.on("unread-count-changed", ({ unreadCount }) => { /* ... */ });
await conn.start();
```

The hub is used by the Messaging module — admin v1.1 doesn't push
admin-specific events through it. You can wire it in later if/when
admin gets push notifications; v1 doesn't need it.
