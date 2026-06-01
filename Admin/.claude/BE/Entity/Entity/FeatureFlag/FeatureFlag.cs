using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// A toggleable platform feature (skill §7). The boolean state seen
/// by any caller comes from <see cref="EvaluateFor"/>: per-account
/// override → per-role override → default. Ties between two same-
/// audience overrides cannot happen because the DB check constraint
/// disallows both audience kinds on one row.
///
/// Keys are stable strings, dotted-namespaced — e.g.
/// <c>"checkout.esewa.enabled"</c>, <c>"feed.cowatch.enabled"</c>.
/// </summary>
public sealed class FeatureFlag : EntityBase<Guid>
{
    private readonly List<FeatureFlagOverride> _overrides = new();

    private FeatureFlag() { }

    private FeatureFlag(
        Guid id, string key, bool defaultEnabled, string? description,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id             = id;
        Key            = key;
        DefaultEnabled = defaultEnabled;
        Description    = description;
        CreatedById    = createdById;
        CreatedUtc     = nowUtc;
        UpdatedUtc     = nowUtc;
    }

    public string  Key            { get; private set; } = "";
    public bool    DefaultEnabled { get; private set; }
    public string? Description    { get; private set; }

    public IReadOnlyList<FeatureFlagOverride> Overrides => _overrides;

    public static FeatureFlag Create(
        string key, bool defaultEnabled, string? description,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstNullOrWhiteSpace(key, nameof(key), maxLength: 200);
        Guard.AgainstEmpty(createdById, nameof(createdById));
        if (description is not null && description.Length > 1000)
            throw new DomainException(
                "Feature-flag description exceeds 1000 chars.",
                ErrorCodes.OutOfRange, nameof(description));

        var flag = new FeatureFlag(
            Guid.NewGuid(), key.Trim(), defaultEnabled, description?.Trim(),
            createdById, nowUtc);
        flag.SetRowVersion(NewRowVersionStamp());
        return flag;
    }

    public void UpdateDefault(bool defaultEnabled, string? description, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (description is not null && description.Length > 1000)
            throw new DomainException(
                "Feature-flag description exceeds 1000 chars.",
                ErrorCodes.OutOfRange, nameof(description));

        DefaultEnabled = defaultEnabled;
        Description    = description?.Trim();
        UpdatedById    = actorId;
        UpdatedUtc     = nowUtc;
    }

    public FeatureFlagOverride SetRoleOverride(
        FeatureFlagRoleKind roleKind, bool enabled, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(roleKind, nameof(roleKind));
        Guard.AgainstEmpty(actorId, nameof(actorId));

        var existing = _overrides.FirstOrDefault(o =>
            o.Audience == FeatureFlagAudience.Role && o.RoleKind == roleKind);
        if (existing is not null)
        {
            existing.UpdateEnabled(enabled, actorId, nowUtc);
            UpdatedById = actorId;
            UpdatedUtc  = nowUtc;
            return existing;
        }

        var ov = FeatureFlagOverride.ForRole(Id, roleKind, enabled, actorId, nowUtc);
        _overrides.Add(ov);
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
        return ov;
    }

    public FeatureFlagOverride SetAccountOverride(
        Guid accountId, bool enabled, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(accountId, nameof(accountId));
        Guard.AgainstEmpty(actorId, nameof(actorId));

        var existing = _overrides.FirstOrDefault(o =>
            o.Audience == FeatureFlagAudience.Account && o.AccountId == accountId);
        if (existing is not null)
        {
            existing.UpdateEnabled(enabled, actorId, nowUtc);
            UpdatedById = actorId;
            UpdatedUtc  = nowUtc;
            return existing;
        }

        var ov = FeatureFlagOverride.ForAccount(Id, accountId, enabled, actorId, nowUtc);
        _overrides.Add(ov);
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
        return ov;
    }

    public bool RemoveRoleOverride(FeatureFlagRoleKind roleKind, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(roleKind, nameof(roleKind));
        Guard.AgainstEmpty(actorId, nameof(actorId));

        var existing = _overrides.FirstOrDefault(o =>
            o.Audience == FeatureFlagAudience.Role && o.RoleKind == roleKind);
        if (existing is null) return false;
        _overrides.Remove(existing);
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
        return true;
    }

    public bool RemoveAccountOverride(Guid accountId, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(accountId, nameof(accountId));
        Guard.AgainstEmpty(actorId, nameof(actorId));

        var existing = _overrides.FirstOrDefault(o =>
            o.Audience == FeatureFlagAudience.Account && o.AccountId == accountId);
        if (existing is null) return false;
        _overrides.Remove(existing);
        UpdatedById = actorId;
        UpdatedUtc  = nowUtc;
        return true;
    }

    /// <summary>
    /// Evaluation order per skill §15 rule 7: per-account override →
    /// per-role override → default. A single matching override decides.
    /// </summary>
    public bool EvaluateFor(Guid? accountId, FeatureFlagRoleKind? activeRole)
    {
        if (accountId.HasValue)
        {
            var perAccount = _overrides.FirstOrDefault(o =>
                o.Audience == FeatureFlagAudience.Account && o.AccountId == accountId.Value);
            if (perAccount is not null) return perAccount.Enabled;
        }

        if (activeRole.HasValue)
        {
            var perRole = _overrides.FirstOrDefault(o =>
                o.Audience == FeatureFlagAudience.Role && o.RoleKind == activeRole.Value);
            if (perRole is not null) return perRole.Enabled;
        }

        return DefaultEnabled;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
