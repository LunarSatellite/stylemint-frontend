using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class AdminAccountDto
{
    public Guid                              Id           { get; set; }
    public string                            SsoSubject   { get; set; } = "";
    public string                            Email        { get; set; } = "";
    public string                            DisplayName  { get; set; } = "";
    public AdminAccountState                 State        { get; set; }
    public DateTimeOffset                    LastLoginUtc { get; set; }
    public DateTimeOffset                    CreatedUtc   { get; set; }
    public DateTimeOffset                    UpdatedUtc   { get; set; }
    public string?                           RowVersion   { get; set; }
    public IReadOnlyList<AdminRoleAssignmentDto> Roles    { get; set; } = Array.Empty<AdminRoleAssignmentDto>();
}
