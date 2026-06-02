namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Why an admin session was revoked. Persisted on the session row and
/// emitted on <c>admin.session.revoked.v1</c> so downstream observability
/// can distinguish a routine logout from a security incident.
/// </summary>
public enum AdminSessionRevocationReason : short
{
    /// <summary>Caller hit POST /v1/admin/auth/logout for this session.</summary>
    UserLogout            = 1,

    /// <summary>Caller hit POST /v1/admin/auth/logout-all on themselves.</summary>
    UserLogoutAll         = 2,

    /// <summary>SuperAdmin force-revoked all sessions of another admin.</summary>
    AdminForceRevoke      = 3,

    /// <summary>Admin account moved to <c>Disabled</c> state.</summary>
    AccountDisabled       = 4,

    /// <summary>A role grant/revoke invalidated the current claim set.</summary>
    RoleChanged           = 5,

    /// <summary>Background reaper closed an expired but still-present row.</summary>
    Expired               = 6,

    /// <summary>Risk signal (e.g. impossible-travel, repeated IP-allowlist miss).</summary>
    Security              = 7,
}
