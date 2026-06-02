using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// An internal operator's profile (skill §2). Admins are distinct
/// from end-user Accounts in stylemint-identity: they authenticate
/// only via corporate SSO (OIDC), have a disjoint <c>sub</c> namespace
/// (<c>adm_</c>-prefixed in JWTs minted from this aggregate), and
/// never carry customer/creator/vendor capabilities.
///
/// State machine:
///   Active   → Disabled    (admin off-boarded; cannot mint sessions)
///   Disabled → Active      (re-enable; rare, requires SuperAdmin)
///
/// Role grants live on the child <see cref="AdminRoleAssignment"/>
/// aggregate to keep this row narrow and audit-friendly.
/// </summary>
public sealed class AdminAccount : EntityBase<Guid>
{
    private readonly List<AdminRoleAssignment> _roles = new();

    private AdminAccount() { }

    private AdminAccount(
        Guid id, string ssoSubject, string email, string displayName,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id           = id;
        SsoSubject   = ssoSubject;
        Email        = email;
        DisplayName  = displayName;
        State        = AdminAccountState.Active;
        LastLoginUtc = nowUtc;
        CreatedById  = createdById;
        CreatedUtc   = nowUtc;
        UpdatedUtc   = nowUtc;
    }

    public string            SsoSubject   { get; private set; } = "";
    public string            Email        { get; private set; } = "";
    public string            DisplayName  { get; private set; } = "";
    public AdminAccountState State        { get; private set; }
    public DateTimeOffset    LastLoginUtc { get; private set; }

    /// <summary>
    /// HMAC-SHA256 of <see cref="SsoSubject"/>, hex. Populated by
    /// <c>IAdminFieldEncryptor.LookupHash</c> at write-time so the
    /// at-rest-encrypted <c>sso_subject</c> column is still
    /// queryable. Phase 3 admin hardening.
    /// </summary>
    public string            SsoSubjectLookupHash { get; private set; } = "";

    /// <summary>HMAC-SHA256 of <see cref="Email"/>, hex.</summary>
    public string            EmailLookupHash      { get; private set; } = "";

    public IReadOnlyList<AdminRoleAssignment> Roles => _roles;

    /// <summary>
    /// Factory called from <c>IAdminAuthService.SsoLoginAsync</c> the
    /// first time a particular SSO subject is seen. The IdP-supplied
    /// subject is the immutable join key; email and display name are
    /// mutable claims that get refreshed on subsequent logins.
    /// </summary>
    public static AdminAccount Register(
        string ssoSubject, string email, string displayName,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstNullOrWhiteSpace(ssoSubject, nameof(ssoSubject), maxLength: 200);
        Guard.AgainstNullOrWhiteSpace(email, nameof(email), maxLength: 200);
        Guard.AgainstNullOrWhiteSpace(displayName, nameof(displayName), maxLength: 120);
        Guard.AgainstEmpty(createdById, nameof(createdById));

        var account = new AdminAccount(
            Guid.NewGuid(),
            ssoSubject.Trim(),
            email.Trim().ToLowerInvariant(),
            displayName.Trim(),
            createdById,
            nowUtc);
        account.SetRowVersion(NewRowVersionStamp());
        return account;
    }

    /// <summary>
    /// Refresh mutable identity claims from a fresh IdP assertion. The
    /// SSO subject is immutable; attempts to change it are a programmer
    /// error (the service must lookup by subject before calling this).
    /// </summary>
    public void RefreshFromSso(string email, string displayName, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstNullOrWhiteSpace(email, nameof(email), maxLength: 200);
        Guard.AgainstNullOrWhiteSpace(displayName, nameof(displayName), maxLength: 120);
        Guard.AgainstEmpty(actorId, nameof(actorId));

        Email       = email.Trim().ToLowerInvariant();
        DisplayName = displayName.Trim();
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
    }

    public void RecordLogin(DateTimeOffset nowUtc)
    {
        LastLoginUtc = nowUtc;
        UpdatedUtc   = nowUtc;
    }

    /// <summary>
    /// Refresh the encrypted-column lookup hashes (Phase 3 admin
    /// hardening). Services call this after <see cref="Register"/> or
    /// <see cref="RefreshFromSso"/> with the keyed-hash values
    /// produced by <c>IAdminFieldEncryptor.LookupHash</c>.
    /// </summary>
    public void SetLookupHashes(string ssoSubjectHash, string emailHash)
    {
        Guard.AgainstNullOrWhiteSpace(ssoSubjectHash, nameof(ssoSubjectHash), maxLength: 128);
        Guard.AgainstNullOrWhiteSpace(emailHash,      nameof(emailHash),      maxLength: 128);
        SsoSubjectLookupHash = ssoSubjectHash;
        EmailLookupHash      = emailHash;
    }

    public void Disable(Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State == AdminAccountState.Disabled) return;          // idempotent
        State       = AdminAccountState.Disabled;
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
    }

    public void Enable(Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State == AdminAccountState.Active) return;            // idempotent
        State       = AdminAccountState.Active;
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
    }

    /// <summary>
    /// Append an <see cref="AdminRoleAssignment"/>. Per skill §2 roles
    /// are additive; we silently no-op on duplicates so the SuperAdmin
    /// UI can stay idempotent on bulk grant operations.
    /// </summary>
    public AdminRoleAssignment? GrantRole(AdminRole role, Guid assignedByAdminId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(role, nameof(role));
        Guard.AgainstEmpty(assignedByAdminId, nameof(assignedByAdminId));
        if (State == AdminAccountState.Disabled)
            throw new DomainException(
                "Cannot grant roles on a disabled admin account.",
                ErrorCodes.BusinessRule, nameof(role));

        if (_roles.Any(r => r.Role == role)) return null;

        var assignment = AdminRoleAssignment.Create(Id, role, assignedByAdminId, nowUtc);
        _roles.Add(assignment);
        UpdatedById = assignedByAdminId;
        UpdatedUtc  = nowUtc;
        return assignment;
    }

    /// <summary>
    /// Remove an <see cref="AdminRoleAssignment"/>. Returns the removed
    /// row (for audit payload) or null on no-op. Removing the last
    /// SuperAdmin is prevented at the service layer, not here — the
    /// entity doesn't know about the global SuperAdmin count.
    /// </summary>
    public AdminRoleAssignment? RevokeRole(AdminRole role, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(role, nameof(role));
        Guard.AgainstEmpty(actorId, nameof(actorId));

        var assignment = _roles.FirstOrDefault(r => r.Role == role);
        if (assignment is null) return null;
        _roles.Remove(assignment);
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
        return assignment;
    }

    public bool HasRole(AdminRole role) =>
        _roles.Any(r => r.Role == role);

    public bool HasAnyRole(IEnumerable<AdminRole> roles) =>
        _roles.Any(r => roles.Contains(r.Role));

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
