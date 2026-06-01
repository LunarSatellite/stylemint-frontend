namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// The role taxonomy a <see cref="FeatureFlagAudience.Role"/> override
/// can target. These mirror the end-user role profiles in
/// stylemint-identity (Customer / Creator / Vendor) — feature flags
/// live one layer above and never carry admin roles.
/// </summary>
public enum FeatureFlagRoleKind
{
    Customer = 1,
    Creator  = 2,
    Vendor   = 3,
}
