using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class AdminMfaCredentialDto
{
    public Guid              Id              { get; set; }
    public Guid              AdminAccountId  { get; set; }
    public MfaCredentialKind Kind            { get; set; }
    public string            Label           { get; set; } = "";
    public DateTimeOffset?   ConfirmedUtc    { get; set; }
    public DateTimeOffset?   LastVerifiedUtc { get; set; }
    public int               FailedAttempts  { get; set; }
    public DateTimeOffset?   LockedUntilUtc  { get; set; }
    public DateTimeOffset    CreatedUtc      { get; set; }
    public string?           RowVersion      { get; set; }
}
