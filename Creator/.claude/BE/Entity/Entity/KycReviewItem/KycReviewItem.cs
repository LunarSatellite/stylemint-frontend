using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// A pending or completed KYC review (skill §4). Created by the
/// inbound consumer on <c>onboarding.creator.application.submitted.v1</c>
/// or <c>onboarding.vendor.application.submitted.v1</c>. The unique
/// constraint on <c>application_id</c> means at most one review item
/// per application — re-submissions create a fresh row only after
/// the previous one is Decided.
///
/// State machine (skill §14):
///   Pending  → InReview   (AssignAsync — first or reassignment)
///   InReview → InReview   (reassign to a different reviewer)
///   InReview → Decided    (DecideAsync, terminal)
///
/// SLA: <c>DueByUtc = SubmittedUtc + 3 business days NPT</c>; holidays
/// from <c>platform_config.kyc.holidayCalendar</c>. DueByUtc is set by
/// the service (it knows the holiday list), not the entity.
/// </summary>
public sealed class KycReviewItem : EntityBase<Guid>
{
    private KycReviewItem() { }

    private KycReviewItem(
        Guid id, KycApplicantKind applicantKind,
        Guid applicationId, Guid accountId,
        DateTimeOffset submittedUtc, DateTimeOffset dueByUtc,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Id            = id;
        ApplicantKind = applicantKind;
        ApplicationId = applicationId;
        AccountId     = accountId;
        SubmittedUtc  = submittedUtc;
        DueByUtc      = dueByUtc;
        State         = KycReviewState.Pending;
        CreatedById   = createdById;
        CreatedUtc    = nowUtc;
        UpdatedUtc    = nowUtc;
    }

    public KycApplicantKind ApplicantKind      { get; private set; }
    public Guid             ApplicationId      { get; private set; }
    public Guid             AccountId          { get; private set; }
    public KycReviewState   State              { get; private set; }
    public Guid?            AssignedReviewerId { get; private set; }
    public DateTimeOffset   SubmittedUtc       { get; private set; }
    public DateTimeOffset   DueByUtc           { get; private set; }
    public DateTimeOffset?  DecidedUtc         { get; private set; }
    public KycDecision?     Decision           { get; private set; }
    public string?          DecisionReasonCode { get; private set; }
    public string?          DecisionNote       { get; private set; }

    public bool IsOverdue(DateTimeOffset nowUtc) =>
        State != KycReviewState.Decided && nowUtc > DueByUtc;

    public static KycReviewItem CreateFromApplication(
        KycApplicantKind applicantKind, Guid applicationId, Guid accountId,
        DateTimeOffset submittedUtc, DateTimeOffset dueByUtc,
        Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(applicantKind, nameof(applicantKind));
        Guard.AgainstEmpty(applicationId, nameof(applicationId));
        Guard.AgainstEmpty(accountId, nameof(accountId));
        Guard.AgainstEmpty(createdById, nameof(createdById));
        if (dueByUtc <= submittedUtc)
            throw new DomainException(
                "DueByUtc must be strictly after SubmittedUtc.",
                ErrorCodes.OutOfRange, nameof(dueByUtc));

        var item = new KycReviewItem(
            Guid.NewGuid(), applicantKind, applicationId, accountId,
            submittedUtc, dueByUtc, createdById, nowUtc);
        item.SetRowVersion(NewRowVersionStamp());
        return item;
    }

    /// <summary>
    /// Assign or reassign the reviewer. Pending → InReview on first
    /// assignment; InReview → InReview on reassignment (still records
    /// an audit row at the service layer). Reassigning to the same
    /// reviewer is idempotent.
    /// </summary>
    public void Assign(Guid reviewerId, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(reviewerId, nameof(reviewerId));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State == KycReviewState.Decided)
            throw new InvalidStateTransitionException(
                State.ToString(), nameof(KycReviewState.InReview), nameof(KycReviewItem));

        if (State == KycReviewState.InReview && AssignedReviewerId == reviewerId) return;

        State              = KycReviewState.InReview;
        AssignedReviewerId = reviewerId;
        UpdatedById        = actorId;
        UpdatedUtc         = nowUtc;
    }

    /// <summary>
    /// Terminal decision. Service is responsible for validating the
    /// (decision, reasonCode) pair (retryable codes pair with
    /// RejectedRetryable, terminal codes with RejectedTerminal — see
    /// <see cref="KycDecisionReasonCode"/>).
    /// </summary>
    public void Decide(
        KycDecision decision, string? decisionReasonCode, string? decisionNote,
        Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(decision, nameof(decision));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State != KycReviewState.InReview)
            throw new InvalidStateTransitionException(
                State.ToString(), nameof(KycReviewState.Decided), nameof(KycReviewItem));

        if (decision is KycDecision.RejectedRetryable or KycDecision.RejectedTerminal)
        {
            Guard.AgainstNullOrWhiteSpace(decisionReasonCode, nameof(decisionReasonCode), maxLength: 64);
            if (!KycDecisionReasonCode.AllCodes.Contains(decisionReasonCode!))
                throw new DomainException(
                    $"Unknown KYC decision reason code '{decisionReasonCode}'.",
                    ErrorCodes.InvalidEnum, nameof(decisionReasonCode));
            if (decision == KycDecision.RejectedRetryable && !KycDecisionReasonCode.RetryableCodes.Contains(decisionReasonCode!))
                throw new DomainException(
                    $"Reason code '{decisionReasonCode}' is not valid for a retryable rejection.",
                    ErrorCodes.BusinessRule, nameof(decisionReasonCode));
            if (decision == KycDecision.RejectedTerminal && !KycDecisionReasonCode.TerminalCodes.Contains(decisionReasonCode!))
                throw new DomainException(
                    $"Reason code '{decisionReasonCode}' is not valid for a terminal rejection.",
                    ErrorCodes.BusinessRule, nameof(decisionReasonCode));
        }

        if (decisionNote is not null && decisionNote.Length > 1000)
            throw new DomainException(
                "Decision note exceeds 1000 chars.",
                ErrorCodes.OutOfRange, nameof(decisionNote));

        State              = KycReviewState.Decided;
        Decision           = decision;
        DecisionReasonCode = decisionReasonCode;
        DecisionNote       = decisionNote;
        DecidedUtc         = nowUtc;
        UpdatedById        = actorId;
        UpdatedUtc         = nowUtc;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
