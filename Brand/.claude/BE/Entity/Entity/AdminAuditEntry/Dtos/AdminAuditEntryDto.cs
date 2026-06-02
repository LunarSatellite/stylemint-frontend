namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class AdminAuditEntryDto
{
    public Guid           Id              { get; set; }
    public Guid           AdminAccountId  { get; set; }
    public string         Action          { get; set; } = "";
    public string         TargetKind      { get; set; } = "";
    public string         TargetId        { get; set; } = "";
    public string?        Reason          { get; set; }
    public string         PayloadJson     { get; set; } = "{}";
    public string         SourceIp        { get; set; } = "";
    public string         UserAgent       { get; set; } = "";
    public DateTimeOffset OccurredUtc     { get; set; }
}
