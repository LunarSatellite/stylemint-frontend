import dayjs from 'dayjs';
import { formatMoney, formatMoneyCompact, formatNumber, humanize } from '../../lib/format';
import type { AnalyticsOverview, TopProduct } from './api';
import type { Metric, Momentum, ProductInsight, SalesInsights, StockStatus } from './contracts';
import { deltaPercent, pointDelta, ratio, type ComparePoint, type Grain } from './period';

/**
 * Pure view models: each section renders one shape whether the data came from the new
 * `v1/vendor/insights/*` endpoints or from the older endpoints used before they were deployed.
 */

export interface KpiSpec {
  key: string;
  label: string;
  value: string;
  previous?: string;
  delta: number | null;
  unit: 'percent' | 'points';
  /** Down is good (returns, cancellations, commission). */
  invert?: boolean;
  isNew?: boolean;
  hint?: string;
}

const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`);

function moneyKpi(key: string, label: string, m: Metric, extra: Partial<KpiSpec> = {}): KpiSpec {
  return {
    key,
    label,
    value: formatMoneyCompact(m.current),
    previous: formatMoney(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
    ...extra,
  };
}

function countKpi(key: string, label: string, m: Metric, extra: Partial<KpiSpec> = {}): KpiSpec {
  return {
    key,
    label,
    value: formatNumber(m.current),
    previous: formatNumber(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
    ...extra,
  };
}

function rateKpi(key: string, label: string, m: Metric<number | null>, extra: Partial<KpiSpec> = {}): KpiSpec {
  return { key, label, value: pct(m.current), previous: pct(m.previous), delta: pointDelta(m.current, m.previous), unit: 'points', ...extra };
}

export function salesKpisFromInsights(d: SalesInsights): KpiSpec[] {
  const s = d.summary;
  return [
    moneyKpi('sales', 'Revenue', s.grossSales),
    moneyKpi('net', 'You keep (after commission)', s.netAfterCommission),
    countKpi('orders', 'Orders', s.orders),
    { ...moneyKpi('aov', 'Average order', s.averageOrderValue), value: formatMoney(Math.round(s.averageOrderValue.current)) },
    countKpi('units', 'Units sold', s.unitsSold),
    rateKpi('returns', 'Return rate', s.returnRatePercent, { invert: true, hint: `${formatNumber(s.returnedUnits.current)} units returned` }),
    rateKpi('conversion', 'Views → orders', s.viewToOrderPercent, { hint: `${formatNumber(s.productViews.current)} product views` }),
    countKpi('cancelled', 'Cancelled orders', s.cancelledOrders, { invert: true, isNew: false }),
  ];
}

export function salesKpisFromOverview(d: AnalyticsOverview): KpiSpec[] {
  const g = d.grossSales;
  const o = d.totalOrders;
  const aovNow = ratio(g.current.amount, o.current);
  const aovPrev = ratio(g.previous.amount, o.previous);
  return [
    moneyKpi('sales', 'Revenue', { current: g.current.amount, previous: g.previous.amount, deltaPercent: null }),
    moneyKpi('net', 'You keep (after commission)', { current: d.netRevenue.current.amount, previous: d.netRevenue.previous.amount, deltaPercent: null }, { isNew: false }),
    countKpi('orders', 'Orders', { current: o.current, previous: o.previous, deltaPercent: null }),
    {
      key: 'aov',
      label: 'Average order',
      value: aovNow === null ? '—' : formatMoney(Math.round(aovNow)),
      previous: aovPrev === null ? '—' : formatMoney(Math.round(aovPrev)),
      delta: deltaPercent(aovNow, aovPrev),
      unit: 'percent',
    },
    {
      key: 'conversion',
      label: 'Reel conversion',
      value: pct(d.conversionRate.current * 100),
      previous: pct(d.conversionRate.previous * 100),
      delta: pointDelta(d.conversionRate.current * 100, d.conversionRate.previous * 100),
      unit: 'points',
      hint: 'Orders from reels ÷ reel views',
    },
  ];
}

/** "1 Oct" for a day, "1–7 Oct" for a week block, "Oct 2026" for a month. */
export function bucketLabel(start: string, end: string, grain: Grain): string {
  const a = dayjs(start);
  const b = dayjs(end);
  if (grain === 'month') return a.format('MMM YYYY');
  if (grain === 'week' && !a.isSame(b, 'day')) return a.isSame(b, 'month') ? `${a.format('D')}–${b.format('D MMM')}` : `${a.format('D MMM')}–${b.format('D MMM')}`;
  return a.format('D MMM');
}

export function trendFromInsights(d: SalesInsights, metric: 'sales' | 'orders'): ComparePoint[] {
  return d.trend.map((t) => ({
    label: bucketLabel(t.start, t.end, d.granularity),
    current: metric === 'sales' ? t.grossSales : t.orders,
    previous: metric === 'sales' ? t.previousGrossSales : t.previousOrders,
  }));
}

// ------------------------------------------------------------------ products

export interface ProductRow {
  productId: string;
  name: string;
  thumbnailUrl: string | null;
  categoryName: string | null;
  units: number;
  revenue: number;
  prevRevenue: number | null;
  changePercent: number | null;
  momentum: Momentum;
  views: number | null;
  carts: number | null;
  orders: number | null;
  viewToCart: number | null;
  viewToOrder: number | null;
  returnedUnits: number | null;
  returnRate: number | null;
  rating: number | null;
  reviews: number | null;
  stockOnHand: number | null;
  daysOfCover: number | null;
  stockStatus: StockStatus | null;
}

/** The backend's rule: ±20 % is rising / falling; nothing before is "new". */
export function momentumOf(current: number, previous: number | null): Momentum {
  if (previous === null) return 'steady';
  if (current === 0 && previous === 0) return 'none';
  if (previous === 0) return 'new';
  const d = ((current - previous) / previous) * 100;
  if (d >= 20) return 'rising';
  if (d <= -20) return 'falling';
  return 'steady';
}

export function productRowFromInsight(p: ProductInsight): ProductRow {
  return {
    productId: p.productId,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl,
    categoryName: p.categoryName,
    units: p.unitsSold,
    revenue: p.grossSales,
    prevRevenue: p.previousGrossSales,
    changePercent: p.salesDeltaPercent,
    momentum: p.momentum,
    views: p.productViews,
    carts: p.addToCarts,
    orders: p.orders,
    viewToCart: p.viewToCartPercent,
    viewToOrder: p.viewToOrderPercent,
    returnedUnits: p.returnedUnits,
    returnRate: p.returnRatePercent,
    rating: p.reviewCount > 0 ? p.averageRating : null,
    reviews: p.reviewCount,
    stockOnHand: p.stockOnHand,
    daysOfCover: p.daysOfCover,
    stockStatus: p.stockStatus,
  };
}

/**
 * The older endpoints: this period's product list joined with the previous one. Products that sold
 * only before show up with 0 now (they are the ones falling the hardest). `previous` null = not comparing.
 */
export function productRowsFromTop(current: TopProduct[], previous: TopProduct[] | null): ProductRow[] {
  const blank = { categoryName: null, views: null, carts: null, orders: null, viewToCart: null, viewToOrder: null, returnedUnits: null, returnRate: null, rating: null, reviews: null, stockOnHand: null, daysOfCover: null, stockStatus: null };
  const prev = new Map((previous ?? []).map((p) => [p.productId, p]));
  const rows: ProductRow[] = current.map((p) => {
    const before = prev.get(p.productId);
    const prevRevenue = previous ? (before?.totalRevenue.amount ?? 0) : null;
    return {
      ...blank,
      productId: p.productId,
      name: p.name,
      thumbnailUrl: p.thumbnailUrl,
      units: p.unitsSold,
      revenue: p.totalRevenue.amount,
      prevRevenue,
      changePercent: prevRevenue === null ? null : deltaPercent(p.totalRevenue.amount, prevRevenue),
      momentum: momentumOf(p.totalRevenue.amount, prevRevenue),
    };
  });
  if (previous) {
    const seen = new Set(current.map((p) => p.productId));
    for (const p of previous) {
      if (seen.has(p.productId)) continue;
      rows.push({
        ...blank,
        productId: p.productId,
        name: p.name,
        thumbnailUrl: p.thumbnailUrl,
        units: 0,
        revenue: 0,
        prevRevenue: p.totalRevenue.amount,
        changePercent: -100,
        momentum: momentumOf(0, p.totalRevenue.amount),
      });
    }
  }
  return rows;
}

export function risingFalling(rows: ProductRow[], n = 5): { rising: ProductRow[]; falling: ProductRow[] } {
  const change = (r: ProductRow) => r.revenue - (r.prevRevenue ?? 0);
  return {
    rising: rows
      .filter((r) => r.momentum === 'rising' || r.momentum === 'new')
      .sort((a, b) => change(b) - change(a))
      .slice(0, n),
    falling: rows
      .filter((r) => r.momentum === 'falling')
      .sort((a, b) => change(a) - change(b))
      .slice(0, n),
  };
}

export const stockStatusLabel: Record<StockStatus, string> = {
  out_of_stock: 'Out of stock',
  critical: 'Runs out within days',
  low: 'Low',
  healthy: 'Healthy',
  no_recent_sales: 'Not selling',
  untracked: 'Not tracked',
};

export const stockStatusColor: Record<StockStatus, string> = {
  out_of_stock: 'signal',
  critical: 'signal',
  low: 'amber',
  healthy: 'forest',
  no_recent_sales: 'gray',
  untracked: 'gray',
};

export const momentumLabel: Record<Momentum, string> = { rising: 'Rising', falling: 'Falling', steady: 'Steady', new: 'New', none: '—' };

/** A source / kind code the server did not label: "external_agent" → "External agent". */
export const labelOf = (code: string) => humanize(code);
