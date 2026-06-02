namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Closed set of user-report reason codes (skill §5). Persisted as
/// strings on <see cref="Entity.ModerationItem.ReportReasonCode"/>
/// — same convention as <see cref="KycDecisionReasonCode"/>.
/// </summary>
public static class ModerationReportReasonCode
{
    public const string Spam                = "SPAM";
    public const string NudityOrSexual      = "NUDITY_OR_SEXUAL";
    public const string HateOrHarassment    = "HATE_OR_HARASSMENT";
    public const string Violence            = "VIOLENCE";
    public const string Misleading          = "MISLEADING";
    public const string CounterfeitProduct  = "COUNTERFEIT_PRODUCT";
    public const string Other               = "OTHER";

    public static readonly IReadOnlySet<string> AllCodes = new HashSet<string>(StringComparer.Ordinal)
    {
        Spam, NudityOrSexual, HateOrHarassment, Violence,
        Misleading, CounterfeitProduct, Other,
    };
}
