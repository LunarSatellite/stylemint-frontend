using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// Per-admin permission override (Phase 2 ABAC). One row = one
/// "this admin additionally has X" (grant) OR "this admin must NOT
/// have X" (deny). Denies trump role-derived grants for forensic
/// reasons — a SuperAdmin with an explicit deny on
/// <c>payouts:force_mark</c> is honored.
///
/// Unique on (AdminAccountId, Permission, IsDeny=false) and
/// (AdminAccountId, Permission, IsDeny=true) so each admin can hold at
/// most one grant + one deny per permission code.
/// </summary>
public sealed class AdminAccountPermissionGrant : EntityBase<Guid>
{
    private AdminAccountPermissionGrant() { }

    private AdminAccountPermissionGrant(
        Guid id, Guid adminAccountId, string permission, bool isDeny,
        string? note, Guid grantedById, DateTimeOffset nowUtc)
    {
        Id              = id;
        AdminAccountId  = adminAccountId;
        Permission      = permission;
        IsDeny          = isDeny;
        Note            = note;
        CreatedById     = grantedById;
        CreatedUtc      = nowUtc;
        UpdatedUtc      = nowUtc;
    }

    public Guid    AdminAccountId { get; private set; }
    public string  Permission     { get; private set; } = "";
    public bool    IsDeny         { get; private set; }
    public string? Note           { get; private set; }

    public static AdminAccountPermissionGrant Grant(
        Guid adminAccountId, string permission, string? note,
        Guid grantedById, DateTimeOffset nowUtc)
        => Build(adminAccountId, permission, isDeny: false, note, grantedById, nowUtc);

    public static AdminAccountPermissionGrant Deny(
        Guid adminAccountId, string permission, string? note,
        Guid deniedById, DateTimeOffset nowUtc)
        => Build(adminAccountId, permission, isDeny: true, note, deniedById, nowUtc);

    private static AdminAccountPermissionGrant Build(
        Guid adminAccountId, string permission, bool isDeny, string? note,
        Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(adminAccountId, nameof(adminAccountId));
        Guard.AgainstNullOrWhiteSpace(permission, nameof(permission), maxLength: 120);
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (note is not null && note.Length > 500)
            throw new ArgumentException("note exceeds 500 chars.", nameof(note));

        var grant = new AdminAccountPermissionGrant(
            Guid.NewGuid(), adminAccountId, permission.Trim(), isDeny,
            note?.Trim(), actorId, nowUtc);
        grant.SetRowVersion(NewRowVersionStamp());
        return grant;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
