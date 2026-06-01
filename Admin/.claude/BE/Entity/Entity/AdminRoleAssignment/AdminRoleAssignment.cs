using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// One row per (AdminAccount, AdminRole) pair (skill §2). Lives as a
/// child of <see cref="AdminAccount"/> so the parent owns the
/// invariants — "grant" is <c>parent.GrantRole(...)</c>, never a
/// direct construction from outside.
/// </summary>
public sealed class AdminRoleAssignment : EntityBase<Guid>
{
    private AdminRoleAssignment() { }

    private AdminRoleAssignment(
        Guid id, Guid adminAccountId, AdminRole role,
        Guid assignedByAdminId, DateTimeOffset nowUtc)
    {
        Id                = id;
        AdminAccountId    = adminAccountId;
        Role              = role;
        AssignedUtc       = nowUtc;
        AssignedByAdminId = assignedByAdminId;
        CreatedById       = assignedByAdminId;
        CreatedUtc        = nowUtc;
        UpdatedUtc        = nowUtc;
    }

    public Guid           AdminAccountId    { get; private set; }
    public AdminRole      Role              { get; private set; }
    public DateTimeOffset AssignedUtc       { get; private set; }
    public Guid           AssignedByAdminId { get; private set; }

    internal static AdminRoleAssignment Create(
        Guid adminAccountId, AdminRole role,
        Guid assignedByAdminId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(adminAccountId, nameof(adminAccountId));
        Guard.AgainstEmpty(assignedByAdminId, nameof(assignedByAdminId));
        Guard.AgainstInvalidEnum(role, nameof(role));

        var assignment = new AdminRoleAssignment(
            Guid.NewGuid(), adminAccountId, role, assignedByAdminId, nowUtc);
        assignment.SetRowVersion(NewRowVersionStamp());
        return assignment;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
