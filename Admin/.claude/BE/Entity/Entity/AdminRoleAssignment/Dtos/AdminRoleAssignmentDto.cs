using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class AdminRoleAssignmentDto
{
    public Guid           Id                { get; set; }
    public Guid           AdminAccountId    { get; set; }
    public AdminRole      Role              { get; set; }
    public DateTimeOffset AssignedUtc       { get; set; }
    public Guid           AssignedByAdminId { get; set; }
}
