using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class ModerationItemDto
{
    public Guid                 Id                 { get; set; }
    public ModerationTargetKind TargetKind         { get; set; }
    public string               TargetId           { get; set; } = "";
    public ModerationSource     Source             { get; set; }
    public Guid?                ReporterAccountId  { get; set; }
    public string?              ReportReasonCode   { get; set; }
    public ModerationItemState  State              { get; set; }
    public Guid?                AssignedReviewerId { get; set; }
    public DateTimeOffset       SubmittedUtc       { get; set; }
    public DateTimeOffset?      DecidedUtc         { get; set; }
    public ModerationAction?    Action             { get; set; }
    public string?              DecisionNote       { get; set; }
    public string?              RowVersion         { get; set; }
}
