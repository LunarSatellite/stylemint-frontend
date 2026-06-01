namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Where a moderation item came from (skill §5). User reports carry
/// a reporter id + reason code; automated scanner output carries a
/// scanner-supplied confidence score on the payload (out of v1.1
/// schema scope); admin-spot is an admin opening an item directly
/// on a piece of content from the operator console.
/// </summary>
public enum ModerationSource
{
    UserReport       = 1,
    AutomatedScanner = 2,
    AdminSpot        = 3,
}
