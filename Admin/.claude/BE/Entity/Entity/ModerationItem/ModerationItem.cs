using StyleMint.Modules.Admin.Enums;
using StyleMint.Shared.Core;
using StyleMint.Shared.Core.Exceptions;
using StyleMint.Shared.Core.Validation;
using StyleMint.Shared.Infrastructure.Core.Entities;

namespace StyleMint.Modules.Admin.Entity;

/// <summary>
/// A piece of user-generated content awaiting moderator review
/// (skill §5). Created by the inbound consumers on
/// <c>reels.reel.reported.v1</c>, <c>reels.comment.reported.v1</c>,
/// <c>catalog.review.reported.v1</c>, <c>identity.profile.reported.v1</c>,
/// by the automated scanner pipeline (v2.0), or directly via the
/// admin operator console (AdminSpot).
///
/// State machine (skill §14):
///   Open     → InReview   (AssignAsync — first or reassignment)
///   InReview → InReview   (reassign)
///   InReview → Decided    (DecideAsync, terminal)
///
/// Decisions cause the service layer to call the owning module's
/// service (skill §5, §15 rule 5) — this aggregate stores the
/// <i>moderator decision</i>; the owning module remains the source of
/// truth for the <i>current content state</i>.
/// </summary>
public sealed class ModerationItem : EntityBase<Guid>
{
    private ModerationItem() { }

    private ModerationItem(
        Guid id, ModerationTargetKind targetKind, string targetId,
        ModerationSource source, Guid? reporterAccountId, string? reportReasonCode,
        DateTimeOffset submittedUtc, Guid createdById, DateTimeOffset nowUtc)
    {
        Id                = id;
        TargetKind        = targetKind;
        TargetId          = targetId;
        Source            = source;
        ReporterAccountId = reporterAccountId;
        ReportReasonCode  = reportReasonCode;
        State             = ModerationItemState.Open;
        SubmittedUtc      = submittedUtc;
        CreatedById       = createdById;
        CreatedUtc        = nowUtc;
        UpdatedUtc        = nowUtc;
    }

    public ModerationTargetKind TargetKind         { get; private set; }
    public string               TargetId           { get; private set; } = "";
    public ModerationSource     Source             { get; private set; }
    public Guid?                ReporterAccountId  { get; private set; }
    public string?              ReportReasonCode   { get; private set; }
    public ModerationItemState  State              { get; private set; }
    public Guid?                AssignedReviewerId { get; private set; }
    public DateTimeOffset       SubmittedUtc       { get; private set; }
    public DateTimeOffset?      DecidedUtc         { get; private set; }
    public ModerationAction?    Action             { get; private set; }
    public string?              DecisionNote       { get; private set; }

    public static ModerationItem CreateFromUserReport(
        ModerationTargetKind targetKind, string targetId,
        Guid reporterAccountId, string reportReasonCode,
        DateTimeOffset submittedUtc, Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(targetKind, nameof(targetKind));
        Guard.AgainstNullOrWhiteSpace(targetId, nameof(targetId), maxLength: 200);
        Guard.AgainstEmpty(reporterAccountId, nameof(reporterAccountId));
        Guard.AgainstNullOrWhiteSpace(reportReasonCode, nameof(reportReasonCode), maxLength: 64);
        Guard.AgainstEmpty(createdById, nameof(createdById));

        if (!ModerationReportReasonCode.AllCodes.Contains(reportReasonCode))
            throw new DomainException(
                $"Unknown moderation report reason code '{reportReasonCode}'.",
                ErrorCodes.InvalidEnum, nameof(reportReasonCode));

        var item = new ModerationItem(
            Guid.NewGuid(), targetKind, targetId.Trim(),
            ModerationSource.UserReport, reporterAccountId, reportReasonCode,
            submittedUtc, createdById, nowUtc);
        item.SetRowVersion(NewRowVersionStamp());
        return item;
    }

    public static ModerationItem CreateFromAdminSpot(
        ModerationTargetKind targetKind, string targetId,
        DateTimeOffset submittedUtc, Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(targetKind, nameof(targetKind));
        Guard.AgainstNullOrWhiteSpace(targetId, nameof(targetId), maxLength: 200);
        Guard.AgainstEmpty(createdById, nameof(createdById));

        var item = new ModerationItem(
            Guid.NewGuid(), targetKind, targetId.Trim(),
            ModerationSource.AdminSpot, reporterAccountId: null, reportReasonCode: null,
            submittedUtc, createdById, nowUtc);
        item.SetRowVersion(NewRowVersionStamp());
        return item;
    }

    public static ModerationItem CreateFromAutomatedScanner(
        ModerationTargetKind targetKind, string targetId, string reasonCode,
        DateTimeOffset submittedUtc, Guid createdById, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(targetKind, nameof(targetKind));
        Guard.AgainstNullOrWhiteSpace(targetId, nameof(targetId), maxLength: 200);
        Guard.AgainstNullOrWhiteSpace(reasonCode, nameof(reasonCode), maxLength: 64);
        Guard.AgainstEmpty(createdById, nameof(createdById));

        var item = new ModerationItem(
            Guid.NewGuid(), targetKind, targetId.Trim(),
            ModerationSource.AutomatedScanner, reporterAccountId: null, reportReasonCode: reasonCode,
            submittedUtc, createdById, nowUtc);
        item.SetRowVersion(NewRowVersionStamp());
        return item;
    }

    public void Assign(Guid reviewerId, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstEmpty(reviewerId, nameof(reviewerId));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State == ModerationItemState.Decided)
            throw new InvalidStateTransitionException(
                State.ToString(), nameof(ModerationItemState.InReview), nameof(ModerationItem));

        if (State == ModerationItemState.InReview && AssignedReviewerId == reviewerId) return;

        State              = ModerationItemState.InReview;
        AssignedReviewerId = reviewerId;
        UpdatedById        = actorId;
        UpdatedUtc         = nowUtc;
    }

    public void Decide(ModerationAction action, string? decisionNote, Guid actorId, DateTimeOffset nowUtc)
    {
        Guard.AgainstInvalidEnum(action, nameof(action));
        Guard.AgainstEmpty(actorId, nameof(actorId));
        if (State != ModerationItemState.InReview)
            throw new InvalidStateTransitionException(
                State.ToString(), nameof(ModerationItemState.Decided), nameof(ModerationItem));
        if (decisionNote is not null && decisionNote.Length > 1000)
            throw new DomainException(
                "Decision note exceeds 1000 chars.",
                ErrorCodes.OutOfRange, nameof(decisionNote));

        State        = ModerationItemState.Decided;
        Action       = action;
        DecisionNote = decisionNote;
        DecidedUtc   = nowUtc;
        UpdatedById  = actorId;
        UpdatedUtc   = nowUtc;
    }

    private static byte[] NewRowVersionStamp()
    {
        var stamp = new byte[8];
        Random.Shared.NextBytes(stamp);
        return stamp;
    }
}
