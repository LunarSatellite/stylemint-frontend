using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// Phase 5 admin hardening — app-owned MFA credential for the
/// step-up flow on high-risk admin operations. Distinct from the
/// SSO-time MFA check (which trusts the IdP's <c>amr</c> claim) —
/// step-up requires a FRESH proof done by Style Mint itself.
///
/// State machine:
///   created (Confirmed = null) → confirmed (after first matching code)
///   confirmed → soft-locked (5 consecutive verify failures)
///   soft-locked → confirmed (lockout window elapses)
///
/// Secret is held encrypted (Phase 3 <c>IAdminFieldEncryptor</c>
/// converter applies at the EF layer). Failed-attempts counter +
/// lockout protect against an attacker who knows the admin's session
/// jti from spamming the verify endpoint.
/// </summary>
public sealed class AdminMfaCredential : EntityBase<Guid>
{
    private AdminMfaCredential() { }

    private AdminMfaCredential(
        Guid id, Guid adminAccountId, MfaCredentialKind kind,
        string secret, string label,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id              = id;
        AdminAccountId  = adminAccountId;
        Kind            = kind;
        Secret          = secret;
        Label           = label;
        CreatedById     = createdById;
        CreatedUtc      = nowUtc;
        UpdatedUtc      = nowUtc;
    }

    public Guid               AdminAccountId  { get; private set; }
    public MfaCredentialKind  Kind            { get; private set; }

    /// <summary>
    /// Kind-specific secret. For TOTP this is the 20-byte shared
    /// secret as a base32 string (the form the otpauth URI expects).
    /// Encrypted at rest via <c>IAdminFieldEncryptor</c>; the EF
    /// converter handles encrypt-on-write / decrypt-on-read.
    /// </summary>
    public string             Secret          { get; private set; } = "";

    /// <summary>User-supplied label (e.g. "Yubikey desk", "Authy
    /// phone") — surfaced on the status DTO so a SuperAdmin doing a
    /// remote-wipe knows which credential they're killing.</summary>
    public string             Label           { get; private set; } = "";

    public DateTimeOffset?    ConfirmedUtc    { get; private set; }
    public DateTimeOffset?    LastVerifiedUtc { get; private set; }
    public int                FailedAttempts  { get; private set; }
    public DateTimeOffset?    LockedUntilUtc  { get; private set; }

    public bool IsConfirmed => ConfirmedUtc is not null;

    public bool IsLockedAt(DateTimeOffset nowUtc) =>
        LockedUntilUtc is { } until && until > nowUtc;

    /// <summary>
    /// Factory called from <c>IAdminMfaService.EnrollTotpAsync</c>
    /// after generating a fresh random secret. Label defaults to the
    /// credential kind name if blank.
    /// </summary>
    public static AdminMfaCredential Create(
        Guid adminAccountId, MfaCredentialKind kind, string secret,
        string? label, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(adminAccountId, nameof(adminAccountId));
        Guard.AgainstInvalidEnum(kind, nameof(kind));
        Guard.AgainstNullOrWhiteSpace(secret, nameof(secret), maxLength: 4000);
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (label is { Length: > 120 })
            throw new ArgumentException("label exceeds 120 chars.", nameof(label));

        var cred = new AdminMfaCredential(
            Guid.NewGuid(), adminAccountId, kind, secret.Trim(),
            string.IsNullOrWhiteSpace(label) ? kind.ToString() : label!.Trim(),
            actorId, nowUtc);
        cred.SetRowVersion(NewRowVersionStamp());
        return cred;
    }

    /// <summary>
    /// Idempotent confirm — first successful verify-after-enrollment
    /// marks the credential confirmed. Subsequent calls are no-ops.
    /// </summary>
    public void Confirm(DateTimeOffset nowUtc)
    {
        if (ConfirmedUtc is not null) return;
        ConfirmedUtc    = nowUtc;
        LastVerifiedUtc = nowUtc;
        FailedAttempts  = 0;
        LockedUntilUtc  = null;
        UpdatedUtc      = nowUtc;
    }

    /// <summary>
    /// Record a successful verification. Resets the failure counter
    /// and lockout window. Caller is expected to have already checked
    /// <see cref="IsLockedAt"/> + that the credential is confirmed.
    /// </summary>
    public void RecordSuccess(DateTimeOffset nowUtc)
    {
        if (!IsConfirmed)
            throw new DomainException(
                "Cannot record success on an unconfirmed credential.",
                ErrorCodes.BusinessRule, nameof(IsConfirmed));
        LastVerifiedUtc = nowUtc;
        FailedAttempts  = 0;
        LockedUntilUtc  = null;
        UpdatedUtc      = nowUtc;
    }

    /// <summary>
    /// Record a failed verification. After
    /// <paramref name="lockoutThreshold"/> consecutive failures the
    /// credential is soft-locked for <paramref name="lockoutWindow"/>.
    /// </summary>
    public void RecordFailure(int lockoutThreshold, TimeSpan lockoutWindow, DateTimeOffset nowUtc)
    {
        FailedAttempts += 1;
        UpdatedUtc      = nowUtc;
        if (FailedAttempts >= lockoutThreshold)
            LockedUntilUtc = nowUtc + lockoutWindow;
    }

    /// <summary>
    /// Called by the verifier BEFORE checking the code: if the
    /// lockout window has elapsed since last failure, reset the
    /// counter so the user gets a fresh budget.
    /// </summary>
    public void ResetLockoutIfElapsed(DateTimeOffset nowUtc)
    {
        if (LockedUntilUtc is { } until && until <= nowUtc)
        {
            LockedUntilUtc = null;
            FailedAttempts = 0;
            UpdatedUtc     = nowUtc;
        }
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
