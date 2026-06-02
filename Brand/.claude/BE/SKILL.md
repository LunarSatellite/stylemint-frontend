---
name: stylemint-admin
description: |
  Ops console backend: KYC review for creator and vendor applications,
  content moderation (reels, reviews, comments), refund overrides,
  payout dispute handling, feature flags, platform configuration,
  audit log, and admin role/permission model. Everything an internal
  operator needs is routed through this module under the /v1/admin
  prefix. Use for any screen under "Admin Console", "Moderation Queue",
  "KYC Review", "Feature Flags", or "Ops Audit".
---

# stylemint-admin

## 1. Overview

This is the internal-facing module. It does not own customer-facing
business state — it owns the tools operators use to review, override,
and configure that state. Almost every action here is an event-
producing wrapper around a service method in another module, with an
audit trail and a permission check in front.

Figma screens served: not part of the customer/creator/vendor app
designs. The admin console is a separate web surface (see
`DESKTOP_CSS_TOKENS.md` for token reuse). This skill covers only the
backend that console calls.

## 2. Admin identity and roles

Admins are separate from customer / creator / vendor accounts. They
authenticate via corporate SSO (OIDC) configured at the identity
provider — no password path. An admin session is exchanged for a
short-lived JWT the same way end-user sessions are (see
`stylemint-identity`), but with a disjoint `sub` namespace (`adm_`
prefix) so a customer JWT can never gain admin privileges.

```csharp
public sealed class AdminAccount : EntityBase<Guid>
{
    public string  SsoSubject { get; private set; } = "";      // IdP subject claim
    public string  Email { get; private set; } = "";
    public string  DisplayName { get; private set; } = "";
    public AdminAccountState State { get; private set; } = AdminAccountState.Active;
    public DateTime LastLoginUtc { get; private set; }
    public List<AdminRoleAssignment> Roles { get; private set; } = new();
}

public enum AdminAccountState { Active = 1, Disabled = 2 }

public sealed class AdminRoleAssignment : EntityBase<Guid>
{
    public Guid    AdminAccountId { get; private set; }
    public AdminRole Role { get; private set; }
    public DateTime AssignedUtc { get; private set; }
    public Guid    AssignedByAdminId { get; private set; }
}

public enum AdminRole
{
    SuperAdmin      = 1,   // everything, including role grants
    KycReviewer     = 2,   // creator + vendor application review only
    ContentMod      = 3,   // moderation queue
    SupportAgent    = 4,   // tickets, read-only order/customer info
    PayoutsOps      = 5,   // payout holds + manual refunds
    Readonly        = 6,   // analytics + lookups, no writes
}
```

Roles are additive. A permission check is `caller.Roles ∩ allowedRoles
≠ ∅`. `SuperAdmin` shortcircuits to allow anything.

## 3. Audit log

Every write endpoint under `/v1/admin/*` writes an `AdminAuditEntry`
in the same transaction as the action. This is the non-negotiable
invariant of the module.

```csharp
public sealed class AdminAuditEntry : EntityBase<Guid>
{
    public Guid    AdminAccountId { get; private set; }
    public string  Action { get; private set; } = "";          // "kyc.creator.approved"
    public string  TargetKind { get; private set; } = "";      // "CreatorApplication"
    public string  TargetId { get; private set; } = "";        // stringified key
    public string? Reason { get; private set; }
    public string  PayloadJson { get; private set; } = "{}";   // the command, redacted
    public string  SourceIp { get; private set; } = "";
    public DateTime OccurredUtc { get; private set; }
}
```

## 4. KYC review

Creator and vendor applications (see `stylemint-onboarding`) land in a
review queue here.

```csharp
public sealed class KycReviewItem : EntityBase<Guid>
{
    public KycApplicantKind ApplicantKind { get; private set; }     // Creator | Vendor
    public Guid    ApplicationId { get; private set; }              // back to onboarding
    public Guid    AccountId { get; private set; }
    public KycReviewState State { get; private set; } = KycReviewState.Pending;
    public Guid?   AssignedReviewerId { get; private set; }
    public DateTime SubmittedUtc { get; private set; }
    public DateTime DueByUtc { get; private set; }                  // SubmittedUtc + 3 biz days
    public DateTime? DecidedUtc { get; private set; }
    public KycDecision? Decision { get; private set; }
    public string? DecisionReasonCode { get; private set; }
    public string? DecisionNote { get; private set; }
}

public enum KycApplicantKind { Creator = 1, Vendor = 2 }

public enum KycReviewState { Pending = 1, InReview = 2, Decided = 3 }

public enum KycDecision
{
    Approved         = 1,
    RejectedRetryable = 2,   // can resubmit with fixes
    RejectedTerminal  = 3,
}
```

SLA: `DueByUtc = SubmittedUtc + 3 business days` (Asia/Kathmandu
holidays respected via a static holiday list maintained in config;
see §9). Overdue items surface in a dashboard tile.

Decision codes (closed set):

| Code                            | Kind       | Typical usage                              |
| ------------------------------- | ---------- | ------------------------------------------ |
| `DOCS_UNCLEAR`                  | Retryable  | Photo of ID is blurry                      |
| `DOCS_MISMATCH`                 | Retryable  | Name on ID doesn't match profile name      |
| `CATEGORY_MISSING`              | Retryable  | Creator didn't pick categories             |
| `POLICY_VIOLATION_RECOVERABLE`  | Retryable  | Minor content policy issue, explained      |
| `FRAUD_SUSPECTED`               | Terminal   | Admin believes application is fraudulent   |
| `SANCTIONS_HIT`                 | Terminal   | Identity matched a sanctions list          |
| `UNDERAGE`                      | Terminal   | Under 18                                   |

## 5. Content moderation

Moderation targets are reels, reviews, reel comments, and account
profile fields (handle, bio, avatar).

```csharp
public sealed class ModerationItem : EntityBase<Guid>
{
    public ModerationTargetKind TargetKind { get; private set; }
    public string    TargetId { get; private set; } = "";           // stringified key
    public ModerationSource Source { get; private set; }            // UserReport | AutomatedScanner | AdminSpot
    public Guid?     ReporterAccountId { get; private set; }
    public string?   ReportReasonCode { get; private set; }
    public ModerationItemState State { get; private set; } = ModerationItemState.Open;
    public Guid?     AssignedReviewerId { get; private set; }
    public DateTime SubmittedUtc { get; private set; }
    public DateTime? DecidedUtc { get; private set; }
    public ModerationAction? Action { get; private set; }
    public string?   DecisionNote { get; private set; }
}

public enum ModerationTargetKind { Reel = 1, Review = 2, ReelComment = 3, Profile = 4 }
public enum ModerationSource     { UserReport = 1, AutomatedScanner = 2, AdminSpot = 3 }
public enum ModerationItemState  { Open = 1, InReview = 2, Decided = 3 }

public enum ModerationAction
{
    NoAction      = 1,
    HideContent   = 2,
    RemoveContent = 3,
    WarnAuthor    = 4,
    SuspendAuthor = 5,   // 7-day suspension
    BanAuthor     = 6,
}
```

User report reason codes (closed set):

`SPAM`, `NUDITY_OR_SEXUAL`, `HATE_OR_HARASSMENT`, `VIOLENCE`,
`MISLEADING`, `COUNTERFEIT_PRODUCT`, `OTHER`.

Each `ModerationAction` (other than `NoAction`) drives a call into the
relevant owning module — `stylemint-reels` for Reel/ReelComment,
`stylemint-catalog` for Review, `stylemint-identity` for Profile —
via existing service methods. This module never mutates another
module's state directly.

## 6. Refund & payout overrides

Operators in `PayoutsOps` or `SuperAdmin` can:

- Issue a manual refund on a `PaymentIntent` (calls
  `IPaymentService.RefundAsync` with an `adminOverride: true` flag).
  The flag is stored on `RefundRecord.ReasonCode` prefixed with
  `ADMIN:` so it is distinguishable from customer-driven refunds.
- Hold a pending payout (`stylemint-payouts`) — transitions to a
  synthetic `AdminHold` marker stored here, executor skips held rows.
- Release a held payout.
- Manually mark a payout `Paid` or `Failed` in rare reconciliation
  cases — requires a `SuperAdmin` role and a reason note.

All of these are wrapped with audit entries and emit
`admin.override.applied.v1`.

## 7. Feature flags & platform config

```csharp
public sealed class FeatureFlag : EntityBase<Guid>
{
    public string  Key { get; private set; } = "";              // "checkout.esewa.enabled"
    public bool    DefaultEnabled { get; private set; }
    public List<FeatureFlagOverride> Overrides { get; private set; } = new();
    public string? Description { get; private set; }
    public DateTime UpdatedUtc { get; private set; }
}

public sealed class FeatureFlagOverride : EntityBase<Guid>
{
    public Guid    FeatureFlagId { get; private set; }
    public FeatureFlagAudience Audience { get; private set; }   // Role-wide or per-account
    public RoleKind? RoleKind { get; private set; }
    public Guid?   AccountId { get; private set; }
    public bool    Enabled { get; private set; }
}

public enum FeatureFlagAudience { Role = 1, Account = 2 }

public sealed class PlatformConfigEntry : EntityBase<Guid>
{
    public string Key { get; private set; } = "";
    public string ValueJson { get; private set; } = "null";
    public string Description { get; private set; } = "";
    public DateTime UpdatedUtc { get; private set; }
}
```

`PlatformConfigEntry` hosts the small set of values that aren't
appropriate for deploy-time config — examples in v1.1:

- `support.liveChatHoursLocal` = `"9 AM - 9 PM NPT"`
- `support.supportEmail` = `"help@stylemint.app"`
- `support.directCallPhoneE164` = `"+977-0000000"`
- `payouts.autoWeeklyCron` = `"0 12 * * 5"` (Friday noon NPT)
- `kyc.holidayCalendar` = JSON array of `yyyy-MM-dd` strings

A read of platform config is cache-through to Redis with a 60-second
TTL; writes publish `admin.platform_config.updated.v1` which the
Redis-cache layer uses to invalidate.

## 8. DbContext / schema highlights

```sql
CREATE TABLE admin_accounts (
  id              UUID        PRIMARY KEY,
  sso_subject     TEXT        NOT NULL UNIQUE,
  email           TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  state           SMALLINT    NOT NULL,
  last_login_utc  TIMESTAMPTZ NOT NULL,
  created_utc     TIMESTAMPTZ NOT NULL,
  updated_utc     TIMESTAMPTZ NOT NULL,
  row_version     BYTEA       NOT NULL
);

CREATE TABLE admin_role_assignments (
  id                   UUID        PRIMARY KEY,
  admin_account_id     UUID        NOT NULL REFERENCES admin_accounts(id),
  role                 SMALLINT    NOT NULL,
  assigned_utc         TIMESTAMPTZ NOT NULL,
  assigned_by_admin_id UUID        NOT NULL,
  UNIQUE (admin_account_id, role)
);

CREATE TABLE admin_audit_entries (
  id                UUID        NOT NULL,
  admin_account_id  UUID        NOT NULL,
  action            TEXT        NOT NULL,
  target_kind       TEXT        NOT NULL,
  target_id         TEXT        NOT NULL,
  reason            TEXT        NULL,
  payload_json      JSONB       NOT NULL,
  source_ip         TEXT        NOT NULL,
  occurred_utc      TIMESTAMPTZ NOT NULL,
  created_utc       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, occurred_utc)
) PARTITION BY RANGE (occurred_utc);

CREATE INDEX ix_admin_audit_target
  ON admin_audit_entries (target_kind, target_id, occurred_utc DESC);
CREATE INDEX ix_admin_audit_admin
  ON admin_audit_entries (admin_account_id, occurred_utc DESC);

CREATE TABLE kyc_review_items (
  id                    UUID        PRIMARY KEY,
  applicant_kind        SMALLINT    NOT NULL,
  application_id        UUID        NOT NULL,
  account_id            UUID        NOT NULL,
  state                 SMALLINT    NOT NULL,
  assigned_reviewer_id  UUID        NULL,
  submitted_utc         TIMESTAMPTZ NOT NULL,
  due_by_utc            TIMESTAMPTZ NOT NULL,
  decided_utc           TIMESTAMPTZ NULL,
  decision              SMALLINT    NULL,
  decision_reason_code  TEXT        NULL,
  decision_note         TEXT        NULL,
  created_utc           TIMESTAMPTZ NOT NULL,
  updated_utc           TIMESTAMPTZ NOT NULL,
  row_version           BYTEA       NOT NULL,
  UNIQUE (application_id)
);
CREATE INDEX ix_kyc_state_due ON kyc_review_items (state, due_by_utc);

CREATE TABLE moderation_items (
  id                    UUID        PRIMARY KEY,
  target_kind           SMALLINT    NOT NULL,
  target_id             TEXT        NOT NULL,
  source                SMALLINT    NOT NULL,
  reporter_account_id   UUID        NULL,
  report_reason_code    TEXT        NULL,
  state                 SMALLINT    NOT NULL,
  assigned_reviewer_id  UUID        NULL,
  submitted_utc         TIMESTAMPTZ NOT NULL,
  decided_utc           TIMESTAMPTZ NULL,
  action                SMALLINT    NULL,
  decision_note         TEXT        NULL,
  created_utc           TIMESTAMPTZ NOT NULL,
  updated_utc           TIMESTAMPTZ NOT NULL,
  row_version           BYTEA       NOT NULL
);
CREATE INDEX ix_moderation_state_target ON moderation_items (state, target_kind);

CREATE TABLE feature_flags (
  id               UUID        PRIMARY KEY,
  key              TEXT        NOT NULL UNIQUE,
  default_enabled  BOOLEAN     NOT NULL,
  description      TEXT        NULL,
  created_utc      TIMESTAMPTZ NOT NULL,
  updated_utc      TIMESTAMPTZ NOT NULL,
  row_version      BYTEA       NOT NULL
);

CREATE TABLE feature_flag_overrides (
  id                UUID        PRIMARY KEY,
  feature_flag_id   UUID        NOT NULL REFERENCES feature_flags(id),
  audience          SMALLINT    NOT NULL,
  role_kind         SMALLINT    NULL,
  account_id        UUID        NULL,
  enabled           BOOLEAN     NOT NULL,
  created_utc       TIMESTAMPTZ NOT NULL,
  updated_utc       TIMESTAMPTZ NOT NULL,
  row_version       BYTEA       NOT NULL,
  CHECK ((audience = 1 AND role_kind IS NOT NULL AND account_id IS NULL)
      OR (audience = 2 AND account_id IS NOT NULL AND role_kind IS NULL))
);

CREATE TABLE platform_config_entries (
  id           UUID        PRIMARY KEY,
  key          TEXT        NOT NULL UNIQUE,
  value_json   JSONB       NOT NULL,
  description  TEXT        NOT NULL,
  created_utc  TIMESTAMPTZ NOT NULL,
  updated_utc  TIMESTAMPTZ NOT NULL,
  row_version  BYTEA       NOT NULL
);
```

`admin_audit_entries` is range-partitioned monthly on `occurred_utc`.
Retention: 7 years (legal requirement assumption). Oldest partitions
are detached and archived to cold storage, not dropped.

## 9. Repository interfaces

```csharp
public interface IAdminAccountRepository
    : IRepository<AdminAccount, AdminAccountDto, Guid>
{
    Task<AdminAccount?> GetBySsoSubjectAsync(string ssoSubject, CancellationToken ct);
}

public interface IAdminAuditRepository
{
    Task WriteAsync(AdminAuditEntry entry, CancellationToken ct);
    Task<PagedList<AdminAuditEntry>> QueryAsync(AuditQuery q, CancellationToken ct);
}

public interface IKycReviewItemRepository
    : IRepository<KycReviewItem, KycReviewItemDto, Guid>
{
    Task<PagedList<KycReviewItem>> ListQueueAsync(KycQueueFilter f, int skip, int take, CancellationToken ct);
    Task<KycReviewItem?>           GetByApplicationAsync(Guid applicationId, CancellationToken ct);
}

public interface IModerationItemRepository
    : IRepository<ModerationItem, ModerationItemDto, Guid>
{
    Task<PagedList<ModerationItem>> ListQueueAsync(ModerationQueueFilter f, int skip, int take, CancellationToken ct);
    Task<IReadOnlyList<ModerationItem>> ListOpenForTargetAsync(ModerationTargetKind kind, string targetId, CancellationToken ct);
}

public interface IFeatureFlagRepository
    : IRepository<FeatureFlag, FeatureFlagDto, Guid>
{
    Task<FeatureFlag?> GetByKeyAsync(string key, CancellationToken ct);
    Task<IReadOnlyList<FeatureFlag>> ListAllAsync(CancellationToken ct);
}

public interface IPlatformConfigRepository
    : IRepository<PlatformConfigEntry, PlatformConfigEntryDto, Guid>
{
    Task<PlatformConfigEntry?> GetByKeyAsync(string key, CancellationToken ct);
}
```

## 10. Service interfaces

```csharp
public interface IKycReviewService
{
    Task<ServiceResult<PagedList<KycReviewItemDto>>> ListAsync(KycQueueFilter f, int skip, int take, CancellationToken ct);
    Task<ServiceResult<KycReviewItemDto>>            AssignAsync(Guid itemId, Guid reviewerId, CancellationToken ct);
    Task<ServiceResult<KycReviewItemDto>>            DecideAsync(KycDecisionCommand cmd, CancellationToken ct);
}

public interface IModerationService
{
    Task<ServiceResult<PagedList<ModerationItemDto>>> ListAsync(ModerationQueueFilter f, int skip, int take, CancellationToken ct);
    Task<ServiceResult<ModerationItemDto>>            AssignAsync(Guid itemId, Guid reviewerId, CancellationToken ct);
    Task<ServiceResult<ModerationItemDto>>            DecideAsync(ModerationDecisionCommand cmd, CancellationToken ct);
}

public interface IAdminRefundService
{
    Task<ServiceResult<RefundRecordDto>> IssueAsync(AdminRefundCommand cmd, CancellationToken ct);
}

public interface IAdminPayoutService
{
    Task<ServiceResult> HoldAsync(Guid payoutId, string reason, CancellationToken ct);
    Task<ServiceResult> ReleaseAsync(Guid payoutId, CancellationToken ct);
    Task<ServiceResult> ForceMarkPaidAsync(Guid payoutId, string reason, CancellationToken ct);
    Task<ServiceResult> ForceMarkFailedAsync(Guid payoutId, string reason, CancellationToken ct);
}

public interface IFeatureFlagService
{
    Task<ServiceResult<FeatureFlagDto>> GetAsync(string key, CancellationToken ct);
    Task<ServiceResult<FeatureFlagDto>> UpsertAsync(UpsertFeatureFlagCommand cmd, CancellationToken ct);
    Task<ServiceResult<bool>>           IsEnabledAsync(string key, FeatureFlagEvalContext ctx, CancellationToken ct);
}

public interface IPlatformConfigService
{
    Task<ServiceResult<PlatformConfigEntryDto>> GetAsync(string key, CancellationToken ct);
    Task<ServiceResult<PlatformConfigEntryDto>> SetAsync(SetPlatformConfigCommand cmd, CancellationToken ct);
}

public interface IAdminAuthService   // SSO exchange
{
    Task<ServiceResult<AdminSessionDto>> SsoLoginAsync(SsoLoginCommand cmd, CancellationToken ct);
}
```

Every write service method is wrapped by an `AdminAuditWriter`
decorator from the infra layer. The decorator:

1. Requires an `AdminCallContext` (admin id, source IP, user agent).
2. Calls the inner service.
3. On success, writes the audit entry in the same UnitOfWork.
4. Returns the inner result.

## 11. Endpoints

All routes live under `/v1/admin/*` and require an admin JWT plus a
role check. The concrete role allowlist is given next to each.

KYC:

| Method | Route                                   | Roles                     |
| ------ | --------------------------------------- | ------------------------- |
| GET    | `/v1/admin/kyc/queue`                   | KycReviewer, SuperAdmin   |
| POST   | `/v1/admin/kyc/{id}/assign`             | KycReviewer, SuperAdmin   |
| POST   | `/v1/admin/kyc/{id}/decide`             | KycReviewer, SuperAdmin   |

Moderation:

| Method | Route                                   | Roles                     |
| ------ | --------------------------------------- | ------------------------- |
| GET    | `/v1/admin/moderation/queue`            | ContentMod, SuperAdmin    |
| POST   | `/v1/admin/moderation/{id}/assign`      | ContentMod, SuperAdmin    |
| POST   | `/v1/admin/moderation/{id}/decide`      | ContentMod, SuperAdmin    |

Refunds & payouts overrides:

| Method | Route                                              | Roles                    |
| ------ | -------------------------------------------------- | ------------------------ |
| POST   | `/v1/admin/payments/{intentId}/refund`             | PayoutsOps, SuperAdmin   |
| POST   | `/v1/admin/payouts/{payoutId}/hold`                | PayoutsOps, SuperAdmin   |
| POST   | `/v1/admin/payouts/{payoutId}/release`             | PayoutsOps, SuperAdmin   |
| POST   | `/v1/admin/payouts/{payoutId}/force-paid`          | SuperAdmin               |
| POST   | `/v1/admin/payouts/{payoutId}/force-failed`        | SuperAdmin               |

Flags & config:

| Method | Route                                   | Roles                     |
| ------ | --------------------------------------- | ------------------------- |
| GET    | `/v1/admin/feature-flags`               | All admin roles           |
| PUT    | `/v1/admin/feature-flags/{key}`         | SuperAdmin                |
| GET    | `/v1/admin/platform-config`             | All admin roles           |
| PUT    | `/v1/admin/platform-config/{key}`       | SuperAdmin                |

Admin accounts & auth:

| Method | Route                                   | Roles                     |
| ------ | --------------------------------------- | ------------------------- |
| POST   | `/v1/admin/auth/sso`                    | *(public, SSO callback)*  |
| GET    | `/v1/admin/me`                          | Any authenticated admin   |
| GET    | `/v1/admin/admins`                      | SuperAdmin                |
| POST   | `/v1/admin/admins/{id}/roles/{role}`    | SuperAdmin                |
| DELETE | `/v1/admin/admins/{id}/roles/{role}`    | SuperAdmin                |
| POST   | `/v1/admin/admins/{id}/disable`         | SuperAdmin                |

Audit:

| Method | Route                                   | Roles                     |
| ------ | --------------------------------------- | ------------------------- |
| GET    | `/v1/admin/audit`                       | SuperAdmin, Readonly      |

## 12. Events produced

| Event                                    | When                                 |
| ---------------------------------------- | ------------------------------------ |
| `admin.kyc.decided.v1`                   | KYC decision committed               |
| `admin.moderation.decided.v1`            | Moderation decision committed        |
| `admin.override.applied.v1`              | Refund override / payout override    |
| `admin.feature_flag.changed.v1`          | Flag upsert                          |
| `admin.platform_config.updated.v1`       | Platform config change               |
| `admin.role.assigned.v1`                 | Admin role grant                     |
| `admin.role.revoked.v1`                  | Admin role revoke                    |
| `admin.account.disabled.v1`              | Admin disable                        |

## 13. Events consumed

- `onboarding.creator.application.submitted.v1`,
  `onboarding.vendor.application.submitted.v1` → creates a
  `KycReviewItem`.
- `reels.reel.reported.v1`, `catalog.review.reported.v1`,
  `reels.comment.reported.v1`, `identity.profile.reported.v1` →
  creates (or attaches to existing) `ModerationItem`.
- Automated-scanner outputs (future): same shape, `source =
  AutomatedScanner`.

## 14. State machines

**`KycReviewItem.State`**:

| From      | Event              | To       |
| --------- | ------------------ | -------- |
| Pending   | AssignAsync        | InReview |
| InReview  | Reassign           | InReview |
| InReview  | DecideAsync        | Decided  |

**`ModerationItem.State`**:

| From     | Event         | To       |
| -------- | ------------- | -------- |
| Open     | AssignAsync   | InReview |
| InReview | Reassign      | InReview |
| InReview | DecideAsync   | Decided  |

## 15. Module-specific rules

1. **Every write writes an audit entry in the same transaction.** A
   write with no audit is a defect. The `AdminAuditWriter` decorator
   makes this uniform; service methods that aren't decorated are not
   routable from admin controllers.
2. **Admins have their own account namespace.** Customer/creator/
   vendor JWTs cannot reach `/v1/admin/*`; the auth filter checks
   `sub` prefix before role checks.
3. **Role checks are allowlist, not denylist.** A new endpoint
   without an explicit role list is rejected at startup by a route
   registration assertion.
4. **KYC SLA is 3 business days NPT.** Holidays come from
   `platform_config.kyc.holidayCalendar`.
5. **Moderation actions delegate.** This module never mutates reels,
   reviews, comments, or profiles directly — it calls the owning
   module's service. The decision row is the source of truth for
   *what was decided*; the target module is the source of truth for
   *the current content state*.
6. **Force-paid/force-failed payouts require `SuperAdmin` and a
   non-empty reason.** Both are logged at `warn`, page the on-call
   rotation, and open a follow-up audit review ticket.
7. **Feature flag evaluation order**: per-account override →
   per-role override → default. A single matching override decides;
   ties cannot happen because the check constraint disallows both
   audiences on one row.
8. **Platform config reads are cached 60s** in Redis. Writes emit
   an invalidation event. Writes are still safe against stale reads
   in other processes because the cache TTL caps drift at 60s.
9. **Audit is append-only.** Partitions are detached and archived,
   never updated. A correction is a new audit row referencing the
   original via `TargetKind = "AdminAuditEntry"`, `TargetId =
   <original id>`.
10. **PII in audit payloads is redacted** at write time: phone
    numbers, email addresses, and payment tokens are replaced with
    deterministic SHA-256 prefixes (`phone:<hash-prefix>`). The
    operator UI can show the original by re-fetching from the source
    module if the operator's role allows.
11. **Refund overrides use `ReasonCode` prefixed `ADMIN:`**, followed
    by a short free-form tag (`ADMIN:goodwill`, `ADMIN:fraud-reversal`,
    `ADMIN:duplicate-capture`). This keeps admin-driven refunds
    queryable without a second column.
12. **No admin endpoint may read a customer's password, OTP, or
    payment secret.** `stylemint-identity` and `stylemint-payments`
    never expose these even to admin callers; there is no
    `/v1/admin/*` route that attempts to.

## 16. Cross-module dependencies

- **Depends on**: almost everything. Admin calls into
  `stylemint-identity` (account state, profile), `stylemint-onboarding`
  (applications), `stylemint-reels`, `stylemint-catalog` (reviews),
  `stylemint-payments` (refunds), `stylemint-payouts` (holds),
  `stylemint-support` (ticket views), via their public service
  interfaces. No direct DB reach across module boundaries.
- **Depended on by**: `stylemint-messaging` reads feature flags and
  platform config for channel-level kill switches; `stylemint-backend-core`
  reads platform config for outbox / cache / rate-limit knobs.
- **External**: corporate SSO / OIDC provider.

---

## v2.0 Amendments

Adds admin surfaces for Pillars A–E. Scope / RBAC model from v1.1
unchanged.

### A. AI operations

New endpoints under `/v1/admin/ai/*` (owned by `stylemint-
intelligence`, surfaced via admin console):

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| GET    | `/v1/admin/ai/scorers`                              | Active versions + weights         |
| POST   | `/v1/admin/ai/scorers/{name}/versions`              | Upsert a new version (weights)    |
| POST   | `/v1/admin/ai/scorers/{name}/versions/{v}/activate` | Activate a version                |
| GET    | `/v1/admin/ai/usage`                                | Per-route month spend vs. ceiling |
| PATCH  | `/v1/admin/ai/usage/ceilings`                       | Adjust per-route ceilings         |
| GET    | `/v1/admin/ai/providers/status`                     | Provider health, failover events  |
| POST   | `/v1/admin/ai/embeddings/rebuild`                   | Rebuild a single class (batch)    |

RBAC: `ai-admin` role required. Audit trail on every mutation.

### B. Courier operations

New endpoints:

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| GET    | `/v1/admin/couriers/kyc-queue`                      | Pending KYC reviews               |
| POST   | `/v1/admin/couriers/{id}/kyc/approve`               |                                   |
| POST   | `/v1/admin/couriers/{id}/kyc/reject`                |                                   |
| POST   | `/v1/admin/couriers/{id}/promote/traveler`          | Manual promote override           |
| POST   | `/v1/admin/couriers/{id}/promote/pro`               |                                   |
| POST   | `/v1/admin/couriers/{id}/suspend`                   |                                   |
| POST   | `/v1/admin/couriers/{id}/escrow/draw`               | Admin-gated claim draw            |

RBAC: `courier-ops-admin` role. Claim draws additionally require
a reason note and logged dispute-ticket id.

### C. Reputation operations

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| POST   | `/v1/admin/reputation/{accountId}/recompute`        | Force recompute                   |
| POST   | `/v1/admin/badges/{awardId}/revoke`                 | Revoke a badge                    |
| GET    | `/v1/admin/reputation/appeals-queue`                | Appeals from users                |

### D. Reach (boost) operations

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| GET    | `/v1/admin/reach/spend-overview`                    | Platform-wide boost spend + caps  |
| PATCH  | `/v1/admin/reach/policy/per-decision-ceiling`       | Adjust per-decision ceiling       |
| PATCH  | `/v1/admin/reach/policy/platform-cap`               | Adjust platform-wide spend cap    |
| POST   | `/v1/admin/reach/decision-loop/tick`                | Manual tick                       |
| GET    | `/v1/admin/reach/policy-alerts`                     | External-platform policy drift    |

Platform-wide spend cap is a safety: total managed boost spend
across *all* owners in a month cannot exceed this value. Default
Rs 50,000 at launch (strategy Weeks 9–12 pilot note), raised after
2-week review.

### E. Featured-match curation

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| GET    | `/v1/admin/matchmaking/featured/pending`            | Curation queue                    |
| POST   | `/v1/admin/matchmaking/featured/{id}/approve`       | Approve → push to both sides      |
| POST   | `/v1/admin/matchmaking/featured/{id}/reject`        | Reject with note                  |
| POST   | `/v1/admin/matchmaking/fairness-audit/run`          | Quarterly audit trigger           |
| GET    | `/v1/admin/matchmaking/fairness-audit/latest`       | Latest report                     |

### F. Drop-Party operations

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| GET    | `/v1/admin/drop-parties/live`                       | Live parties overview             |
| POST   | `/v1/admin/drop-parties/{id}/emergency-end`         | Force end (safety)                |

### G. Audio operations

| Method | Route                                               | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| POST   | `/v1/admin/audio/tracks`                            | Add a licensed track              |
| PATCH  | `/v1/admin/audio/tracks/{id}/license`               | Update licensing                  |
| POST   | `/v1/admin/audio/tracks/{id}/retire`                |                                   |
| GET    | `/v1/admin/audio/licenses/expiring-soon`            | Licenses expiring < 14d           |

### H. Platform config surface

New keys under `platform_config`:

```
ai.usage.ceilings.{routeKey}                  -> monthly USD ceiling
ai.scorer.ab.{scorerName}.shadow_version      -> version served to a bucket
delivery.routing.neighbor.enabled_localities  -> string[] of geohash prefixes
delivery.insurance.premium_rate_by_tier       -> map
reach.boost.platform_monthly_cap              -> NPR amount
reach.boost.per_decision_ceiling              -> NPR amount
reach.boost.service_fee_percent               -> decimal (default 0.05)
reach.boost.service_fee_monthly_cap_per_owner -> NPR amount
matchmaking.fairness.disparity_threshold      -> 1.2
social.tip.platform_fee_percent               -> 0.03
story_arc.commission_boost_percent            -> 0.10
story_arc.max_effective_rate                  -> 0.50
```

### I. RBAC additions

New roles: `ai-admin`, `courier-ops-admin`, `boost-admin`,
`featured-match-curator`, `audio-admin`. SuperAdmin always
supersedes.

### J. Audit

Every mutation at `/v1/admin/*` writes an `admin_audit_log` entry
with actor, endpoint, before/after payloads where applicable.
v1.1 behavior unchanged — the additions simply extend the surface.

---

## v2.0 Changelog (May 2026)

| Endpoint | Method | Purpose | Status |
|---|---|---|---|
| `/v1/admin/moderation/cases/{id}/fraud-summary` | POST | Fraud Signal Synthesis — AI-generated fraud risk summary for moderation case | ✅ |
| `/v1/admin/privacy/dashboard` | GET | Privacy Dashboard — GDPR compliance metrics, data requests, consent audit | ✅ |
| `/v1/admin/insurance/claims/{id}/review` | POST | Insurance Claims Review — review and adjudicate campaign insurance claims | ✅ |

### New Features
- **Fraud Signal Synthesis**: AI correlates risk signals across modules (login patterns, payment anomalies, review timing, referral chains) into a single fraud-risk summary per moderation case. Suggests confidence level + recommended action.
- **Privacy Dashboard**: Real-time GDPR compliance overview — active data rights requests, consent revocation trends, PII access audit, deletion queue status, legal hold cases.
- **Insurance Claims Review**: Admin review surface for campaign insurance claims — 14-day filing window enforcement, creator-default verification, performance-predictor gap analysis, payout approval/rejection.

### New Admin Roles
- `ai-admin` — AI operations (scorer management, usage ceilings, provider health)
- `courier-ops-admin` — Courier KYC, promotions, suspensions, escrow draws
- `boost-admin` — Reach/boost spend policy management
- `featured-match-curator` — Featured match curation queue
- `audio-admin` — Track reference management, rights complaint handling

### Bridges
- `stylemint-intelligence` — Fraud synthesis uses signals ledger; AI admin surfaces scorer management
- `stylemint-identity` — Privacy dashboard aggregates GDPR data rights across all 51 tables
- `stylemint-partnerships` — Insurance claims review integrates with campaign insurance policies
- `stylemint-delivery-couriers` — Courier admin operations (KYC, promotions, escrow draws)
- `stylemint-reputation` — Badge revocation, facet recomputation
- `stylemint-audio` — Track reference curation console
