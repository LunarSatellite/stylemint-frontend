using StyleMint.Modules.Admin.Enums;

namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class KycReviewItemDto
{
    public Guid             Id                 { get; set; }
    public KycApplicantKind ApplicantKind      { get; set; }
    public Guid             ApplicationId      { get; set; }
    public Guid             AccountId          { get; set; }
    public KycReviewState   State              { get; set; }
    public Guid?            AssignedReviewerId { get; set; }
    public DateTimeOffset   SubmittedUtc       { get; set; }
    public DateTimeOffset   DueByUtc           { get; set; }
    public DateTimeOffset?  DecidedUtc         { get; set; }
    public KycDecision?     Decision           { get; set; }
    public string?          DecisionReasonCode { get; set; }
    public string?          DecisionNote       { get; set; }
    public string?          RowVersion         { get; set; }
}
