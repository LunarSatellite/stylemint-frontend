using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// Maps an <see cref="AdminRole"/> to a single permission code (Phase 2
/// ABAC). Multiple rows per role compose the role's permission bundle.
/// The bundle is fully determined by these rows — there is no "implicit"
/// permission tied to a role enum value.
///
/// Unique on (Role, Permission). Seeded from <c>AdminAbacSeeder</c>;
/// SuperAdmins can re-seed at boot (idempotent on the unique key) or
/// mutate the set at runtime via the admin console.
/// </summary>
public sealed class AdminRolePermissionLink : EntityBase<Guid>
{
    private AdminRolePermissionLink() { }

    private AdminRolePermissionLink(
        Guid id, AdminRole role, string permission,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id          = id;
        Role        = role;
        Permission  = permission;
        CreatedById = createdById;
        CreatedUtc  = nowUtc;
        UpdatedUtc  = nowUtc;
    }

    public AdminRole Role       { get; private set; }
    public string    Permission { get; private set; } = "";

    public static AdminRolePermissionLink Create(
        AdminRole role, string permission, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(role, nameof(role));
        Guard.AgainstNullOrWhiteSpace(permission, nameof(permission), maxLength: 120);
        Guard.AgainstEmpty(actorId, nameof(actorId));
        var link = new AdminRolePermissionLink(
            Guid.NewGuid(), role, permission.Trim(), actorId, nowUtc);
        link.SetRowVersion(NewRowVersionStamp());
        return link;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
