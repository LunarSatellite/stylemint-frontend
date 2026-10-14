import { api, type Query } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import type { Money } from '../../lib/format';
import { redactPii } from '../crm/redact';
import { periodDays, windowQuery, type Period } from './period';

/**
 * Every endpoint Insights reads. Plan + contracts: `D:\Stylemint\wt\seller-insights-plan.md`
 * ("Backend notes"). Existing vendor endpoints are used directly; the new vendor-scoped
 * `v1/vendor/insights/*` reads fill the gaps they leave.
 *
 * Every response passes through `redactPii` — no buyer phone number or email address can reach a
 * widget, even inside free text such as a search query.
 */

const get = <T>(path: string, query?: Query) => api.get<T>(path, query).then((r) => redactPii(r));

// ------------------------------------------------------------------ shared shapes

export interface KpiValue<T> {
  current: T;
  previous: T;
  deltaPercent: number | null;
}

export interface AnalyticsWindow {
  fromUtc: string;
  toUtc: string;
  durationDays: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  unitsSold: number;
  totalRevenue: Money;
  distinctCreatorCount: number;
}

export interface TopCreator {
  creatorAccountId: string;
  unitsSold: number;
  attributedRevenue: Money;
  commissionPaid: Money;
  distinctReelCount: number;
}

// ------------------------------------------------------------------ BrandStudio VendorAnalytics

/** `GET v1/vendor/analytics/overview` — the previous window of equal length is computed server side. */
export interface AnalyticsOverview {
  window: AnalyticsWindow;
  grossSales: KpiValue<Money>;
  netRevenue: KpiValue<Money>;
  /** A fraction (0.034 = 3.4 %). */
  conversionRate: KpiValue<number>;
  totalOrders: KpiValue<number>;
  revenueTrend: { date: string; amount: Money }[];
  topProducts: TopProduct[];
  topCreators: TopCreator[];
  trafficSources: { platform: string; percent: number }[];
}

export interface ProductAnalytics {
  window: AnalyticsWindow;
  header: { productId: string; title: string; thumbnailUrl: string | null; inStockUnits: number; isActive: boolean };
  revenue: KpiValue<Money>;
  unitsSold: KpiValue<number>;
  revenueTrend: { date: string; amount: Money }[];
  topCreators: TopCreator[];
  locations: { region: string; orderCount: number; revenue: Money }[];
  reviews: { reviewCount: number; averageRating: number; starDistribution: Record<string, number> };
}

// ------------------------------------------------------------------ BrandStudio VendorDashboard (brand intelligence)

export interface DashboardSnapshot {
  vendorProfileId: string;
  windowStartUtc: string;
  windowEndExclusiveUtc: string;
  topCreatorsByAttributedSales: {
    creatorAccountId: string;
    reelsInWindow: number;
    attributedUnitsSold: number;
    attributedRevenueAmount: number;
    attributedRevenueCurrency: string;
    commissionPaidAmount: number;
    commissionPaidCurrency: string;
    roiRatio: number;
  }[];
  reach: {
    totalImpressions: number;
    uniqueAudience: number;
    topRegions: string[];
    underperformingRegions: string[];
    audienceGrowthRate: number;
  };
  formatLearnings: { formatLabel: string; count: number; avgCompletionRate: number; avgConversionRate: number; takeaway: string }[];
  benchmark: {
    yourAvgConversion: number;
    cohortMedianConversion: number;
    cohortTopQuartileConversion: number;
    cohortLabel: string;
    cohortMemberCount: number;
    takeaway: string;
  } | null;
  suggestedCreators: { creatorAccountId: string; creatorHandle: string; matchScore: number; topThreeReasons: string }[];
  byRecipe: {
    recipeId: string;
    recipeVersion: number;
    citingCreatorCount: number;
    citedReelCount: number;
    attributedUnits: number;
    attributedRevenueAmount: number;
    attributedRevenueCurrency: string;
    bestReelId: string | null;
    bestReelRevenueAmount: number;
  }[];
}

// ------------------------------------------------------------------ Orders VendorPerformance

/** `GET v1/vendor/creator-performance` — with the creator's handle and name. */
export interface CreatorPerformanceRow {
  creatorAccountId: string;
  unitsSold: number;
  attributedRevenue: number;
  commissionPaid: number;
  currency: string;
  distinctReelCount: number;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
}

// ------------------------------------------------------------------ Catalog VendorStore / Pricing

export const StoreActionKind = { RestockSoon: 1, SoldOutWhileSelling: 2, SlowMovingStock: 3, AddProductImages: 4, ReturnsRising: 5 } as const;
export const storeActionLabel: Record<number, string> = {
  1: 'Restock soon',
  2: 'Sold out while selling',
  3: 'Slow-moving stock',
  4: 'Add photos',
  5: 'Returns rising',
};
export const severityLabel: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
export const severityColor: Record<number, string> = { 1: 'signal', 2: 'amber', 3: 'gray' };

export interface StoreAction {
  kind: number;
  severity: number;
  productId: string;
  productVariantId: string | null;
  productName: string;
  sku: string | null;
  recommendation: string;
  evidence: string[];
  valueAtStake: Money | null;
}

export interface StoreActionQueue {
  actions: StoreAction[];
  generatedUtc: string;
}

export interface StoreTwin {
  activeProductCount: number;
  outOfStockProductCount: number;
  lowStockVariantCount: number;
  totalUnitsOnHand: number;
  activeFlashSaleCount: number;
  unitsSoldLast7Days: number;
  generatedUtc: string;
}

export interface PriceSuggestion {
  suggestionId: string;
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  percentChange: number;
  currency: string;
  reasonCode: string;
  reason: string;
  recommendation: string;
  /** null = not measured (never a made-up zero). */
  viewCount: number | null;
  cartAddCount: number | null;
  demandScore: number;
  expiresUtc: string;
}

export interface FlashSale {
  flashSaleId: string;
  productId: string;
  productName: string;
  originalPrice: number;
  salePrice: number;
  currency: string;
  startUtc: string;
  endUtc: string;
  maxUnits: number;
  unitsSold: number;
  isActive: boolean;
}

export interface FlashSaleLift {
  flashSaleId: string;
  baselineDailyUnits: number;
  promoDailyUnits: number;
  /** A fraction: 0.25 = +25 % daily units against the 7 days before. */
  liftPercent: number | null;
  verdict: string;
}

export const SponsoredState = { Active: 1, Paused: 2 } as const;

export interface SponsoredListing {
  id: string;
  productId: string;
  productName: string;
  state: number;
  isLive: boolean;
  dailyImpressionCap: number;
  endsUtc: string | null;
  impressionsToday: number;
  impressionsLast7Days: number;
  unitsSoldLast7Days: number;
  unitsSoldPrevious7Days: number;
  disclosure: string;
  salesComparisonNote: string;
  createdUtc: string;
  updatedUtc: string;
}

export const campaignStateLabel: Record<number, string> = {
  1: 'Draft',
  2: 'Ready for approval',
  3: 'Approved',
  4: 'Active',
  5: 'Paused',
  6: 'Completed',
  7: 'Cancelled',
};
export const campaignStateColor: Record<number, string> = { 1: 'gray', 2: 'amber', 3: 'blue', 4: 'forest', 5: 'gray', 6: 'forest', 7: 'gray' };

export interface CampaignWorkspace {
  id: string;
  brandBriefId: string;
  name: string;
  state: number;
  budgetAmount: number;
  budgetCurrency: string;
  spentAmount: number;
  approvedUtc: string | null;
  activatedUtc: string | null;
  completedUtc: string | null;
}

export interface EmiProduct {
  productId: string;
  productName: string;
  enabled: boolean;
  tenures: number[];
  minDownPaymentPercent: number;
  eligibleVariantCount: number;
}

// ------------------------------------------------------------------ Discovery (demand)

export interface DemandSignals {
  windowDays: number;
  generatedUtc: string;
  topSearches: { query: string; count: number }[];
  unmetSearches: { query: string; count: number }[];
}

export const IntentChannel = { Search: 1, UnmetSearch: 2, Cart: 3, Purchase: 4 } as const;

export interface IntentOpportunity {
  subject: string;
  searches: number;
  unmetSearches: number;
  cartActions: number;
  purchases: number;
  purchaseConversionPercent: number;
  distinctShoppers: number;
  recommendation: string;
}

export interface IntentBoard {
  generatedUtc: string;
  windowDays: number;
  governance: string;
  channels: { channel: number; signalCount: number; knownShopperCount: number; totalWeight: number; totalAmount: number | null; currency: string | null }[];
  opportunities: IntentOpportunity[];
  minimumCohortSize: number;
  reportableSubjects: number;
  withheldSubjects: number;
  anonymousSignals: number;
}

export interface UnmetDemandRow {
  query: string;
  foldedVariants: string[];
  observations: number;
  distinctShoppers: number;
  shareOfObservedRequestsPercent: number;
  reasons: { reason: string; observations: number }[];
  observedOnDays: number;
  firstObservedUtc: string;
  lastObservedUtc: string;
}

export interface UnmetDemandReport {
  generatedUtc: string;
  window: {
    days: number;
    observedRequests: number;
    unmetRequests: number;
    minimumCohortSize: number;
    reportableQueries: number;
    withheldQueries: number;
  };
  channels: { channel: string; connected: boolean; observedRequests: number; unmetRequests: number }[];
  unmet: UnmetDemandRow[];
  basis: string;
  governance: string;
}

// ------------------------------------------------------------------ Reels / Partnerships

export const ReelApprovalState = { Pending: 1 } as const;

export interface ReelApproval {
  id: string;
  reelId: string;
  creatorAccountId: string;
  partnershipId: string;
  round: number;
  state: number;
  creatorNote: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  rejectionReason: string | null;
  expiredUtc: string | null;
}

export const partnershipStateLabel: Record<number, string> = { 1: 'Invited', 2: 'Declined', 3: 'Active', 4: 'Paused', 5: 'Ended' };
export const partnershipStateColor: Record<number, string> = { 1: 'blue', 2: 'gray', 3: 'forest', 4: 'amber', 5: 'gray' };

export interface Partnership {
  id: string;
  creatorProfileId: string;
  creatorAccountId: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  creatorLogoUrl: string | null;
  state: number;
  commissionMinPercent: number;
  commissionMaxPercent: number;
  invitedUtc: string;
  respondedUtc: string | null;
  endedUtc: string | null;
  initiatedByCreator: boolean;
}

// ------------------------------------------------------------------ endpoints

/** Discovery's demand reads are trailing windows of whole days: signals and unmet demand at most 30, the intent board at most 90. */
export function demandDays(p: Period, max = 30): number {
  return Math.min(max, Math.max(1, periodDays(p)));
}

export const insightsApi = {
  overview: (p: Period, opts: { topProducts?: number; topCreators?: number } = {}) =>
    get<AnalyticsOverview>('/v1/vendor/analytics/overview', {
      ...windowQuery(p),
      topProductsLimit: opts.topProducts ?? 10,
      topCreatorsLimit: opts.topCreators ?? 10,
    }),
  topProducts: (p: Period, limit = 50) =>
    get<{ window: AnalyticsWindow; items: TopProduct[] }>('/v1/vendor/analytics/products', { ...windowQuery(p), limit }),
  productAnalytics: (productId: string, p: Period) =>
    get<ProductAnalytics>(`/v1/vendor/products/${productId}/analytics`, { ...windowQuery(p), topCreatorsLimit: 5, locationsLimit: 10 }),
  /** Vendor-scoped through the team resolver (works for team members) but ids only — names come from `creatorPerformance`. */
  creators: (p: Period, limit = 100) =>
    get<{ window: AnalyticsWindow; items: TopCreator[] }>('/v1/vendor/analytics/creators', { ...windowQuery(p), limit }),
  /** Uses the caller's own account (a team member gets []); carries handle, name and avatar. */
  creatorPerformance: (p: Period, limit = 50) =>
    get<CreatorPerformanceRow[]>('/v1/vendor/creator-performance', { ...windowQuery(p), limit }),
  /** `windowDays` max 89 (90+ is a 400). Only `topCreatorsByAttributedSales` carries real data today. */
  dashboard: (p: Period) => get<DashboardSnapshot>('/v1/vendor/dashboard', { windowDays: Math.min(89, periodDays(p)) }),

  storeActions: () => get<StoreActionQueue>('/v1/vendor/store/actions'),
  digitalTwin: () => get<StoreTwin>('/v1/vendor/store/digital-twin'),
  priceSuggestions: () => get<PriceSuggestion[]>('/v1/vendor/pricing/suggestions'),
  /** Every live flash sale on StyleMint — filter to the seller's own products. */
  flashSales: () => get<FlashSale[]>('/v1/vendor/pricing/flash-sales'),
  flashSaleLift: (id: string) => get<FlashSaleLift>(`/v1/vendor/pricing/flash-sales/${id}/incrementality`),
  sponsored: () => get<SponsoredListing[]>('/v1/vendor/store/sponsored'),
  campaigns: () => get<CampaignWorkspace[]>('/v1/vendor/campaign-workspaces'),
  emiProducts: () => get<EmiProduct[]>('/v1/vendor/emi/products'),
  /** Ids of the seller's own products (one 100-item page is plenty for matching promotions). */
  ownProductIds: async () => {
    const page = await get<PagedResult<{ id: string }>>('/v1/vendor/products', { pageSize: 100 });
    return new Set(page.items.map((p) => p.id));
  },

  demandSignals: (p: Period, limit = 25) => get<DemandSignals>('/api/v1/vendor/demand-signals', { days: demandDays(p), limit }),
  intentBoard: (p: Period, limit = 25) => get<IntentBoard>('/api/v1/vendor/intent-decision-board', { days: demandDays(p, 90), limit }),
  unmetDemand: (p: Period, limit = 25) => get<UnmetDemandReport>('/api/v1/vendor/unmet-demand', { days: demandDays(p), limit }),

  reelApprovals: () => get<ReelApproval[]>('/v1/vendor/reel-approvals'),
  partnerships: () => get<PagedResult<Partnership>>('/v1/vendor/partnerships', { pageSize: 100 }),
};

/** Query keys: everything under `['insights', …]`. */
export const INSIGHTS_KEY = 'insights';

/** "Asha Rai (@asha.styles)" — never an email or phone, those are not in these DTOs. */
export function creatorLabel(p: Partial<Pick<Partnership, 'creatorName' | 'creatorHandle'>> | undefined, fallbackId?: string | null): string {
  const handle = p?.creatorHandle?.replace(/^@/, '');
  if (handle) return p?.creatorName ? `${p.creatorName} (@${handle})` : `@${handle}`;
  if (p?.creatorName) return p.creatorName;
  return fallbackId ? `Creator ${fallbackId.slice(0, 8)}` : 'Creator';
}
