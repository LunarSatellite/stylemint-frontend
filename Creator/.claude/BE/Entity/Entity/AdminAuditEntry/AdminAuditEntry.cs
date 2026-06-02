using StyleMint.Shared.Core.Validation;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// One row per /v1/admin/* mutating call (skill §3, §15 rule 1). This
/// table is the non-negotiable invariant of the module: every write
/// stages exactly one of these inside the same UnitOfWork as the
/// action it describes, via the <c>AdminAuditWriter</c> decorator.
///
/// Append-only — corrections are new rows referencing the original via
/// TargetKind="AdminAuditEntry", TargetId=&lt;original id&gt; (skill §15
/// rule 9). Range-partitioned monthly on <c>OccurredUtc</c>; retention
/// 7 years; oldest partitions detached and archived, never DROPPED.
///
/// PII redaction: phone/email/payment-token shaped substrings in
/// <c>PayloadJson</c> are SHA-256-prefixed by <c>PiiRedactor</c> at
/// write time (skill §15 rule 10). The original is fetchable from
/// the source module when the operator's role allows.
///
/// Audit rows intentionally do NOT inherit EntityBase — they are not
/// updatable, so the RowVersion + UpdatedUtc machinery would be a
/// liability. The PK is composite <c>(id, occurred_utc)</c> to satisfy
/// Postgres' partition-key-must-be-in-PK rule.
/// </summary>
public sealed class AdminAuditEntry
{
    private AdminAuditEntry() { }

    private AdminAuditEntry(
        Guid id, Guid adminAccountId, string action,
        string targetKind, string targetId, string? reason,
        string payloadJson, string sourceIp, string userAgent,
        DateTimeOffset occurredUtc)
    {
        Id              = id;
        AdminAccountId  = adminAccountId;
        Action          = action;
        TargetKind      = targetKind;
        TargetId        = targetId;
        Reason          = reason;
        PayloadJson     = payloadJson;
        SourceIp        = sourceIp;
        UserAgent       = userAgent;
        OccurredUtc     = occurredUtc;
        CreatedUtc      = occurredUtc;
    }

    public Guid           Id              { get; private set; }
    public Guid           AdminAccountId  { get; private set; }

    /// <summary>Verb-form action key, e.g. <c>"kyc.creator.approved"</c>.</summary>
    public string         Action          { get; private set; } = "";

    /// <summary>Aggregate name of the target, e.g. <c>"CreatorApplication"</c>.</summary>
    public string         TargetKind      { get; private set; } = "";

    /// <summary>
    /// Stringified key of the target (Guid.ToString() for entity keys,
    /// composite for {SubOrderId}#{LineId}-style targets).
    /// </summary>
    public string         TargetId        { get; private set; } = "";

    /// <summary>Operator-supplied free-form note. Validated at the service layer.</summary>
    public string?        Reason          { get; private set; }

    /// <summary>
    /// Command payload as JSON, with PII redacted (<c>PiiRedactor</c>).
    /// Stored in Postgres JSONB so future operator-console queries can
    /// filter on individual fields.
    /// </summary>
    public string         PayloadJson     { get; private set; } = "{}";

    public string         SourceIp        { get; private set; } = "";
    public string         UserAgent       { get; private set; } = "";
    public DateTimeOffset OccurredUtc     { get; private set; }
    public DateTimeOffset CreatedUtc      { get; private set; }

    /// <summary>
    /// Factory used by <c>AdminAuditWriter</c>. All inputs are validated
    /// — passing an empty action or target id is a programmer error
    /// (would yield untraceable audit rows).
    /// </summary>
    public static AdminAuditEntry Record(
        Guid adminAccountId, string action,
        string targetKind, string targetId,
        string? reason, string payloadJson,
        string sourceIp, string userAgent,
        DateTimeOffset occurredUtc)
    {
        Guard.AgainstEmpty(adminAccountId, nameof(adminAccountId));
        Guard.AgainstNullOrWhiteSpace(action, nameof(action), maxLength: 120);
        Guard.AgainstNullOrWhiteSpace(targetKind, nameof(targetKind), maxLength: 120);
        Guard.AgainstNullOrWhiteSpace(targetId, nameof(targetId), maxLength: 200);
        if (reason is not null && reason.Length > 1000)
            throw new ArgumentException("Audit reason exceeds 1000 chars.", nameof(reason));

        return new AdminAuditEntry(
            Guid.NewGuid(), adminAccountId, action.Trim(),
            targetKind.Trim(), targetId.Trim(), reason?.Trim(),
            payloadJson ?? "{}", sourceIp ?? "", userAgent ?? "",
            occurredUtc);
    }
}
