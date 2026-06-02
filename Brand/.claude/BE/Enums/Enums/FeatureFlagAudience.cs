namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// What kind of consumer a feature-flag override targets (skill §7).
/// The check constraint on <c>feature_flag_overrides</c> enforces the
/// XOR: Role audience requires <c>role_kind IS NOT NULL</c> and
/// <c>account_id IS NULL</c>; Account audience requires the inverse.
/// </summary>
public enum FeatureFlagAudience
{
    Role    = 1,
    Account = 2,
}
