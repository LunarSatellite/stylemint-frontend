using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class AdminSessionDto
{
    public Guid                          Id               { get; set; }
    public Guid                          AdminAccountId   { get; set; }
    public Guid                          Jti              { get; set; }
    public DateTimeOffset                IssuedUtc        { get; set; }
    public DateTimeOffset                ExpiresUtc       { get; set; }
    public DateTimeOffset                LastSeenUtc      { get; set; }
    public string                        SourceIp         { get; set; } = "";
    public string                        UserAgent        { get; set; } = "";
    public DateTimeOffset?               MfaAssertedUtc   { get; set; }
    public string?                       MfaAcr           { get; set; }
    public DateTimeOffset?               RevokedUtc       { get; set; }
    public AdminSessionRevocationReason? RevokedReason    { get; set; }
    public Guid?                         RevokedByAdminId { get; set; }
    public DateTimeOffset?               LastStepUpUtc    { get; set; }
    public string?                       RowVersion       { get; set; }
}
