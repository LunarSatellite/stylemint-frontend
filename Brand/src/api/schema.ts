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

export interface Money {
  amount:   number
  currency: string
}

export interface KpiTile<T> {
  current:        T
  previousPeriod: T | null
  deltaPercent:   number | null
}

export interface ErrorResponseVm {
  errorCode:     string
  correlationId: string
  message:       string
}

// ── Enums (wire: integer) ────────────────────────────────────────────────────

/** 1=Draft 2=Locked 3=Retired */
export type BrandBriefState = 1 | 2 | 3

/** 1–7: DriveFirstPurchase … TestNewAudience */
export type CampaignGoal = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 1=Active 2=Superseded 3=Retired */
export type GoalTemplateState = 1 | 2 | 3

/** 1–13: OrderReceived … PartnershipEnded */
export type VendorActivityKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

// ── Brief embedded types ─────────────────────────────────────────────────────

export interface BriefHook {
  text:                    string | null
  expectedEngagementScore: number
  rationale:               string | null
}

export interface CommissionRange {
  minPercent: number
  maxPercent: number
}

export interface ReelCadence {
  reelsPerWeek:  number
  idealGapHours: number
  note:          string | null
}

export interface RecipeAttachment {
  recipeId:      string
  recipeVersion: number
  isPrimary:     boolean
  label:         string | null
}

export interface RoiProjectionSummary {
  estimatedReachCostAmount:    number
  estimatedReachCostCurrency:  string | null
  estimatedReachLow:           number
  estimatedReachHigh:          number
  estimatedSalesLow:           number
  estimatedSalesHigh:          number
  estimatedRevenueLowAmount:   number
  estimatedRevenueHighAmount:  number
  estimatedRevenueCurrency:    string | null
}

export interface BrandBriefBody {
  suggestedHooks:    BriefHook[]      | null
  doSayPoints:       string[]         | null
  dontSayPoints:     string[]         | null
  referenceReelIds:  string[]         | null
  audioThemes:       string[]         | null
  suggestedCadence:  ReelCadence      | null
  productVariantIds: string[]         | null
  recipeAttachments: RecipeAttachment[]| null
}

// ── Brief ────────────────────────────────────────────────────────────────────

export interface BrandBriefDto {
  id:              string
  vendorProfileId: string
  title:           string | null
  primaryGoal:     CampaignGoal
  version:         number
  rootBriefId:     string
  parentBriefId:   string | null
  state:           BrandBriefState
  commissionRange: CommissionRange     | null
  boostBudgetAmount:   number
  boostBudgetCurrency: string | null
  roiProjection:   RoiProjectionSummary | null
  body:            BrandBriefBody      | null
  explanationByKey: Record<string, string> | null
  lockedUtc:       string | null
  createdUtc:      string
  updatedUtc:      string
  rowVersion:      string | null
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface CreatorContributionRow {
  creatorAccountId:        string
  reelsInWindow:           number
  attributedUnitsSold:     number
  attributedRevenueAmount: number
  attributedRevenueCurrency: string | null
  commissionPaidAmount:    number
  commissionPaidCurrency:  string | null
  roiRatio:                number
}

export interface ReachDiagnosticsSummary {
  totalImpressions:       number
  uniqueAudience:         number
  topRegions:             string[] | null
  underperformingRegions: string[] | null
  audienceGrowthRate:     number
}

export interface FormatLearningRow {
  formatLabel:      string | null
  count:            number
  avgCompletionRate: number
  avgConversionRate: number
  takeaway:         string | null
}

export interface CompetitiveBenchmarkSummary {
  yourAvgConversion:           number
  cohortMedianConversion:      number
  cohortTopQuartileConversion: number
  cohortLabel:                 string | null
  cohortMemberCount:           number
  takeaway:                    string | null
}

export interface SuggestedCreatorRow {
  creatorAccountId: string
  creatorHandle:    string | null
  matchScore:       number
  topThreeReasons:  string | null
}

export interface RecipePerformanceRow {
  recipeId:                string
  recipeVersion:           number
  citingCreatorCount:      number
  citedReelCount:          number
  attributedUnits:         number
  attributedRevenueAmount: number
  attributedRevenueCurrency: string | null
  bestReelId:              string | null
  bestReelRevenueAmount:   number
}

export interface VendorDashboardSnapshot {
  vendorProfileId:              string
  windowStartUtc:               string
  windowEndExclusiveUtc:        string
  topCreatorsByAttributedSales: CreatorContributionRow[] | null
  reach:                        ReachDiagnosticsSummary  | null
  formatLearnings:              FormatLearningRow[]      | null
  benchmark:                    CompetitiveBenchmarkSummary | null  // null → hide widget entirely
  suggestedCreators:            SuggestedCreatorRow[]    | null
  byRecipe:                     RecipePerformanceRow[]   | null
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsWindowDto {
  fromUtc:      string
  toUtc:        string
  durationDays: number
}

export interface RevenueTrendPointDto {
  dateUtc:       string
  revenueAmount: number
  currency:      string
}

export interface TopProductDto {
  productId:    string
  productName:  string | null
  unitsSold:    number
  revenueAmount: number
  currency:     string
  deltaPercent: number | null
}

export interface TopCreatorDto {
  creatorAccountId: string
  creatorHandle:    string | null
  attributedRevenue: number
  currency:          string
  reelCount:         number
  conversionRate:    number
}

export interface TrafficSourceDto {
  source:      string
  sessions:    number
  sharePercent: number
}

export interface VendorAnalyticsOverviewDto {
  window:         AnalyticsWindowDto
  grossSales:     KpiTile<Money>
  netRevenue:     KpiTile<Money>
  conversionRate: KpiTile<number>
  totalOrders:    KpiTile<number>
  revenueTrend:   RevenueTrendPointDto[] | null
  topProducts:    TopProductDto[]        | null
  topCreators:    TopCreatorDto[]        | null
  trafficSources: TrafficSourceDto[]     | null
}

export interface VendorTopProductsPageDto {
  window: AnalyticsWindowDto
  items:  TopProductDto[] | null
}

export interface VendorCreatorPerformancePageDto {
  window: AnalyticsWindowDto
  items:  TopCreatorDto[] | null
}

export interface ProductDeepDiveHeaderDto {
  productId:   string
  productName: string | null
}

export interface CreatorDeepDiveHeaderDto {
  partnershipId:    string
  creatorAccountId: string
  creatorHandle:    string | null
}

export interface CreatorReelSnapshotDto {
  reelId:        string
  revenueAmount: number
  currency:      string
  views:         number
  conversionRate: number
}

export interface ProductLocationBucketDto {
  region:        string
  unitsSold:     number
  revenueAmount: number
  currency:      string
}

export interface ProductReviewSummaryDto {
  avgRating:    number
  reviewCount:  number
  positiveRate: number
}

export interface VendorProductAnalyticsDto {
  window:      AnalyticsWindowDto
  header:      ProductDeepDiveHeaderDto | null
  revenue:     KpiTile<Money>
  unitsSold:   KpiTile<number>
  revenueTrend: RevenueTrendPointDto[]   | null
  topCreators: TopCreatorDto[]           | null
  locations:   ProductLocationBucketDto[]| null
  reviews:     ProductReviewSummaryDto   | null
}

export interface VendorCreatorAnalyticsDto {
  window:           AnalyticsWindowDto
  header:           CreatorDeepDiveHeaderDto | null
  attributedRevenue: KpiTile<Money>
  unitsSold:        KpiTile<number>
  commissionPaid:   KpiTile<Money>
  distinctReelCount: KpiTile<number>
  revenueTrend:     RevenueTrendPointDto[] | null
  topProducts:      TopProductDto[]        | null
  topReels:         CreatorReelSnapshotDto[]| null
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface VendorActivityEntryDto {
  id:              string
  vendorAccountId: string
  kind:            VendorActivityKind
  headline:        string | null
  body:            string | null
  actionUrl:       string | null
  occurredUtc:     string
  createdUtc:      string
}

// ── Goal Templates ────────────────────────────────────────────────────────────

export interface GoalTemplateVersionDto {
  id:            string
  goal:          CampaignGoal
  version:       number
  promptText:    string | null
  notes:         string | null
  state:         GoalTemplateState
  effectiveFrom: string
  effectiveTo:   string | null
  createdUtc:    string
  updatedUtc:    string
  rowVersion:    string | null
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** 1=Email 2=Phone */
export type OtpDestinationType = 1 | 2

/** POST /v1/auth/login */
export interface LoginVm {
  identifierType: OtpDestinationType
  identifier:     string | null
  password:       string | null
  deviceId:       string | null
}

/** Response from POST /v1/auth/login */
export interface AuthResponseVm {
  accountId:        string
  sessionId:        string
  accessToken:      string | null
  accessExpiresUtc: string
  refreshToken:     string | null
  refreshExpiresUtc: string
  tokenType:        string | null
}

// ── Registration ─────────────────────────────────────────────────────────────

/** POST /v1/registration/start */
export interface StartRegistrationVm {
  displayName:    string | null
  email:          string | null
  phoneE164:      string | null
  countryDialCode: string | null
  locale:         string | null
  timezone:       string | null
}

/** Response from POST /v1/registration/start */
export interface StartRegistrationResult {
  accountId:           string
  emailId:             string
  phoneId:             string
  emailOtpExpiresUtc:  string
  phoneOtpExpiresUtc:  string
  emailOtpCode:        string | null
  phoneOtpCode:        string | null
  resumed:             boolean
}

/** POST /v1/registration/{accountId}/verify-email */
export interface VerifyEmailVm {
  email: string | null
  code:  string | null
}

/** POST /v1/registration/{accountId}/set-password */
export interface SetPasswordVm {
  password: string | null
}

/** POST /v1/registration/{accountId}/accept-terms */
export interface AcceptTermsVm {
  consentVersion: string | null
  ipAddress:      string | null
  userAgent:      string | null
}

/** Response from POST /v1/registration/{accountId}/accept-terms */
export interface RegistrationStatusDto {
  accountId:            string
  emailVerified:        boolean
  phoneVerified:        boolean
  hasPassword:          boolean
  termsAccepted:        boolean
  isComplete:           boolean
  termsConsentVersion:  string | null
}

// ── Vendor Policy ─────────────────────────────────────────────────────────────

export interface VendorBrandStudioPolicyDto {
  id:                     string
  vendorProfileId:        string
  monthlyLlmCallQuota:    number
  commissionCeilingPercent: number
  defaultCurrencyCode:    string | null
  createdUtc:             string
  updatedUtc:             string
  rowVersion:             string | null
}
