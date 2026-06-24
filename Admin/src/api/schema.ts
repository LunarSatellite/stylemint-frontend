/**
 * Generated from OpenAPI spec — do not edit manually.
 * Regenerate with: npm run codegen
 */

// ── Shared ────────────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items:      T[]
  nextCursor: string | null
  totalCount: number
}

export interface PagedList<T> {
  items:       T[]
  totalCount:  number
  totalPages:  number
  hasNext:     boolean
  hasPrevious: boolean
}

export interface Money {
  amount:   number
  currency: string
}

export interface ErrorResponseVm {
  errorCode:     string
  correlationId: string
  message:       string
}

// ── Admin — Enums ─────────────────────────────────────────────────────────────

/** 1=Active 2=Disabled */
export type AdminAccountState = 1 | 2

/** 1=SuperAdmin 2=KycReviewer 3=ContentMod 4=SupportAgent 5=PayoutsOps 6=Readonly */
export type AdminRole = 1 | 2 | 3 | 4 | 5 | 6

/** 1=UserLogout 2=UserLogoutAll 3=AdminForceRevoke 4=AccountDisabled 5=RoleChanged 6=Expired 7=Security */
export type AdminSessionRevocationReason = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 1=Role 2=Account */
export type FeatureFlagAudience = 1 | 2

/** 1=Customer 2=Creator 3=Vendor */
export type FeatureFlagRoleKind = 1 | 2 | 3

/** 1=Creator 2=Vendor */
export type KycApplicantKind = 1 | 2

/** 1=Approved 2=RejectedRetryable 3=RejectedTerminal */
export type KycDecision = 1 | 2 | 3

/** 1=Pending 2=InReview 3=Decided */
export type KycReviewState = 1 | 2 | 3

/** 1=Totp 2=WebAuthn */
export type MfaCredentialKind = 1 | 2

/** 1=NoAction 2=HideContent 3=RemoveContent 4=WarnAuthor 5=SuspendAuthor 6=BanAuthor */
export type ModerationAction = 1 | 2 | 3 | 4 | 5 | 6

/** 1=Open 2=InReview 3=Decided */
export type ModerationItemState = 1 | 2 | 3

/** 1=UserReport 2=AutomatedScanner 3=AdminSpot */
export type ModerationSource = 1 | 2 | 3

/** 1=Reel 2=Review 3=ReelComment 4=Profile */
export type ModerationTargetKind = 1 | 2 | 3 | 4

// ── Admin — Auth ──────────────────────────────────────────────────────────────

export interface SsoLoginVm {
  idToken: string | null
}

/** Returned by POST /v1/admin/auth/sso — the login session payload */
export interface AuthAdminSessionDto {
  accessToken:    string | null
  expiresAtUtc:   string
  adminAccountId: string
  email:          string | null
  displayName:    string | null
  roles:          AdminRole[] | null
}

// ── Admin — Accounts ──────────────────────────────────────────────────────────

export interface AdminRoleAssignmentDto {
  id:                string
  adminAccountId:    string
  role:              AdminRole
  assignedUtc:       string
  assignedByAdminId: string
}

export interface AdminAccountDto {
  id:           string
  ssoSubject:   string | null
  email:        string | null
  displayName:  string | null
  state:        AdminAccountState
  lastLoginUtc: string
  createdUtc:   string
  updatedUtc:   string
  rowVersion:   string | null
  roles:        AdminRoleAssignmentDto[] | null
}

// ── Admin — Sessions ──────────────────────────────────────────────────────────

export interface AdminSessionDto {
  id:               string
  adminAccountId:   string
  jti:              string
  issuedUtc:        string
  expiresUtc:       string
  lastSeenUtc:      string
  sourceIp:         string | null
  userAgent:        string | null
  mfaAssertedUtc:   string | null
  mfaAcr:           string | null
  revokedUtc:       string | null
  revokedReason:    AdminSessionRevocationReason
  revokedByAdminId: string | null
  lastStepUpUtc:    string | null
  rowVersion:       string | null
}

// ── Admin — MFA ───────────────────────────────────────────────────────────────

export interface AdminMfaCredentialDto {
  id:              string
  adminAccountId:  string
  kind:            MfaCredentialKind
  label:           string | null
  confirmedUtc:    string | null
  lastVerifiedUtc: string | null
  failedAttempts:  number
  lockedUntilUtc:  string | null
  createdUtc:      string
  rowVersion:      string | null
}

export interface AdminMfaEnrollmentDto {
  credentialId:    string
  secretBase32:    string | null
  provisioningUri: string | null
  digits:          number
  periodSeconds:   number
}

export interface AdminMfaStatusDto {
  hasTotp:                boolean
  totpConfirmed:          boolean
  totpLastVerifiedUtc:    string | null
  totpLocked:             boolean
  sessionLastStepUpUtc:   string | null
  sessionStepUpFresh:     boolean
  stepUpMaxAgeMinutes:    number
}

export interface EnrollMfaVm {
  label: string | null
}

export interface VerifyMfaVm {
  code: string | null
}

// ── Admin — Audit ─────────────────────────────────────────────────────────────

export interface AdminAuditEntryDto {
  id:              string
  adminAccountId:  string
  action:          string | null
  targetKind:      string | null
  targetId:        string | null
  reason:          string | null
  payloadJson:     string | null
  sourceIp:        string | null
  userAgent:       string | null
  occurredUtc:     string
}

// ── Admin — KYC ───────────────────────────────────────────────────────────────

export interface AssignKycVm {
  reviewerAdminId: string
}

export interface DecideKycVm {
  decision:           KycDecision
  decisionReasonCode: string | null
  decisionNote:       string | null
}

export interface KycReviewItemDto {
  id:                 string
  applicantKind:      KycApplicantKind
  applicationId:      string
  accountId:          string
  state:              KycReviewState
  assignedReviewerId: string | null
  submittedUtc:       string
  dueByUtc:           string
  decidedUtc:         string | null
  decision:           KycDecision | null
  decisionReasonCode: string | null
  decisionNote:       string | null
  rowVersion:         string | null
}

// ── Admin — Moderation ────────────────────────────────────────────────────────

export interface AssignModerationVm {
  reviewerAdminId: string
}

export interface DecideModerationVm {
  action:       ModerationAction
  decisionNote: string | null
}

export interface ModerationItemDto {
  id:                 string
  targetKind:         ModerationTargetKind
  targetId:           string | null
  source:             ModerationSource
  reporterAccountId:  string | null
  reportReasonCode:   string | null
  state:              ModerationItemState
  assignedReviewerId: string | null
  submittedUtc:       string
  decidedUtc:         string | null
  action:             ModerationAction
  decisionNote:       string | null
  rowVersion:         string | null
}

// ── Admin — Feature Flags ─────────────────────────────────────────────────────

export interface FeatureFlagOverrideDto {
  id:            string
  featureFlagId: string
  audience:      FeatureFlagAudience
  roleKind:      FeatureFlagRoleKind
  accountId:     string | null
  enabled:       boolean
}

export interface FeatureFlagDto {
  id:             string
  key:            string | null
  defaultEnabled: boolean
  description:    string | null
  createdUtc:     string
  updatedUtc:     string
  rowVersion:     string | null
  overrides:      FeatureFlagOverrideDto[] | null
}

export interface SetOverrideVm {
  roleKind:  string | null
  accountId: string | null
  enabled:   boolean
}

export interface UpsertFeatureFlagVm {
  defaultEnabled: boolean
  description:    string | null
}

// ── Admin — Platform Config ───────────────────────────────────────────────────

export interface PlatformConfigEntryDto {
  id:          string
  key:         string | null
  valueJson:   string | null
  description: string | null
  createdUtc:  string
  updatedUtc:  string
  rowVersion:  string | null
}

export interface SetPlatformConfigVm {
  valueJson:   string | null
  description: string | null
}

// ── Admin — Payout Override ───────────────────────────────────────────────────

export interface PayoutForceMarkVm {
  reason: string | null
}

export interface PayoutHoldVm {
  reason: string | null
}

// ── Admin — Privacy ───────────────────────────────────────────────────────────

export interface PrivacyMetricPoint {
  date:                       string
  dataExportRequests:         number
  optOutsFromRecommendations: number
  activePauses:               number
  consentWithdrawals:         number
}

export interface PrivacyDashboardDto {
  dataExportRequests:         number
  optOutsFromRecommendations: number
  activePauses:               number
  consentWithdrawals:         number
  weeklyTrend:                PrivacyMetricPoint[] | null
}

// ── Audio ─────────────────────────────────────────────────────────────────────

/** 1=Active 2=Hidden 3=LinksBroken */
export type MusicTrackRefState = 1 | 2 | 3

/** 1=Spotify 2=AppleMusic 3=YouTube 4=SoundCloud 99=Other */
export type ExternalAudioProvider = 1 | 2 | 3 | 4 | 99

export interface MusicTrackRefLinkDto {
  id:                 string
  musicTrackRefId:    string
  provider:           ExternalAudioProvider
  url:                string | null
  providerTrackId:    string | null
  lastHealthCheckUtc: string | null
  lastHealthCheckOk:  boolean
  createdUtc:         string
  updatedUtc:         string
}

export interface MusicTrackRefDto {
  id:                        string
  title:                     string | null
  artist:                    string | null
  durationSecondsApprox:     number
  tempoBpm:                  number | null
  genre:                     string | null
  mood:                      string | null
  language:                  string | null
  isInstrumental:            boolean
  citedInReelCount:          number
  avgCitedReelCompletionRate: number
  state:                     MusicTrackRefState
  hiddenReason:              string | null
  createdUtc:                string
  updatedUtc:                string
  rowVersion:                string | null
  links:                     MusicTrackRefLinkDto[] | null
}

export interface HideTrackVm {
  reason: string
}

// ── Onboarding — KYC ─────────────────────────────────────────────────────────

/** 1=Draft 2=Submitted 3=UnderReview 4=Approved 5=Rejected */
export type ApplicationState = 1 | 2 | 3 | 4 | 5

/** 1=Under1k 2=From1kTo10k 3=From10kTo50k 4=From50kTo100k 5=Over100k */
export type AudienceSizeBand = 1 | 2 | 3 | 4 | 5

/** 1=Instagram 2=TikTok 3=YouTube 4=Facebook */
export type SocialIdentityProvider = 1 | 2 | 3 | 4

/** 1=SoleProprietor 2=LLC 3=Corporation 4=Partnership 5=NonProfit 6=Other */
export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6

/** 1–5: catalog size estimate bands */
export type CatalogSizeEstimate = 1 | 2 | 3 | 4 | 5

/** 1=Checking 2=Savings */
export type BankAccountType = 1 | 2

/** 1=BusinessRegistration 2=TaxCertificate 3=IdentityDocument 4=AddressProof 99=Other */
export type VendorApplicationDocumentKind = 1 | 2 | 3 | 4 | 99

export interface CreatorApplicationCategoryDto {
  id:                       string
  creatorApplicationId:     string
  creatorContentCategoryId: string
}

export interface CreatorApplicationSocialDto {
  id:                       string
  creatorApplicationId:     string
  provider:                 SocialIdentityProvider
  handle:                   string | null
  followerCountSelfReported: number | null
}

export interface CreatorApplicationDto {
  id:                     string
  accountId:              string
  state:                  ApplicationState
  bio:                    string | null
  audienceBand:           AudienceSizeBand
  otherCategoryDescription: string | null
  submittedAtUtc:         string | null
  expectedDecisionByUtc:  string | null
  decisionAtUtc:          string | null
  reviewerAccountId:      string | null
  rejectionReason:        string | null
  createdUtc:             string
  updatedUtc:             string
  rowVersion:             string | null
  categories:             CreatorApplicationCategoryDto[] | null
  socials:                CreatorApplicationSocialDto[] | null
}

export interface VendorApplicationDocumentDto {
  id:                  string
  vendorApplicationId: string
  kind:                VendorApplicationDocumentKind
  storageUri:          string | null
}

export interface VendorApplicationBankAccountDto {
  id:                        string
  vendorApplicationId:       string
  accountHolderName:         string | null
  bankName:                  string | null
  accountType:               BankAccountType
  lastFourAccountDigits:     string | null
  hasW9OnFile:               boolean
  taxAttestationAccepted:    boolean
  taxAttestationAcceptedUtc: string | null
}

export interface VendorApplicationDto {
  id:                   string
  accountId:            string
  state:                ApplicationState
  brandName:            string | null
  website:              string | null
  legalBusinessName:    string | null
  countryCode:          string | null
  businessType:         BusinessType
  taxId:                string | null
  commissionMinPercent: number
  commissionMaxPercent: number
  submittedAtUtc:       string | null
  expectedDecisionByUtc: string | null
  decisionAtUtc:        string | null
  reviewerAccountId:    string | null
  rejectionReason:      string | null
  createdUtc:           string
  updatedUtc:           string
  rowVersion:           string | null
  addressLine1:         string | null
  addressLine2:         string | null
  city:                 string | null
  stateProvince:        string | null
  postalCode:           string | null
  catalogSize:          CatalogSizeEstimate
  priceRangeMinAmount:  number | null
  priceRangeMaxAmount:  number | null
  priceRangeCurrency:   string | null
  brandStory:           string | null
  documents:            VendorApplicationDocumentDto[] | null
  bankAccount:          VendorApplicationBankAccountDto | null
}

export interface RejectKycVm {
  reason: string | null
}

// ── Payouts ───────────────────────────────────────────────────────────────────

/** 1=Creator 2=Vendor */
export type PayeeKind = 1 | 2

/** 1=AutomaticWeekly 2=OnDemand */
export type PayoutMode = 1 | 2

/** 1=Nimb 2=Laxmi 3=PayPal 4=eSewa */
export type PayoutDestinationKind = 1 | 2 | 3 | 4

/** 1=Pending 2=OnHold 3=Paid 4=Failed 5=Processing */
export type PayoutState = 1 | 2 | 3 | 4 | 5

export interface PayoutDto {
  id:                      string
  payeeProfileId:          string
  payeeKind:               PayeeKind
  mode:                    PayoutMode
  destination:             PayoutDestinationKind
  destinationRef:          string | null
  requestedAmountValue:    number
  requestedAmountCurrency: string | null
  feeAmountValue:          number
  feeAmountCurrency:       string | null
  netAmountValue:          number
  netAmountCurrency:       string | null
  requestedUtc:            string
  pendingUntilUtc:         string
  state:                   PayoutState
  providerPayoutId:        string | null
  failureCode:             string | null
  failureMessage:          string | null
  paidUtc:                 string | null
}

// ── Reach ─────────────────────────────────────────────────────────────────────

/** 0=StyleMint 1=Instagram 2=TikTok 3=YouTube 4=Facebook */
export type PublishPlatform = 0 | 1 | 2 | 3 | 4

export interface PolicyChangeAlertDto {
  platform:       PublishPlatform
  changeSummary:  string | null
  advisoryAction: string | null
  detectedUtc:    string
}

// ── Social Feed ───────────────────────────────────────────────────────────────

/** 1–9: Text Poll Link Image Video Event Question Reel Share */
export type PostType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** 1=Public 2=Followers 3=GroupMembers 4=CircleMembers 5=Private */
export type PostVisibility = 1 | 2 | 3 | 4 | 5

/** 1=Draft 2=Published 3=Archived 4=Removed 5=Scheduled */
export type PostStatus = 1 | 2 | 3 | 4 | 5

/** 0=None 1=Warned 2=Hidden 3=Removed */
export type PostModerationAction = 0 | 1 | 2 | 3

/** 1=Spam 2=Nudity 3=HateOrHarassment 4=Violence 5=Misleading 6=Bullying 7=SuicideOrSelfHarm 8=DangerousOrganizations 9=PrivacyViolation 10=Scam 99=Other */
export type PostReportReason = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 99

/** 1=Open 2=InReview 3=Resolved 4=Dismissed 5=AutoResolved */
export type PostReportState = 1 | 2 | 3 | 4 | 5

export interface PostDto {
  id:               string
  authorAccountId:  string
  type:             PostType
  visibility:       PostVisibility
  status:           PostStatus
  body:             string | null
  originalPostId:   string | null
  eventStartUtc:    string | null
  eventEndUtc:      string | null
  publishedUtc:     string | null
  editedUtc:        string | null
  editLocked:       boolean
  reactionCount:    number
  commentCount:     number
  shareCount:       number
  viewCount:        number
  moderationAction: PostModerationAction
  moderationReason: string | null
  createdUtc:       string
  updatedUtc:       string
  rowVersion:       string | null
}

export interface PostReportDto {
  id:               string
  postId:           string
  reporterAccountId: string
  reason:           PostReportReason
  context:          string | null
  state:            PostReportState
  resolverAccountId: string | null
  resolutionNote:   string | null
  resolvedUtc:      string | null
  createdUtc:       string
  updatedUtc:       string
  rowVersion:       string | null
}

// ── Identity ──────────────────────────────────────────────────────────────────

/** 1=Active 2=Suspended 3=Deactivated 4=Deleted 5=Purged */
export type AccountStatus = 1 | 2 | 3 | 4 | 5

export interface AccountDto {
  id:               string
  displayName:      string | null
  locale:           string | null
  timezone:         string | null
  status:           AccountStatus
  dateOfBirth:      string | null
  gender:           string | null
  avatarUrl:        string | null
  countryCode:      string | null
  emailVerifiedUtc: string | null
  phoneVerifiedUtc: string | null
  lastActiveUtc:    string | null
  createdUtc:       string
  updatedUtc:       string
}

// ── Query filter types ────────────────────────────────────────────────────────

export interface KycCreatorQueueFilter {
  state?:    ApplicationState
  cursor?:   string
  pageSize?: number
}

export interface KycVendorQueueFilter {
  state?:    ApplicationState
  cursor?:   string
  pageSize?: number
}

export interface KycReviewQueueFilter {
  applicantKind?: KycApplicantKind
  state?:         KycReviewState
  reviewerId?:    string
  overdueOnly?:   boolean
  pageNumber?:    number
  pageSize?:      number
}

export interface AudioTracksFilter {
  state?:    MusicTrackRefState
  cursor?:   string
  pageSize?: number
}

export interface ModerationQueueFilter {
  targetKind?: ModerationTargetKind
  state?:      ModerationItemState
  source?:     ModerationSource
  reviewerId?: string
  pageNumber?: number
  pageSize?:   number
}
