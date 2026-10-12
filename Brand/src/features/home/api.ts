import { api } from '../../api/client';
import type { Money } from '../../lib/format';

/** BrandStudio VendorAnalyticsController — the sales overview the mobile vendor dashboard uses. */
export interface KpiValue<T> {
  current: T;
  previous: T;
  deltaPercent: number | null;
}

export interface AnalyticsOverview {
  window: { fromUtc: string; toUtc: string; durationDays: number };
  grossSales: KpiValue<Money>;
  netRevenue: KpiValue<Money>;
  conversionRate: KpiValue<number>;
  totalOrders: KpiValue<number>;
  revenueTrend: { date: string; amount: Money }[];
  topProducts: { productId: string; name: string; thumbnailUrl: string | null; unitsSold: number; totalRevenue: Money }[];
}

export const homeApi = {
  overview: (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 3600 * 1000);
    return api.get<AnalyticsOverview>('/v1/vendor/analytics/overview', {
      fromUtc: from.toISOString(),
      toUtc: to.toISOString(),
      topProductsLimit: 5,
      topCreatorsLimit: 1,
    });
  },
};
