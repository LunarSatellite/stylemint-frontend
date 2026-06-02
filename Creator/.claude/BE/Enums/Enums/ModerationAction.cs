namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// The action taken on a piece of moderated content (skill §5).
/// Any action other than <see cref="NoAction"/> triggers a call into
/// the owning module's service — admin never mutates reels, reviews,
/// comments, or profiles directly.
/// <see cref="SuspendAuthor"/> is the spec-mandated 7-day suspension;
/// <see cref="BanAuthor"/> is indefinite and resolves to an Identity
/// lockout with no expiry.
/// </summary>
public enum ModerationAction
{
    NoAction      = 1,
    HideContent   = 2,
    RemoveContent = 3,
    WarnAuthor    = 4,
    SuspendAuthor = 5,   // 7-day suspension
    BanAuthor     = 6,
}
