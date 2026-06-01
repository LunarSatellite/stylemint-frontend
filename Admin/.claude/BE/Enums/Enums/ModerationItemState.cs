namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Moderation item lifecycle (skill §14). Mirrors KYC review except
/// the entry state is Open (an unassigned moderation item is
/// actionable as-is by any ContentMod; KYC items must be assigned
/// first).
/// </summary>
public enum ModerationItemState
{
    Open     = 1,
    InReview = 2,
    Decided  = 3,
}
