import { api } from '../../api/client';
import type { Money } from '../../lib/format';

/**
 * CreatorStudio CreatorAnalyticsController (`/v1/creator/analytics/*`, role Creator).
 *
 * Units: `conversionRate`, `completionRate`, `clickThroughRate` are RATIOS 0–1 (render with formatPercent);
 * `deltaPercent`, `percentOfTop`, `percentOfTotal`, `commissionRatePercent` are already percentages.
 * Windows: toUtc defaults to now, fromUtc to toUtc − 30 days; more than 365 days → 400 (blocked client-side).
 * An unknown reel or someone else's reel answers 403, never 404.
 */

export const MAX_WINDOW_DAYS = 365;

export const TopReelsSort = { HighestEarnings: 1, MostViewed: 2, HighestConversion: 3, MostEngagement: 4 } as const;
export const topReelsSortLabel: Record<number, string> = {
  1: 'Highest earnings',
  2: 'Most viewed',
  3: 'Best conversion',
  4: 'Most engagement',
};

export interface AnalyticsWindow {
  fromUtc: string;
  toUtc: string;
  durationDays: number;
}

export interface KpiTileValue<T> {
  current: T;
  previous: T;
  /** Already a percentage; null when the previous value was 0. */
  deltaPercent: number | null;
}

export interface EarningsTrendPoint {
  date: string;
  amount: Money;
}

export interface TopReel {
  reelId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAtUtc: string;
  views: number;
  likes: number;
  impressions: number;
  shares: number;
  comments: number;
  sales: number;
  earnings: Money;
}

export interface TopProduct {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  totalSales: number;
  totalCommission: Money;
  commissionRatePercent: number;
  avgCommissionPerSale: Money;
}

export interface AnalyticsOverview {
  window: AnalyticsWindow;
  totalEarnings: KpiTileValue<Money>;
  totalSales: KpiTileValue<number>;
  conversionRate: KpiTileValue<number>;
  totalViews: KpiTileValue<number>;
  pendingBalance: Money;
  earningsTrend: EarningsTrendPoint[];
  topReels: TopReel[];
  topProducts: TopProduct[];
}

export interface FunnelStage {
  count: number;
  percentOfTop: number;
}

export interface AnalyticsReport {
  window: AnalyticsWindow;
  earningsTrend: EarningsTrendPoint[];
  contentPerformance: { reelId: string; title: string; thumbnailUrl: string | null; earnings: Money; sales: number }[];
  conversionMetrics: { totalClicks: number; totalOrders: number; conversionRate: number; averageOrderValue: Money };
  conversionFunnel: { views: FunnelStage; clicks: FunnelStage; addedToCart: FunnelStage; orders: FunnelStage };
  audienceDemographic: { ageRange: string; percent: number }[];
  bestPostingTimes: { dayOfWeekLabel: string; startHourLocal: number; endHourLocal: number; annotation: string }[];
  genderDistribution: { femalePercent: number; malePercent: number; otherPercent: number };
  topProducts: TopProduct[];
  topLocations: { city: string; percent: number }[];
}

export interface ReelAnalytics {
  window: AnalyticsWindow;
  reel: {
    reelId: string;
    title: string | null;
    thumbnailUrl: string | null;
    sourcePlatform: string;
    sourceUrl: string;
    durationSeconds: number;
    publishedAtUtc: string | null;
    views: number;
    likes: number;
    comments: number;
  };
  totalEarnings: Money;
  earningsDistribution: { productId: string; name: string; thumbnailUrl: string | null; amount: Money; quantity: number; percentOfTotal: number }[];
  statistics: { conversionRate: number; clickThroughRate: number; completionRate: number; uniqueViewersEstimate: number };
  watchTimeMinutes: number;
  earningsTrend: EarningsTrendPoint[];
  topLocations: { city: string; percent: number }[];
}

/** A type alias (not an interface) so it fits the client's `Query` index signature. */
export type WindowQuery = {
  fromUtc?: string;
  toUtc?: string;
};

export const analyticsApi = {
  overview: (w: WindowQuery = {}) => api.get<AnalyticsOverview>('/v1/creator/analytics/overview', { ...w, topReelsLimit: 10, topProductsLimit: 10 }),
  report: (w: WindowQuery = {}) =>
    api.get<AnalyticsReport>('/v1/creator/analytics/report', { ...w, contentPerformanceLimit: 12, topProductsLimit: 5, topLocationsLimit: 5 }),
  topReels: (q: WindowQuery & { sortBy?: number; limit?: number } = {}) => api.get<TopReel[]>('/v1/creator/analytics/top-reels', q),
  reel: (reelId: string, w: WindowQuery = {}) => api.get<ReelAnalytics>(`/v1/creator/analytics/reels/${reelId}`, { ...w, topLocationsLimit: 5 }),
};

/** Preset windows for the range picker. */
export const RANGE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom…' },
] as const;

export function windowFor(days: number, now = new Date()): Required<WindowQuery> {
  const to = new Date(now);
  const from = new Date(now.getTime() - days * 86_400_000);
  return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
}

/** Validates a custom range: end after start, at most 365 days. Returns an error sentence or null. */
export function checkWindow(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return 'Choose a start and an end date.';
  if (to.getTime() <= from.getTime()) return 'The end date must be after the start date.';
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_WINDOW_DAYS) return 'Choose a range of at most 365 days.';
  return null;
}
