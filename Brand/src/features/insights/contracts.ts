import { api, isMissingEndpoint, type Query } from '../../api/client';
import { redactPii } from '../crm/redact';
import { dayQuery, type Grain, type Period } from './period';

/**
 * The new vendor-scoped reads `GET v1/vendor/insights/{sales|products|reels|creators|promotions|demand}`
 * (BrandStudio VendorInsightsController; contract in the plan's "Backend notes", section NEW).
 *
 * - Periods are inclusive Asia/Kathmandu days `from` / `to` ("yyyy-MM-dd"), at most 366 days; the
 *   previous period (same number of days right before) is computed by the server and every metric
 *   comes as `{ current, previous, deltaPercent }`.
 * - Money is a plain NPR number. Responses are cached per vendor (~120 s).
 * - Team members are served through the vendor resolver.
 *
 * Until these are deployed they 404 with no error code; `preferInsights` then falls back to the
 * existing endpoints, so the same page works before and after the backend release.
 */

const get = <T>(path: string, query?: Query) => api.get<T>(path, query).then((r) => redactPii(r));

export interface Metric<T = number> {
  current: T;
  previous: T;
  /** Percent; null when previous is 0 or missing. */
  deltaPercent: number | null;
}

export interface InsightsPeriod {
  from: string;
  to: string;
  days: number;
  previousFrom: string;
  previousTo: string;
  timeZone: string;
  currency: string;
  generatedUtc: string;
  cacheSeconds: number;
}

// ------------------------------------------------------------------ sales

export interface SalesInsights {
  period: InsightsPeriod;
  granularity: Grain;
  summary: {
    grossSales: Metric;
    orders: Metric;
    unitsSold: Metric;
    averageOrderValue: Metric;
    creatorCommission: Metric;
    netAfterCommission: Metric;
    cancelledOrders: Metric;
    cancelledSales: Metric;
    returnRequests: Metric;
    returnedUnits: Metric;
    returnRatePercent: Metric<number | null>;
    refundedSales: Metric;
    productViews: Metric;
    addToCarts: Metric;
    viewToOrderPercent: Metric<number | null>;
  };
  buyers: {
    buyers: Metric;
    newBuyers: Metric;
    returningBuyers: Metric;
    returningPercent: Metric<number | null>;
    salesPerBuyer: Metric<number | null>;
  };
  trend: {
    start: string;
    end: string;
    grossSales: number;
    orders: number;
    unitsSold: number;
    previousGrossSales: number;
    previousOrders: number;
    previousUnitsSold: number;
  }[];
  bySource: {
    source: string;
    label: string;
    grossSales: number;
    orders: number;
    unitsSold: number;
    sharePercent: number | null;
    previousGrossSales: number;
    previousOrders: number;
    deltaPercent: number | null;
  }[];
  truncated: boolean;
  notes: string[];
}

// ------------------------------------------------------------------ products

export type Momentum = 'rising' | 'falling' | 'steady' | 'new' | 'none';
export type StockStatus = 'out_of_stock' | 'critical' | 'low' | 'healthy' | 'no_recent_sales' | 'untracked';

export interface ProductInsight {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  state: number;
  categoryId: string;
  categoryName: string | null;
  productViews: number;
  addToCarts: number;
  orders: number;
  unitsSold: number;
  grossSales: number;
  previousUnitsSold: number;
  previousGrossSales: number;
  salesDeltaPercent: number | null;
  momentum: Momentum;
  viewToCartPercent: number | null;
  cartToOrderPercent: number | null;
  viewToOrderPercent: number | null;
  returnedUnits: number;
  returnRatePercent: number | null;
  averageRating: number;
  reviewCount: number;
  stockOnHand: number | null;
  averageDailyUnits: number;
  daysOfCover: number | null;
  stockStatus: StockStatus;
}

export interface ProductInsightsPage {
  period: InsightsPeriod;
  funnel: {
    productViews: Metric;
    addToCarts: Metric;
    orders: Metric;
    unitsSold: Metric;
    grossSales: Metric;
    viewToCartPercent: Metric<number | null>;
    cartToOrderPercent: Metric<number | null>;
    viewToOrderPercent: Metric<number | null>;
  };
  stock: { outOfStock: number; critical: number; low: number; healthy: number; noRecentSales: number; untracked: number };
  items: ProductInsight[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  truncated: boolean;
  notes: string[];
}

// ------------------------------------------------------------------ reels

export interface ReelInsight {
  reelId: string;
  creatorAccountId: string;
  isOwnReel: boolean;
  caption: string | null;
  thumbnailUrl: string | null;
  sourcePlatform: number;
  state: number;
  publishedAtUtc: string | null;
  durationSeconds: number;
  taggedProductIds: string[];
  views: number;
  completedViews: number;
  completionRatePercent: number | null;
  likes: number;
  saves: number;
  shares: number;
  /** null = not recorded (product-tag taps are not tracked yet). */
  productTaps: number | null;
  productDetailViews: number;
  addToCarts: number;
  orders: number;
  unitsSold: number;
  grossSales: number;
  creatorCommission: number;
  salesPerThousandViews: number | null;
  latestApprovalState: number | null;
}

export interface ReelInsightsPage {
  period: InsightsPeriod;
  totals: {
    reels: number;
    views: Metric;
    completedViews: Metric;
    completionRatePercent: Metric<number | null>;
    likes: Metric;
    saves: Metric;
    shares: Metric;
    productDetailViews: Metric;
    addToCarts: Metric;
    orders: Metric;
    unitsSold: Metric;
    grossSales: Metric;
    creatorCommission: Metric;
  };
  approvals: { pending: number; approvedInPeriod: number; rejectedInPeriod: number };
  items: ReelInsight[];
  byProduct: { productId: string; productName: string | null; reels: number; addToCarts: number; orders: number; unitsSold: number; grossSales: number }[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  notes: string[];
}

// ------------------------------------------------------------------ creators

export interface CreatorInsight {
  creatorAccountId: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  reels: number;
  views: number;
  completedViews: number;
  engagements: number;
  productDetailViews: number;
  addToCarts: number;
  affiliateClicks: number;
  orders: number;
  unitsSold: number;
  grossSales: number;
  previousGrossSales: number;
  salesDeltaPercent: number | null;
  commission: number;
  returnOnCommission: number | null;
  salesPerThousandViews: number | null;
}

export interface CreatorInsightsPage {
  period: InsightsPeriod;
  totals: {
    creators: number;
    views: Metric;
    engagements: Metric;
    affiliateClicks: Metric;
    addToCarts: Metric;
    orders: Metric;
    grossSales: Metric;
    commission: Metric;
    returnOnCommission: Metric<number | null>;
  };
  items: CreatorInsight[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  notes: string[];
}

// ------------------------------------------------------------------ promotions

export interface PromoWindow {
  fromUtc: string;
  toUtc: string;
  days: number;
  unitsSold: number;
  orders: number;
  grossSales: number;
  unitsPerDay: number;
  salesPerDay: number;
}

export interface FlashSaleInsight {
  flashSaleId: string;
  productId: string;
  productName: string | null;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  startUtc: string;
  endUtc: string;
  status: 'scheduled' | 'live' | 'ended' | 'stopped' | string;
  maxUnits: number;
  sale: PromoWindow;
  baseline: PromoWindow;
  unitsUpliftPercent: number | null;
  salesUpliftPercent: number | null;
  discountCost: number;
}

export interface SponsoredInsight {
  listingId: string;
  productId: string;
  productName: string | null;
  state: number;
  isLive: boolean;
  dailyImpressionCap: number;
  endsUtc: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  unitsSold: number;
  orders: number;
  grossSales: number;
  previousUnitsSold: number;
  previousGrossSales: number;
  salesDeltaPercent: number | null;
  ordersPerThousandImpressions: number | null;
}

export interface CodeInsight {
  code: string;
  kind: string;
  status: string;
  label: string | null;
  productId: string | null;
  storeId: string | null;
  scans: number;
  uniqueScanners: number;
  orders: number;
  unitsSold: number;
  grossSales: number;
  scanToOrderPercent: number | null;
}

export interface CampaignInsight {
  workspaceId: string;
  name: string;
  state: number;
  budgetAmount: number;
  spentAmount: number;
  currency: string;
  activatedUtc: string | null;
  completedUtc: string | null;
  measured: boolean;
  incrementalLiftPercent: number | null;
  primaryMetric: string | null;
}

export interface PromotionInsights {
  period: InsightsPeriod;
  flashSales: FlashSaleInsight[];
  sponsored: SponsoredInsight[];
  codes: CodeInsight[];
  campaigns: CampaignInsight[];
  paymentPlans: {
    applications: Metric;
    approved: Metric;
    declined: Metric;
    planSales: Metric;
    financed: Metric;
    approvalRatePercent: Metric<number | null>;
    shareOfOrdersPercent: Metric<number | null>;
    byKind: { kind: number; label: string; applications: number; approved: number; declined: number; planSales: number; financed: number }[];
  };
  /** Things StyleMint cannot measure for sellers (said once, instead of empty tables). */
  unavailable: string[];
  notes: string[];
}

// ------------------------------------------------------------------ demand

export interface DemandQuery {
  query: string;
  searches: number;
  unmetSearches: number;
  previousSearches: number;
  deltaPercent: number | null;
  matchedOn: string;
  categoryId: string | null;
  categoryName: string | null;
  yourMatchingProducts: number;
}

export interface DemandInsights {
  period: InsightsPeriod;
  previousComplete: boolean;
  relevantSearches: Metric;
  unmetRelevantSearches: Metric;
  categories: {
    categoryId: string;
    name: string;
    yourProducts: number;
    yourUnitsSold: number;
    searches: number;
    unmetSearches: number;
    previousSearches: number;
    deltaPercent: number | null;
  }[];
  searches: DemandQuery[];
  unmetSearches: DemandQuery[];
  trendingAttributes: { kind: string; value: string; searches: number; previousSearches: number; deltaPercent: number | null }[];
  suggestions: string[];
  basis: string;
  notes: string[];
}

// ------------------------------------------------------------------ fetchers

const BASE = '/v1/vendor/insights';

export interface ListQuery {
  sort?: string;
  direction?: 'asc' | 'desc';
  filter?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const newInsightsApi = {
  sales: (p: Period, granularity?: Grain) => get<SalesInsights>(`${BASE}/sales`, { ...dayQuery(p), granularity }),
  products: (p: Period, l: ListQuery = {}) => get<ProductInsightsPage>(`${BASE}/products`, { ...dayQuery(p), pageSize: 100, ...l }),
  reels: (p: Period, l: ListQuery = {}) => get<ReelInsightsPage>(`${BASE}/reels`, { ...dayQuery(p), pageSize: 100, ...l }),
  creators: (p: Period, l: ListQuery = {}) => get<CreatorInsightsPage>(`${BASE}/creators`, { ...dayQuery(p), pageSize: 100, ...l }),
  promotions: (p: Period) => get<PromotionInsights>(`${BASE}/promotions`, dayQuery(p)),
  /** Trailing window of whole days, 1–30. */
  demand: (days: number, limit = 50) => get<DemandInsights>(`${BASE}/demand`, { days: Math.min(30, Math.max(1, days)), limit }),
};

// ------------------------------------------------------------------ fallback

export type Sourced<N, L> = { source: 'insights'; data: N } | { source: 'legacy'; data: L };

/**
 * Ask the new insights endpoint; when it is not deployed (404/405/501 with no error code) use the
 * existing endpoints instead. Any other error is a real "could not load".
 */
export async function preferInsights<N, L>(primary: () => Promise<N>, fallback: () => Promise<L>): Promise<Sourced<N, L>> {
  try {
    return { source: 'insights', data: await primary() };
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e;
    return { source: 'legacy', data: await fallback() };
  }
}
