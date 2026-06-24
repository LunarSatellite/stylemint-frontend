export const AdminRole = {
  SuperAdmin:   1,
  KycReviewer:  2,
  ContentMod:   3,
  SupportAgent: 4,
  PayoutsOps:   5,
  Readonly:     6,
} as const

// ApplicationState — lifecycle of a Creator or Vendor KYC application
export const ApplicationState = {
  Draft:       1,
  Submitted:   2,
  UnderReview: 3,
  Approved:    4,
  Rejected:    5,
} as const

// AudienceSizeBand — self-reported follower count band on a CreatorApplication
export const AudienceSizeBand = {
  Under1k:    1,
  From1kTo10k:  2,
  From10kTo50k: 3,
  From50kTo100k: 4,
  Over100k:   5,
} as const

// BusinessType — legal form of the vendor entity
export const BusinessType = {
  SoleProprietor:  1,
  LLC:             2,
  Corporation:     3,
  Partnership:     4,
  NonProfit:       5,
  Other:           6,
} as const

// SocialIdentityProvider — platforms a creator can declare
export const SocialIdentityProvider = {
  Instagram: 1,
  TikTok:    2,
  YouTube:   3,
  Facebook:  4,
} as const

export const AdminAccountState = {
  Active:   1,
  Disabled: 2,
} as const

export const PayoutState = {
  Pending:  1,
  OnHold:   2,
  Paid:     3,
  Failed:   4,
} as const

// ── Moderation ────────────────────────────────────────────────────────────────

export const ModerationItemState = {
  Open:     1,
  InReview: 2,
  Decided:  3,
} as const

export const ModerationTargetKind = {
  Reel:        1,
  Review:      2,
  ReelComment: 3,
  Profile:     4,
} as const

export const ModerationSource = {
  UserReport:       1,
  AutomatedScanner: 2,
  AdminSpot:        3,
} as const

export const ModerationAction = {
  NoAction:      1,
  HideContent:   2,
  RemoveContent: 3,
  WarnAuthor:    4,
  SuspendAuthor: 5,
  BanAuthor:     6,
} as const

export const ModerationReportReasonCodes = [
  'SPAM',
  'NUDITY_OR_SEXUAL',
  'HATE_OR_HARASSMENT',
  'VIOLENCE',
  'MISLEADING',
  'COUNTERFEIT_PRODUCT',
  'OTHER',
] as const

// ── Admin KYC Review ──────────────────────────────────────────────────────────

export const KycReviewState = {
  Pending:  1,
  InReview: 2,
  Decided:  3,
} as const

export const KycApplicantKind = {
  Creator: 1,
  Vendor:  2,
} as const

export const KycDecision = {
  Approved:          1,
  RejectedRetryable: 2,
  RejectedTerminal:  3,
} as const

// MusicTrackRefState — lifecycle of a catalog track
export const MusicTrackRefState = {
  Active:      1,
  Hidden:      2,
  LinksBroken: 3,
} as const

export const AdminSessionRevocationReason = {
  UserLogout:       1,
  UserLogoutAll:    2,
  AdminForceRevoke: 3,
  AccountDisabled:  4,
  RoleChanged:      5,
  Expired:          6,
  Security:         7,
} as const

export const MfaCredentialKind = {
  Totp:     1,
  WebAuthn: 2,
} as const

export const FeatureFlagAudience = {
  Role:    1,
  Account: 2,
} as const

export const FeatureFlagRoleKind = {
  Customer: 1,
  Creator:  2,
  Vendor:   3,
} as const

// ── Social Feed Reports ───────────────────────────────────────────────────────

export const PostReportState = {
  Open:         1,
  InReview:     2,
  Resolved:     3,
  Dismissed:    4,
  AutoResolved: 5,
} as const

// Cross-platform abuse taxonomy (99 = catch-all Other)
export const PostReportReason = {
  Spam:                   1,
  Nudity:                 2,
  HateOrHarassment:       3,
  Violence:               4,
  Misleading:             5,
  Bullying:               6,
  SuicideOrSelfHarm:      7,
  DangerousOrganizations: 8,
  PrivacyViolation:       9,
  Scam:                   10,
  Other:                  99,
} as const

// ── Reach / Publish ───────────────────────────────────────────────────────────

// StyleMint=0 is a no-op target (reel already lives in StyleMint)
export const PublishPlatform = {
  StyleMint: 0,
  Instagram: 1,
  TikTok:    2,
  YouTube:   3,
  Facebook:  4,
} as const
