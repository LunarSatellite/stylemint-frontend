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

// ── QR Login ──────────────────────────────────────────────────────────────────

/** 1=BrandStudio 2=CreatorStudio */
export type QrTargetApp = 1 | 2

/** POST /v1/auth/qr/create */
export interface QrCreateRequest {
  targetApp:         QrTargetApp
  deviceFingerprint: string
  devicePlatform?:   number
  deviceModel?:      string
  deviceOsVersion?:  string
}

/** Response from POST /v1/auth/qr/create */
export interface QrCreateResponse {
  publicToken:  string
  clientSecret: string
  qrPayload:    string
  expiresUtc:   string
}

/** POST /v1/auth/qr/exchange */
export interface QrExchangeRequest {
  publicToken:  string
  clientSecret: string
}

export type QrSessionStatus = 'Pending' | 'Scanned' | 'Approved' | 'Consumed' | 'Rejected' | 'Expired'

/** Response from POST /v1/auth/qr/exchange */
export interface QrExchangeResponse {
  status: QrSessionStatus
  auth:   AuthResponseVm | null
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

// ── Sub-Orders ────────────────────────────────────────────────────────────────

/** 1=Pending 2=ReadyToShip 3=PickedUp 4=InTransit 5=OutForDelivery 6=Delivered 7=FailedDelivery 8=Cancelled 9=Disputed 10=Refunded 11=ReturnRequested */
export type SubOrderState = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

/** 1=OutOfStock 2=QualityIssue 3=CustomerRequest 4=FraudSuspected 5=UndeliverableAddress 6=Other */
export type OrderCancellationReason = 1 | 2 | 3 | 4 | 5 | 6

export interface ShippingAddressSnapshot {
  receiverName:  string | null
  receiverPhone: string | null
  addressLine1:  string | null
  landmark:      string | null
  country:       string | null
  state:         string | null
  city:          string | null
  zipCode:       string | null
  latitude:      number | null
  longitude:     number | null
}

export interface SubOrderLineDto {
  id:                       string
  subOrderId:               string
  productVariantId:         string
  quantity:                 number
  unitPriceAmount:          number
  unitPriceCurrency:        string | null
  productTitleSnapshot:     string | null
  variantLabelSnapshot:     string | null
  thumbnailUrlSnapshot:     string | null
  creatorAccountId:         string | null
  commissionRateSnapshot:   number | null
  commissionAmountValue:    number | null
  commissionAmountCurrency: string | null
  originatingReelId:        string | null
  lineSubtotalAmount:       number
  lineSubtotalCurrency:     string | null
}

export interface SubOrderDto {
  id:                     string
  orderId:                string
  vendorAccountId:        string
  state:                  SubOrderState
  shippingFeeAmount:      number
  shippingFeeCurrency:    string | null
  carrier:                string | null
  trackingNumber:         string | null
  shippedUtc:             string | null
  inTransitUtc:           string | null
  outForDeliveryUtc:      string | null
  deliveredUtc:           string | null
  cancelledUtc:           string | null
  cancellationReasonCode: OrderCancellationReason | null
  cancellationNote:       string | null
  lineSubtotalAmount:     number
  lineSubtotalCurrency:   string | null
  subtotalAmount:         number
  subtotalCurrency:       string | null
  lines:                  SubOrderLineDto[] | null
}

export interface VendorSubOrderListItemDto {
  id:                  string
  orderId:             string
  orderNumber:         string | null
  vendorAccountId:     string
  state:               SubOrderState
  shippingFeeAmount:   number
  shippingFeeCurrency: string | null
  subtotalAmount:      number
  subtotalCurrency:    string | null
  itemCount:           number
  carrier:             string | null
  trackingNumber:      string | null
  placedUtc:           string
  shippedUtc:          string | null
  deliveredUtc:        string | null
}

export interface PackingSlipLineDto {
  productTitleSnapshot: string | null
  variantLabelSnapshot: string | null
  quantity:             number
}

export interface PackingSlipDto {
  packingSlipNumber: string | null
  orderNumber:       string | null
  subOrderId:        string
  issuedUtc:         string
  placedUtc:         string
  shipTo:            ShippingAddressSnapshot | null
  carrier:           string | null
  trackingNumber:    string | null
  items:             PackingSlipLineDto[] | null
}

// ── Products ──────────────────────────────────────────────────────────────────

/** 1=Draft 2=PendingReview 3=Published 4=Archived 5=Rejected */
export type ProductState = 1 | 2 | 3 | 4 | 5

/** 1=Physical 2=Digital 3=Service 4=Bundle 5=Subscription */
export type ProductKind = 1 | 2 | 3 | 4 | 5

/** 1=OneTime 2=Weekly 3=Monthly 4=Quarterly 5=Annual */
export type BillingCadence = 1 | 2 | 3 | 4 | 5

export interface ProductImageDto {
  id:        string
  productId: string
  cdnUrl:    string | null
  sortOrder: number
  isPrimary: boolean
}

export interface ProductVariantDto {
  id:                string
  productId:         string
  sku:               string | null
  isDefault:         boolean
  priceAmount:       number
  priceCurrency:     string | null
  costPriceAmount:   number
  costPriceCurrency: string | null
  trackInventory:    boolean
  allowOverselling:  boolean
  quantityOnHand:    number
  productKind:       ProductKind
  billingCadence:    BillingCadence
  weightGrams:       number
  lengthCm:          number
  widthCm:           number
  heightCm:          number
  createdUtc:        string
  updatedUtc:        string
  rowVersion:        string | null
}

export interface ProductDto {
  id:                      string
  vendorAccountId:         string
  categoryId:              string
  name:                    string | null
  shortDescription:        string | null
  longDescriptionMarkdown: string | null
  shipsFromAddressId:      string | null
  processingTimeDays:      number
  state:                   ProductState
  wizardStepReached:       number
  averageRating:           number
  reviewCount:             number
  createdUtc:              string
  updatedUtc:              string
  rowVersion:              string | null
  variants:                ProductVariantDto[] | null
  images:                  ProductImageDto[]   | null
}

// ── Matches ───────────────────────────────────────────────────────────────────

/** 1=Algorithm 2=Manual 3=CreatorRequest 4=AdminSuggestion */
export type MatchSnapshotOrigin = 1 | 2 | 3 | 4

/** 1=Pending 2=Dismissed 3=Invited 4=Accepted 5=Expired */
export type MatchSnapshotState = 1 | 2 | 3 | 4 | 5

export interface MatchSnapshotDto {
  id:               string
  creatorAccountId: string
  creatorHandle:    string | null
  vendorAccountId:  string
  score:            number
  reasonSummary:    string | null
  origin:           MatchSnapshotOrigin
  state:            MatchSnapshotState
  computedUtc:      string
  createdUtc:       string
  updatedUtc:       string
  rowVersion:       string | null
}

// ── Partnerships ──────────────────────────────────────────────────────────────

/** 1=Invited 2=Active 3=Paused 4=Ended 5=Declined */
export type PartnershipState = 1 | 2 | 3 | 4 | 5

export interface PartnershipDto {
  id:                   string
  vendorProfileId:      string
  creatorProfileId:     string
  state:                PartnershipState
  commissionMinPercent: number
  commissionMaxPercent: number
  activeTermsVersionId: string
  invitedUtc:           string
  respondedUtc:         string | null
  endedUtc:             string | null
  endReason:            string | null
  brandBriefId:         string | null
  brandBriefVersion:    number | null
  initiatedByCreator:   boolean
  requestMessage:       string | null
  vendorRating:         number | null
  createdUtc:           string
  updatedUtc:           string
  rowVersion:           string | null
}

export interface CreatorPickerDto {
  creatorAccountId:       string
  displayName:            string | null
  handle:                 string | null
  avatarUrl:              string | null
  bio:                    string | null
  followerCount:          number | null
  niches:                 string[] | null
  hasExistingPartnership: boolean
}

// ── Recipes ───────────────────────────────────────────────────────────────────

/** 1=BriefGenerated 2=AdminCurated 3=VendorAuthored 4=SystemGenerated */
export type RecipeOrigin = 1 | 2 | 3 | 4

/** 1=Draft 2=Locked 3=Retired 4=Superseded */
export type RecipeState = 1 | 2 | 3 | 4

export interface RecipeContextDto {
  productVariantIds:       string[] | null
  categoryIds:             string[] | null
  brandStoryAnchor:        string | null
  moodLabel:               string | null
  intendedDurationSeconds: number
}

export interface RecipeSongSegmentDto {
  songTitle:        string | null
  artist:           string | null
  startAt:          string
  endAt:            string
  tempoBpm:         number | null
  segmentCharacter: string | null
  segmentDuration:  string
}

export interface CaptionVariantDto {
  text:                   string | null
  tone:                   string | null
  characterLength:        number
  hashtagCount:           number
  recommendedForPlatform: string | null
}

export interface ReelRecipeDto {
  id:                     string
  title:                  string | null
  origin:                 RecipeOrigin
  authorVendorProfileId:  string | null
  sourceBrandBriefId:     string | null
  musicTrackRefId:        string
  context:                RecipeContextDto     | null
  segment:                RecipeSongSegmentDto | null
  captionVariants:        CaptionVariantDto[]  | null
  state:                  RecipeState
  version:                number
  recipeVersion:          string | null
  createdUtc:             string
  updatedUtc:             string
  lockedUtc:              string | null
  citedInReelCount:       number
  avgCitedCompletionRate: number | null
  avgCitedConversionRate: number | null
  rowVersion:             string | null
}

// ── Inquiries ─────────────────────────────────────────────────────────────────

/** 1=Open 2=Replied 3=Closed */
export type ProductInquiryState = 1 | 2 | 3

export interface ProductInquiryDto {
  id:                  string
  customerAccountId:   string
  vendorAccountId:     string
  productId:           string | null
  orderId:             string | null
  question:            string | null
  state:               ProductInquiryState
  openedUtc:           string
  responseDeadlineUtc: string
  reply:               string | null
  repliedUtc:          string | null
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
