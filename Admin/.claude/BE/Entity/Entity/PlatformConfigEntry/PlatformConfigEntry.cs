using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// One row per platform-config key (skill §7). These are
/// runtime-mutable values that aren't appropriate for deploy-time
/// config — operations like quiet-hours schedules, support contact
/// strings, the KYC holiday calendar, etc.
///
/// <c>ValueJson</c> is stored as Postgres JSONB so consumers can
/// project sub-fields cheaply on the read side. The service layer
/// is responsible for JSON-shape validation per known key.
/// </summary>
public sealed class PlatformConfigEntry : EntityBase<Guid>
{
    private PlatformConfigEntry() { }

    private PlatformConfigEntry(
        Guid id, string key, string valueJson, string description,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id           = id;
        Key          = key;
        ValueJson    = valueJson;
        Description  = description;
        CreatedById  = createdById;
        CreatedUtc   = nowUtc;
        UpdatedUtc   = nowUtc;
    }

    public string Key         { get; private set; } = "";
    public string ValueJson   { get; private set; } = "null";
    public string Description { get; private set; } = "";

    public static PlatformConfigEntry Create(
        string key, string valueJson, string description,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstNullOrWhiteSpace(key, nameof(key), maxLength: 200);
        Guard.AgainstEmpty(createdById, nameof(createdById));
        if (string.IsNullOrWhiteSpace(valueJson))
            throw new DomainException(
                "Platform config value cannot be empty; pass JSON 'null' to represent absence.",
                ErrorCodes.Required, nameof(valueJson));
        if (description is null || description.Length > 1000)
            throw new DomainException(
                "Description is required and must be ≤ 1000 chars.",
                ErrorCodes.OutOfRange, nameof(description));

        var entry = new PlatformConfigEntry(
            Guid.NewGuid(), key.Trim(), valueJson, description.Trim(),
            createdById, nowUtc);
        entry.SetRowVersion(NewRowVersionStamp());
        return entry;
    }

    public void UpdateValue(string valueJson, string? description, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (string.IsNullOrWhiteSpace(valueJson))
            throw new DomainException(
                "Platform config value cannot be empty; pass JSON 'null' to represent absence.",
                ErrorCodes.Required, nameof(valueJson));
        if (description is not null && description.Length > 1000)
            throw new DomainException(
                "Description exceeds 1000 chars.",
                ErrorCodes.OutOfRange, nameof(description));

        ValueJson   = valueJson;
        if (description is not null) Description = description.Trim();
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
