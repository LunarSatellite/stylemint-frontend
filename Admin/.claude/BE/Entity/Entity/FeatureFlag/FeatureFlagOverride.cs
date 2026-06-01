using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// Per-audience override for a <see cref="FeatureFlag"/> (skill §7).
/// Exactly one of (RoleKind, AccountId) is populated, enforced both
/// at the factory level here and by the DB check constraint
/// <c>ck_feature_flag_overrides_audience_xor</c>.
/// </summary>
public sealed class FeatureFlagOverride : EntityBase<Guid>
{
    private FeatureFlagOverride() { }

    private FeatureFlagOverride(
        Guid id, Guid featureFlagId, FeatureFlagAudience audience,
        FeatureFlagRoleKind? roleKind, Guid? accountId, bool enabled,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id             = id;
        FeatureFlagId  = featureFlagId;
        Audience       = audience;
        RoleKind       = roleKind;
        AccountId      = accountId;
        Enabled        = enabled;
        CreatedById    = createdById;
        CreatedUtc     = nowUtc;
        UpdatedUtc     = nowUtc;
    }

    public Guid                 FeatureFlagId { get; private set; }
    public FeatureFlagAudience  Audience      { get; private set; }
    public FeatureFlagRoleKind? RoleKind      { get; private set; }
    public Guid?                AccountId     { get; private set; }
    public bool                 Enabled       { get; private set; }

    internal static FeatureFlagOverride ForRole(
        Guid featureFlagId, FeatureFlagRoleKind roleKind, bool enabled,
        Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(featureFlagId, nameof(featureFlagId));
        Guard.AgainstInvalidEnum(roleKind, nameof(roleKind));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        var ov = new FeatureFlagOverride(
            Guid.NewGuid(), featureFlagId, FeatureFlagAudience.Role,
            roleKind, accountId: null, enabled, actorId, nowUtc);
        ov.SetRowVersion(NewRowVersionStamp());
        return ov;
    }

    internal static FeatureFlagOverride ForAccount(
        Guid featureFlagId, Guid accountId, bool enabled,
        Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(featureFlagId, nameof(featureFlagId));
        Guard.AgainstEmpty(accountId, nameof(accountId));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        var ov = new FeatureFlagOverride(
            Guid.NewGuid(), featureFlagId, FeatureFlagAudience.Account,
            roleKind: null, accountId, enabled, actorId, nowUtc);
        ov.SetRowVersion(NewRowVersionStamp());
        return ov;
    }

    internal void UpdateEnabled(bool enabled, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(actorId, nameof(actorId));
        Enabled     = enabled;
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
