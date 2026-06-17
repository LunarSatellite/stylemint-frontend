# Admin Module — Security Hardening Gaps

Planning document. Compiled 2026-05-21.
**Do not implement from this file directly.** It enumerates production-grade
security controls that are missing or partial around the `stylemint-admin`
module and the Core.Api host that fronts it. Review and pick the subset
required before exposing the admin console externally; plan execution
sessions individually per accepted item.

This list combines findings from two passes:
- Pass 1: identity/access, defense-in-depth, observability, job reliability.
- Pass 2: data-handling controls (masking, JIT, field-level encryption,
  break-glass, log redaction, response sanitization).

---

## Executive summary

The Admin module is **functionally complete** (10 controllers, 7 cross-module
gateways, 7 inbound consumers, audit-trail infra, partitioned audit table,
SSO entry) but **not enterprise-hardened**. Most missing controls are
cross-cutting: they belong in `Shared.Infrastructure` or the Core.Api
pipeline, not in the Admin module specifically. A few — break-glass,
JIT elevation, read-access audit — are admin-module-local.

Roughly **17 of 20 audited controls are genuine application-level gaps.**
3 are infrastructure concerns solved at the deploy / cloud-provider layer.

---

## Gap inventory

Severity legend:
- **P0 — must fix before exposing the admin console externally**
- **P1 — must fix before launch / GA**
- **P2 — should fix in first hardening pass post-launch**
- **P3 — nice to have, infra-solvable**

| # | Gap | Severity | Status today | Notes |
|---|---|---|---|---|
| 1 | Token revocation / blacklist | P0 | Missing | JWT stateless; disabling admin account doesn't invalidate in-flight tokens. Add `revoked_tokens` table + middleware check, or rotate signing keys with deny-list. |
| 2 | Session management (list / kill) | P0 | Missing | No per-device session tracking. Add `admin_sessions` aggregate; expose `GET /v1/admin/me/sessions` + `DELETE /v1/admin/me/sessions/{id}`. |
| 3 | Break-glass SuperAdmin workflow | P0 | Missing | `AdminAuthorizationHandler` shortcircuits SuperAdmin with no extra friction. Require justification text + step-up MFA + auto-alert + time-bound elevation token. |
| 4 | IP allowlisting | P0 | Missing | No middleware. Add `AdminIpAllowlistMiddleware` reading from `Admin:IpAllowlist` config (CIDR list); apply to all `/v1/admin/*` except `/v1/admin/auth/sso`. |
| 5 | Rate limiting on `/v1/admin/*` | P0 | Partial | `AddRateLimiter` wired in `Core.Api/Program.cs:600` but only `matchmaking.prefill` policy exists. Add `admin.default` per-admin policy + `admin.auth.sso` IP-bucketed policy. |
| 6 | Field encryption at DB level | P0 | Missing | KYC document URLs, audit JSONB, OIDC subject claims stored plaintext. Add EF value converter using ASP.NET DataProtection or pgcrypto; rotate keys via KMS. |
| 7 | Observability — structured logs | P0 | Missing | No Serilog, no JSON output, no log shipping. Wire Serilog with the existing `CorrelationMiddleware`; ship to Loki/CloudWatch/etc. |
| 8 | Observability — traces + metrics | P0 | Missing | No OpenTelemetry. Wire OTLP exporter; tag spans with `admin.action`, `admin.role`, `admin.target_resource`. |
| 9 | Health checks | P0 | Missing | No `/healthz`. Add `AddHealthChecks` covering Postgres, Redis, RabbitMQ, Hangfire. |
| 10 | API response sanitization layer | P1 | Partial / ad-hoc | Per-DTO masking exists (`ProfileSuppressionMask`, `PayoutDestinationDto`). Build a centralized `IResponseSanitizer<T>` keyed on caller role + data classification; apply via output formatter. |
| 11 | Field-level data masking | P1 | Partial / ad-hoc | No `[Masked(Role.SuperAdmin)]` attribute or convention. Tied to #10. |
| 12 | "Need-to-know" permission system (ABAC) | P1 | Missing | Today: 6 flat roles. Add data classifications (PII / Financial / Internal) + per-classification grants. e.g., `KycReviewer` cannot list all emails, only emails of accounts in their assigned queue. |
| 13 | Just-In-Time (JIT) elevation | P1 | Missing | No expiring role grants. Add `expires_utc` to `AdminRoleAssignment`; build "request elevation" flow with justification + approver. |
| 14 | Read-access audit logging | P1 | Missing | `AdminAuditEntry` only writes on mutations. Add read-event capture for sensitive endpoints (`GET /v1/admin/kyc/{id}`, `GET /v1/admin/payouts/{id}`, `GET /v1/admin/audit`). |
| 15 | Maker-checker / approval workflow | P1 | Missing by design | Maker-checker was retired (per `feedback_financial_modules_use_entitybase`). Reintroduce for destructive ops only: `PayoutsController.ForcePaid`, `PaymentsController.Refund`, role-grant to SuperAdmin, platform-config writes. Two-person rule. |
| 16 | Security alerts / anomaly detection | P1 | Missing | `AdminAuditEntry` is written but nothing watches it. Build event consumer that emits alerts on: login from new IP, role-grant outside business hours, force-mark-paid > X amount, mass KYC rejections. |
| 17 | Global log redaction (everywhere) | P1 | Partial | `PiiRedactor` exists but only invoked on audit payloads. Wire a Serilog destructurer or `ILogger` decorator that runs `PiiRedactor.Redact` on **every** log message before sink. |
| 18 | JWT signing hardening | P2 | Partial | HS256 with platform-key fallback today. Upgrade to RS256 + JWKS endpoint + key rotation. Disjoint kid for `adm_` vs end-user JWTs. |
| 19 | Secrets management abstraction | P2 | Missing | All secrets read from `IConfiguration`. Wire `IConfigurationBuilder.AddVault()` / KeyVault / Secrets Manager. Currently solvable at deploy via env-var injection; abstraction makes rotation easier. |
| 20 | MFA enforcement contract | P2 | Outsourced | Module has no MFA code by design — auth delegated to IdP. Document as deployment requirement: "the configured OIDC IdP MUST enforce MFA for any session with an `adm_` subject." Verify in `OidcAssertionVerifier` (e.g., assert `amr` claim contains `mfa`). |
| 21 | Background job failure alerting | P2 | Partial | Hangfire retries built-in; no alert when retries exhaust. Wire a Hangfire `IElectStateFilter` that publishes to Messaging on `FailedState`. |
| 22 | Tamper-evident audit (signed chain) | P3 | Missing | `AdminAuditEntry` is append-only with partitioning but rows are not cryptographically chained. For SOC 2 / regulator confidence, add a Merkle-chain hash column (mirrors `stylemint-delivery` chain-of-custody pattern). |
| 23 | Database backup + DR | P3 | Out of scope | Solved at managed Postgres layer (point-in-time recovery, cross-region replica). Document RPO/RTO targets in runbook; not application code. |
| 24 | Data encryption at rest (disk) | P3 | Out of scope | Solved at managed Postgres + EBS/disk-encryption layer. Verify in deploy checklist; not application code. |

---

## Severity rollup

**P0 — block external exposure (9 items):**
1. Token revocation
2. Session management
3. Break-glass SuperAdmin
4. IP allowlisting
5. Rate limiting on `/v1/admin/*`
6. Field encryption at DB level
7. Structured logs
8. Traces + metrics
9. Health checks

**P1 — block GA / launch (8 items):**
10. API response sanitization layer
11. Field-level masking
12. ABAC / need-to-know
13. JIT elevation
14. Read-access audit logging
15. Maker-checker on destructive ops
16. Security alerts / anomaly detection
17. Global log redaction

**P2 — first hardening pass (4 items):**
18. JWT RS256 + JWKS
19. Secrets-manager abstraction
20. MFA enforcement assertion in OIDC verifier
21. Hangfire failure alerting

**P3 — infra / nice-to-have (3 items):**
22. Tamper-evident audit chain
23. DB backup + DR (infra)
24. Disk-level encryption (infra)

---

## What's already done (do not duplicate)

These controls **are** present and adequate. Don't redo them:

- **SSO-only authentication.** No password path; OIDC via `OidcAssertionVerifier` (works against Okta/EntraID/Auth0/Keycloak). `AdminAccount.SsoSubject` is the immutable join key. `Email`/`DisplayName` refresh on every login.
- **Disjoint subject namespace.** Admin JWTs carry `adm_<guid>` `sub` claim; `AdminAuthorizationHandler` rejects anything else. A customer/creator/vendor JWT cannot escalate.
- **Per-mutation audit trail.** Every write endpoint writes an `AdminAuditEntry` row in the same transaction (`IAdminAuditWriter`). Partitioned monthly via `Admin_AuditPartitioning` migration. PII-redacted JSONB payload (`PiiRedactor`).
- **PII redaction in audit payloads.** `PiiRedactor` matches email / E.164 phone / processor-token shapes and replaces with `<kind>:<sha256-prefix-12>` using salted hashing. Stable correlation without leakage.
- **Idempotency on every mutating endpoint.** `[Idempotent("admin.*")]` applied across all controllers.
- **Role check enforced at the endpoint.** `[RequireAdminRole(...)]` plus boot-time `AdminEndpointRoleAssertion` to prevent unguarded controllers.
- **Rate-limiter framework wired.** `AddRateLimiter` + `UseRateLimiter` enabled (`Program.cs:600`, `1006`); adding admin policies is config-only.
- **Audit partition rollover automation.** Hangfire job `admin.audit-partition-rollover` provisions next two months on the 1st at 02:00 UTC.

---

## Suggested implementation order

If you implement P0 + P1 in sequence (17 items, est. 4-6 weeks for one engineer):

**Week 1 — Identity & session control**
- 1 Token revocation
- 2 Session management
- 18 JWT RS256 + JWKS

**Week 2 — Defense in depth at the edge**
- 4 IP allowlisting middleware
- 5 Rate-limiter policies for `/v1/admin/*`
- 3 Break-glass SuperAdmin

**Week 3 — Observability**
- 7 Serilog structured logs
- 17 Global log redaction (rides on Serilog)
- 8 OpenTelemetry
- 9 Health checks
- 21 Hangfire failure alerts

**Week 4 — Data controls**
- 6 Field encryption at DB level (EF value converter)
- 10 Response sanitization layer
- 11 Field-level masking attribute
- 12 ABAC / need-to-know
- 14 Read-access audit

**Week 5 — Workflow controls**
- 13 JIT elevation
- 15 Maker-checker on destructive ops
- 16 Security alerts consumer
- 20 MFA assertion in OIDC verifier
- 19 Secrets-manager abstraction (or defer to deploy)

**Pre-launch checklist (infra):**
- 23 Backup + DR target documented + tested
- 24 Disk encryption verified in deploy checklist
- 22 Tamper-evident audit (optional, for compliance posture)

---

## Open questions for product / security review

Before implementing, confirm:

1. **Is the admin console internet-facing or VPN-gated?** If VPN-only, items 4 (IP allowlist) and 5 (rate limiting) drop to P1.
2. **What's the IdP?** Okta / EntraID / Auth0 / Keycloak — confirms which `amr` claim shape to assert for #20.
3. **Compliance target?** SOC 2 / ISO 27001 / PCI / regional KYC regs — drives whether #22 (signed audit chain) and #6 (field encryption) are required vs nice-to-have.
4. **SuperAdmin count target?** Break-glass design depends on whether you have 2-3 humans or 10+. With 2-3, a manual phone-call approval is fine; with 10+, you need a real workflow.
5. **Who owns the SIEM / alert destination?** #16 needs a sink (Slack, PagerDuty, Splunk, custom).
