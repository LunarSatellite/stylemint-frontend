import {
  AdminRole,
  KycApplicantKind,
  KycDecision,
  KycState,
  ModerationAction,
  ModerationItemState,
  ModerationSource,
  ModerationTargetKind,
} from './enums';

export const KycStateLabel: Record<number, string> = {
  [KycState.Pending]: 'Pending',
  [KycState.Approved]: 'Approved',
  [KycState.Rejected]: 'Rejected',
};

export const KycApplicantKindLabel: Record<number, string> = {
  [KycApplicantKind.Creator]: 'Creator',
  [KycApplicantKind.Vendor]: 'Vendor',
};

export const AdminRoleLabel: Record<number, string> = {
  [AdminRole.SuperAdmin]: 'Super Admin',
  [AdminRole.KycReviewer]: 'KYC Reviewer',
  [AdminRole.ContentMod]: 'Content Moderator',
  [AdminRole.SupportAgent]: 'Support Agent',
  [AdminRole.PayoutsOps]: 'Payouts Ops',
  [AdminRole.Readonly]: 'Read Only',
};

/**
 * An unknown enum value is shown as itself rather than as blank.
 *
 * The API can add a state before this console learns about it, and a
 * row that renders an empty cell looks like missing data. "Unknown (4)"
 * looks like what it is and tells whoever reports it what to add here.
 */
export function labelOf(map: Record<number, string>, value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return map[value] ?? `Unknown (${value})`;
}

export const ModerationStateLabel: Record<number, string> = {
  [ModerationItemState.Open]: 'Open',
  [ModerationItemState.InReview]: 'In review',
  [ModerationItemState.Decided]: 'Decided',
};

export const ModerationTargetLabel: Record<number, string> = {
  [ModerationTargetKind.Reel]: 'Reel',
  [ModerationTargetKind.Review]: 'Review',
  [ModerationTargetKind.ReelComment]: 'Reel comment',
  [ModerationTargetKind.Profile]: 'Profile',
  [ModerationTargetKind.RecommendationReply]: 'Recommendation reply',
};

export const ModerationSourceLabel: Record<number, string> = {
  [ModerationSource.UserReport]: 'User report',
  [ModerationSource.AutomatedScanner]: 'Automated scanner',
  [ModerationSource.AdminSpot]: 'Spotted by an admin',
};

export const ModerationActionLabel: Record<number, string> = {
  [ModerationAction.NoAction]: 'No action',
  [ModerationAction.HideContent]: 'Content hidden',
  [ModerationAction.RemoveContent]: 'Content removed',
  [ModerationAction.WarnAuthor]: 'Author warned',
  [ModerationAction.SuspendAuthor]: 'Author suspended',
  [ModerationAction.BanAuthor]: 'Author banned',
};

export const KycDecisionLabel: Record<number, string> = {
  [KycDecision.Approved]: 'Approved',
  [KycDecision.RejectedRetryable]: 'Rejected — may reapply',
  [KycDecision.RejectedTerminal]: 'Rejected — final',
};
