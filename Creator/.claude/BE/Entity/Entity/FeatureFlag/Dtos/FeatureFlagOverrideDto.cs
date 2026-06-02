using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class FeatureFlagOverrideDto
{
    public Guid                 Id            { get; set; }
    public Guid                 FeatureFlagId { get; set; }
    public FeatureFlagAudience  Audience      { get; set; }
    public FeatureFlagRoleKind? RoleKind      { get; set; }
    public Guid?                AccountId     { get; set; }
    public bool                 Enabled       { get; set; }
}
