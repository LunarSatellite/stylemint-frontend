import { format, formatDistanceToNow } from 'date-fns'
import {
  KycReviewState, KycDecision, KycApplicantKind, AdminRole, PayoutState,
  ModerationItemState, ModerationTargetKind, ModerationSource, ModerationAction,
} from './enums'

export function formatDate(iso: string): string {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm')
}

export function formatDateShort(iso: string): string {
  return format(new Date(iso), 'dd MMM yyyy')
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
}

export function isOverdue(dueByUtc: string): boolean {
  return new Date() > new Date(dueByUtc)
}

// ── KYC labels ──────────────────────────────────────────────────────────────

export const KycReviewStateLabel: Record<number, string> = {
  [KycReviewState.Pending]:  'Pending',
  [KycReviewState.InReview]: 'In Review',
  [KycReviewState.Decided]:  'Decided',
}

export const KycDecisionLabel: Record<number, string> = {
  [KycDecision.Approved]:          'Approved',
  [KycDecision.RejectedRetryable]: 'Rejected (Retryable)',
  [KycDecision.RejectedTerminal]:  'Rejected (Terminal)',
}

export const KycApplicantKindLabel: Record<number, string> = {
  [KycApplicantKind.Creator]: 'Creator',
  [KycApplicantKind.Vendor]:  'Vendor',
}

export const KycReasonCodeLabel: Record<string, string> = {
  DOCS_UNCLEAR:                  'Documents Unclear',
  DOCS_MISMATCH:                 'Documents Mismatch',
  CATEGORY_MISSING:              'Category Missing',
  POLICY_VIOLATION_RECOVERABLE:  'Policy Violation (Recoverable)',
  FRAUD_SUSPECTED:               'Fraud Suspected',
  SANCTIONS_HIT:                 'Sanctions Hit',
  UNDERAGE:                      'Underage',
}

// ── Other labels ────────────────────────────────────────────────────────────

export const AdminRoleLabel: Record<number, string> = {
  [AdminRole.SuperAdmin]:   'Super Admin',
  [AdminRole.KycReviewer]:  'KYC Reviewer',
  [AdminRole.ContentMod]:   'Content Moderator',
  [AdminRole.SupportAgent]: 'Support Agent',
  [AdminRole.PayoutsOps]:   'Payouts Ops',
  [AdminRole.Readonly]:     'Read Only',
}

export const PayoutStateLabel: Record<number, string> = {
  [PayoutState.Pending]: 'Pending',
  [PayoutState.OnHold]:  'On Hold',
  [PayoutState.Paid]:    'Paid',
  [PayoutState.Failed]:  'Failed',
}

// ── Moderation labels ─────────────────────────────────────────────────────────

export const ModerationItemStateLabel: Record<number, string> = {
  [ModerationItemState.Open]:     'Open',
  [ModerationItemState.InReview]: 'In Review',
  [ModerationItemState.Decided]:  'Decided',
}

export const ModerationTargetKindLabel: Record<number, string> = {
  [ModerationTargetKind.Reel]:        'Reel',
  [ModerationTargetKind.Review]:      'Review',
  [ModerationTargetKind.ReelComment]: 'Comment',
  [ModerationTargetKind.Profile]:     'Profile',
}

export const ModerationSourceLabel: Record<number, string> = {
  [ModerationSource.UserReport]:       'User Report',
  [ModerationSource.AutomatedScanner]: 'Auto Scanner',
  [ModerationSource.AdminSpot]:        'Admin',
}

export const ModerationActionLabel: Record<number, string> = {
  [ModerationAction.NoAction]:      'No Action',
  [ModerationAction.HideContent]:   'Hide Content',
  [ModerationAction.RemoveContent]: 'Remove Content',
  [ModerationAction.WarnAuthor]:    'Warn Author',
  [ModerationAction.SuspendAuthor]: 'Suspend Author (7d)',
  [ModerationAction.BanAuthor]:     'Ban Author',
}

export const ModerationReportReasonCodeLabel: Record<string, string> = {
  SPAM:                'Spam',
  NUDITY_OR_SEXUAL:    'Nudity / Sexual',
  HATE_OR_HARASSMENT:  'Hate / Harassment',
  VIOLENCE:            'Violence',
  MISLEADING:          'Misleading',
  COUNTERFEIT_PRODUCT: 'Counterfeit Product',
  OTHER:               'Other',
}
