namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// What kind of content a <see cref="Entity.ModerationItem"/>
/// references (skill §5). The TargetId on the moderation item is a
/// stringified key in the owning module; the owning module remains
/// the source of truth for the current content state.
/// </summary>
public enum ModerationTargetKind
{
    Reel        = 1,
    Review      = 2,
    ReelComment = 3,
    Profile     = 4,
}
