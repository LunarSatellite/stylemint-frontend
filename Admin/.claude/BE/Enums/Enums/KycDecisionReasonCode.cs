namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Closed set of KYC decision reason codes (skill §4). Stored on
/// <see cref="Entity.KycReviewItem.DecisionReasonCode"/> as a string
/// (these constants — NOT the enum name) so the column stays stable
/// even if the enum is renamed. Codes group by terminality:
/// retryable codes pair with <see cref="KycDecision.RejectedRetryable"/>,
/// terminal codes pair with <see cref="KycDecision.RejectedTerminal"/>.
/// </summary>
public static class KycDecisionReasonCode
{
    // Retryable
    public const string DocsUnclear                = "DOCS_UNCLEAR";
    public const string DocsMismatch               = "DOCS_MISMATCH";
    public const string CategoryMissing            = "CATEGORY_MISSING";
    public const string PolicyViolationRecoverable = "POLICY_VIOLATION_RECOVERABLE";

    // Terminal
    public const string FraudSuspected             = "FRAUD_SUSPECTED";
    public const string SanctionsHit               = "SANCTIONS_HIT";
    public const string Underage                   = "UNDERAGE";

    public static readonly IReadOnlySet<string> RetryableCodes = new HashSet<string>(StringComparer.Ordinal)
    {
        DocsUnclear, DocsMismatch, CategoryMissing, PolicyViolationRecoverable,
    };

    public static readonly IReadOnlySet<string> TerminalCodes = new HashSet<string>(StringComparer.Ordinal)
    {
        FraudSuspected, SanctionsHit, Underage,
    };

    public static readonly IReadOnlySet<string> AllCodes = new HashSet<string>(StringComparer.Ordinal)
    {
        DocsUnclear, DocsMismatch, CategoryMissing, PolicyViolationRecoverable,
        FraudSuspected, SanctionsHit, Underage,
    };
}
