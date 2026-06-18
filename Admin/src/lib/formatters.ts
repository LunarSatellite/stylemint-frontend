import { format, formatDistanceToNow } from 'date-fns'
import {
  ApplicationState, AudienceSizeBand, BusinessType, SocialIdentityProvider,
  AdminRole, PayoutState, MusicTrackRefState,
  ModerationItemState, ModerationTargetKind, ModerationSource, ModerationAction,
  PostReportState, PostReportReason,
  PublishPlatform,
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

export const ApplicationStateLabel: Record<number, string> = {
  [ApplicationState.Draft]:       'Draft',
  [ApplicationState.Submitted]:   'Submitted',
  [ApplicationState.UnderReview]: 'Under Review',
  [ApplicationState.Approved]:    'Approved',
  [ApplicationState.Rejected]:    'Rejected',
}

export const AudienceSizeBandLabel: Record<number, string> = {
  [AudienceSizeBand.Under1k]:      '< 1k',
  [AudienceSizeBand.From1kTo10k]:  '1k – 10k',
  [AudienceSizeBand.From10kTo50k]: '10k – 50k',
  [AudienceSizeBand.From50kTo100k]: '50k – 100k',
  [AudienceSizeBand.Over100k]:     '100k+',
}

export const BusinessTypeLabel: Record<number, string> = {
  [BusinessType.SoleProprietor]: 'Sole Proprietor',
  [BusinessType.LLC]:            'LLC',
  [BusinessType.Corporation]:    'Corporation',
  [BusinessType.Partnership]:    'Partnership',
  [BusinessType.NonProfit]:      'Non-Profit',
  [BusinessType.Other]:          'Other',
}

export const SocialIdentityProviderLabel: Record<number, string> = {
  [SocialIdentityProvider.Instagram]: 'Instagram',
  [SocialIdentityProvider.TikTok]:    'TikTok',
  [SocialIdentityProvider.YouTube]:   'YouTube',
  [SocialIdentityProvider.Facebook]:  'Facebook',
}

// ── Audio labels ─────────────────────────────────────────────────────────────

export const MusicTrackRefStateLabel: Record<number, string> = {
  [MusicTrackRefState.Active]:      'Active',
  [MusicTrackRefState.Hidden]:      'Hidden',
  [MusicTrackRefState.LinksBroken]: 'Links Broken',
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

// ── Social Feed Reports ────────────────────────────────────────────────────────

export const PostReportStateLabel: Record<number, string> = {
  [PostReportState.Open]:         'Open',
  [PostReportState.InReview]:     'In Review',
  [PostReportState.Resolved]:     'Resolved',
  [PostReportState.Dismissed]:    'Dismissed',
  [PostReportState.AutoResolved]: 'Auto Resolved',
}

export const PostReportReasonLabel: Record<number, string> = {
  [PostReportReason.Spam]:                   'Spam',
  [PostReportReason.Nudity]:                 'Nudity',
  [PostReportReason.HateOrHarassment]:       'Hate / Harassment',
  [PostReportReason.Violence]:               'Violence',
  [PostReportReason.Misleading]:             'Misleading',
  [PostReportReason.Bullying]:               'Bullying',
  [PostReportReason.SuicideOrSelfHarm]:      'Suicide / Self-Harm',
  [PostReportReason.DangerousOrganizations]: 'Dangerous Organizations',
  [PostReportReason.PrivacyViolation]:       'Privacy Violation',
  [PostReportReason.Scam]:                   'Scam',
  [PostReportReason.Other]:                  'Other',
}

// ── Reach / Publish ────────────────────────────────────────────────────────────

export const PublishPlatformLabel: Record<number, string> = {
  [PublishPlatform.StyleMint]: 'StyleMint',
  [PublishPlatform.Instagram]: 'Instagram',
  [PublishPlatform.TikTok]:    'TikTok',
  [PublishPlatform.YouTube]:   'YouTube',
  [PublishPlatform.Facebook]:  'Facebook',
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
