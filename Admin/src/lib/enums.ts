export const AdminRole = {
  SuperAdmin:   1,
  KycReviewer:  2,
  ContentMod:   3,
  SupportAgent: 4,
  PayoutsOps:   5,
  Readonly:     6,
} as const

// KycReviewState — lifecycle of a review item
export const KycReviewState = {
  Pending:  1,
  InReview: 2,
  Decided:  3,
} as const

// KycDecision — terminal outcome (only set when state=Decided)
export const KycDecision = {
  Approved:          1,
  RejectedRetryable: 2,
  RejectedTerminal:  3,
} as const

// KycApplicantKind — who submitted the application
export const KycApplicantKind = {
  Creator: 1,
  Vendor:  2,
} as const

// Retryable reason codes — pair with KycDecision.RejectedRetryable
export const KycRetryableReasonCodes = [
  'DOCS_UNCLEAR',
  'DOCS_MISMATCH',
  'CATEGORY_MISSING',
  'POLICY_VIOLATION_RECOVERABLE',
] as const

// Terminal reason codes — pair with KycDecision.RejectedTerminal
export const KycTerminalReasonCodes = [
  'FRAUD_SUSPECTED',
  'SANCTIONS_HIT',
  'UNDERAGE',
] as const

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
