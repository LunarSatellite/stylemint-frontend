using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// One row per minted admin JWT — the persistence half of the token
/// revocation + session-tracking story (Phase 1 of the admin hardening
/// pass). Pair this with the Redis denylist on <c>Jti</c> so middleware
/// can short-circuit revoked tokens without a DB hit.
///
/// State machine:
///   (created Active)  Revoked = null
///   Active → Revoked   one-way; set RevokedUtc + RevokedReason
///
/// The row is NOT deleted on revoke — audit trail wants the full
/// session history. A reaper (Hangfire job) closes naturally-expired
/// rows by setting RevokedReason = <c>Expired</c> after ExpiresUtc.
///
/// LastSeenUtc is touched by the revocation middleware on every
/// successful request, with a debounce (only update if &gt; 60s since
/// the last touch) so we don't generate DB write storms.
/// </summary>
public sealed class AdminSession : EntityBase<Guid>
{
    private AdminSession() { }

    private AdminSession(
        Guid id, Guid adminAccountId, Guid jti,
        DateTimeOffset issuedUtc, DateTimeOffset expiresUtc,
        string sourceIp, string userAgent,
        DateTimeOffset? mfaAssertedUtc, string? mfaAcr,
        DateTimeOffset nowUtc)
    {
        Id              = id;
        AdminAccountId  = adminAccountId;
        Jti             = jti;
        IssuedUtc       = issuedUtc;
        ExpiresUtc      = expiresUtc;
        LastSeenUtc     = issuedUtc;
        SourceIp        = sourceIp;
        UserAgent       = userAgent;
        MfaAssertedUtc  = mfaAssertedUtc;
        MfaAcr          = mfaAcr;
        CreatedById     = adminAccountId;
        CreatedUtc      = nowUtc;
        UpdatedUtc      = nowUtc;
    }

    public Guid                          AdminAccountId  { get; private set; }

    /// <summary>The <c>jti</c> claim of the JWT bound to this session.</summary>
    public Guid                          Jti             { get; private set; }

    public DateTimeOffset                IssuedUtc       { get; private set; }
    public DateTimeOffset                ExpiresUtc      { get; private set; }
    public DateTimeOffset                LastSeenUtc     { get; private set; }
    public string                        SourceIp        { get; private set; } = "";
    public string                        UserAgent       { get; private set; } = "";

    /// <summary>UTC instant the IdP asserted MFA; null = no MFA evidence.</summary>
    public DateTimeOffset?               MfaAssertedUtc  { get; private set; }

    /// <summary>The <c>acr</c> claim value from the OIDC assertion (e.g. "urn:mace:incommon:iap:silver").</summary>
    public string?                       MfaAcr          { get; private set; }

    public DateTimeOffset?               RevokedUtc      { get; private set; }
    public AdminSessionRevocationReason? RevokedReason   { get; private set; }
    public Guid?                         RevokedByAdminId { get; private set; }

    /// <summary>
    /// UTC instant the admin last passed the app-owned step-up MFA
    /// challenge (Phase 5 hardening). The
    /// <c>[RequireStepUpMfa]</c> attribute checks this against its
    /// configured max-age. Null until the first verify on this
    /// session.
    /// </summary>
    public DateTimeOffset?               LastStepUpUtc   { get; private set; }

    public bool IsActive(DateTimeOffset nowUtc) =>
        RevokedUtc is null && ExpiresUtc > nowUtc;

    /// <summary>
    /// Records a successful step-up MFA verification on this session.
    /// Called by <c>IAdminMfaService.VerifyTotpAsync</c>. The session
    /// is the storage for step-up evidence so that revoking the
    /// session (logout) invalidates the step-up at the same time.
    /// </summary>
    public void MarkStepUp(DateTimeOffset nowUtc)
    {
        LastStepUpUtc = nowUtc;
        UpdatedUtc    = nowUtc;
    }

    /// <summary>
    /// Factory called from <c>IAdminAuthService.SsoLoginAsync</c> after
    /// the JWT has been minted (so we already know jti + expiry).
    /// </summary>
    public static AdminSession Open(
        Guid adminAccountId, Guid jti,
        DateTimeOffset issuedUtc, DateTimeOffset expiresUtc,
        string sourceIp, string userAgent,
        DateTimeOffset? mfaAssertedUtc, string? mfaAcr,
        DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(adminAccountId, nameof(adminAccountId));
        Guard.AgainstEmpty(jti,            nameof(jti));
        if (expiresUtc <= issuedUtc)
            throw new ArgumentException("expiresUtc must be after issuedUtc.", nameof(expiresUtc));

        var session = new AdminSession(
            Guid.NewGuid(), adminAccountId, jti,
            issuedUtc, expiresUtc,
            sourceIp ?? "", userAgent ?? "",
            mfaAssertedUtc, mfaAcr,
            nowUtc);
        session.SetRowVersion(NewRowVersionStamp());
        return session;
    }

    /// <summary>
    /// Idempotent. A second revoke on an already-revoked row is a no-op
    /// so the SuperAdmin force-revoke endpoint can stay bulk-safe.
    /// </summary>
    public void Revoke(AdminSessionRevocationReason reason, Guid? revokedByAdminId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(reason, nameof(reason));
        if (RevokedUtc is not null) return;
        RevokedUtc       = nowUtc;
        RevokedReason    = reason;
        RevokedByAdminId = revokedByAdminId;
        UpdatedUtc       = nowUtc;
        UpdatedById      = revokedByAdminId;
    }

    /// <summary>
    /// Touched by the revocation middleware on every successful request.
    /// Caller is expected to debounce (only call if &gt; 60s since
    /// previous touch) so we don't generate write storms.
    /// </summary>
    public void Touch(string sourceIp, string userAgent, DateTimeOffset nowUtc)
    {
        LastSeenUtc = nowUtc;
        if (!string.IsNullOrWhiteSpace(sourceIp))  SourceIp  = sourceIp;
        if (!string.IsNullOrWhiteSpace(userAgent)) UserAgent = userAgent;
        UpdatedUtc  = nowUtc;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
