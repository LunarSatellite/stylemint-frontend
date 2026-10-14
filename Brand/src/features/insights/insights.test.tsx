import type { ReactElement } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders, type RecordedCall } from '../../test/utils';
import { resetCrmSession } from '../crm/session';
import { CRM, pagedEnvelope, SESSION, sellerCustomer, sessionBody } from '../crm/testkit';
import CreatorsPage from './CreatorsPage';
import CustomersPage from './CustomersPage';
import DemandPage from './DemandPage';
import InsightsLayout from './InsightsLayout';
import { productRowsFromTop, risingFalling } from './model';
import ProductsPage from './ProductsPage';
import PromotionsPage from './PromotionsPage';
import ReelsPage from './ReelsPage';
import SalesPage from './SalesPage';

// The chart library (recharts) is replaced by plain markup — jsdom has no layout to draw into. Our
// own wrappers in charts.tsx (lazy-loaded) still run.
vi.mock('@mantine/charts', () => ({
  AreaChart: ({ data, series }: { data: unknown[]; series: { name: string }[] }) => (
    <div data-testid="trend-chart" data-series={series.map((s) => s.name).join(',')}>
      {data.length} points
    </div>
  ),
  BarChart: ({ data }: { data: unknown[] }) => <div data-testid="bars-chart">{data.length} bars</div>,
  DonutChart: ({ data }: { data: unknown[] }) => <div data-testid="donut-chart">{data.length} slices</div>,
}));

const originalMatchMedia = window.matchMedia;

function setPhone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function renderSection(path: string, element: ReactElement, search = '?range=30d') {
  return renderWithProviders(
    <Routes>
      <Route path="/insights" element={<InsightsLayout />}>
        <Route index element={<Navigate to="sales" replace />} />
        <Route path={path} element={element} />
      </Route>
    </Routes>,
    { route: `/insights/${path}${search}` },
  );
}

const npr = (amount: number) => ({ amount, currency: 'NPR' });
const m = (current: number | null, previous: number | null, deltaPercent: number | null = null) => ({ current, previous, deltaPercent });
const PERIOD = {
  from: '2026-09-14',
  to: '2026-10-13',
  days: 30,
  previousFrom: '2026-08-15',
  previousTo: '2026-09-13',
  timeZone: 'Asia/Kathmandu',
  currency: 'NPR',
  generatedUtc: '2026-10-13T06:00:00Z',
  cacheSeconds: 120,
};
/** Whether a call asked for the later (current) of the two windows. */
const isCurrent = (c: RecordedCall) => new Date(new URLSearchParams(c.search).get('fromUtc')!).getTime() > Date.now() - 31 * 86_400_000;

beforeEach(() => resetCrmSession());
afterEach(() => {
  resetCrmSession();
  window.matchMedia = originalMatchMedia;
});

// ================================================================== 1 sales

function overview(over: Record<string, unknown> = {}) {
  return {
    window: { fromUtc: '2026-09-14T00:00:00Z', toUtc: '2026-10-13T00:00:00Z', durationDays: 30 },
    grossSales: { current: npr(50000), previous: npr(40000), deltaPercent: 25 },
    netRevenue: { current: npr(45000), previous: npr(36000), deltaPercent: 25 },
    conversionRate: { current: 0.034, previous: 0.03, deltaPercent: 13.3 },
    totalOrders: { current: 25, previous: 20, deltaPercent: 25 },
    revenueTrend: [
      { date: '2026-10-01', amount: npr(20000) },
      { date: '2026-10-05', amount: npr(30000) },
    ],
    topProducts: [],
    topCreators: [],
    trafficSources: [
      { platform: 'Instagram', percent: 60 },
      { platform: 'TikTok', percent: 40 },
    ],
    ...over,
  };
}

const OVERVIEW = 'GET /v1/vendor/analytics/overview';
const SALES = 'GET /v1/vendor/insights/sales';

function salesInsights() {
  return {
    period: PERIOD,
    granularity: 'day',
    summary: {
      grossSales: m(60000, 50000, 20),
      orders: m(30, 25, 20),
      unitsSold: m(42, 40, 5),
      averageOrderValue: m(2000, 2000, 0),
      creatorCommission: m(3000, 2000, 50),
      netAfterCommission: m(57000, 48000, 18.75),
      cancelledOrders: m(2, 4, -50),
      cancelledSales: m(3000, 6000, -50),
      returnRequests: m(3, 2, 50),
      returnedUnits: m(3, 2, 50),
      returnRatePercent: m(7.1, 5, null),
      refundedSales: m(2500, 1500, 66.7),
      productViews: m(1200, 1000, 20),
      addToCarts: m(150, 120, 25),
      viewToOrderPercent: m(2.5, 2.5, 0),
    },
    buyers: { buyers: m(28, 22, 27.3), newBuyers: m(20, 18, 11.1), returningBuyers: m(8, 4, 100), returningPercent: m(28.6, 18.2, null), salesPerBuyer: m(2142.86, 2272.73, -5.7) },
    trend: [
      { start: '2026-10-12', end: '2026-10-12', grossSales: 10000, orders: 5, unitsSold: 6, previousGrossSales: 8000, previousOrders: 4, previousUnitsSold: 5 },
      { start: '2026-10-13', end: '2026-10-13', grossSales: 2000, orders: 1, unitsSold: 1, previousGrossSales: 0, previousOrders: 0, previousUnitsSold: 0 },
    ],
    bySource: [
      { source: 'reel', label: 'Reels', grossSales: 36000, orders: 18, unitsSold: 25, sharePercent: 60, previousGrossSales: 20000, previousOrders: 10, deltaPercent: 80 },
      { source: 'direct', label: 'Search, browse & direct', grossSales: 24000, orders: 12, unitsSold: 17, sharePercent: 40, previousGrossSales: 30000, previousOrders: 15, deltaPercent: -20 },
      { source: 'code', label: 'Codes', grossSales: 0, orders: 0, unitsSold: 0, sharePercent: 0, previousGrossSales: 0, previousOrders: 0, deltaPercent: null },
    ],
    truncated: false,
    notes: ['Revenue counts orders placed in the period, including ones later cancelled.'],
  };
}

describe('Insights layout', () => {
  it('shows the range, the previous period and section links that keep the range', async () => {
    mockApi({ [SALES]: { body: salesInsights() } });
    renderSection('sales', <SalesPage />, '?range=7d');
    expect(await screen.findByTestId('range-caption')).toHaveTextContent(/compared with/);
    const nav = screen.getByRole('navigation', { name: /insights sections/i });
    expect(within(nav).getByRole('link', { name: 'Promotions' })).toHaveAttribute('href', '/insights/promotions?range=7d');
  });

  it('asks the new endpoints for inclusive days', async () => {
    const calls = mockApi({ [SALES]: { body: salesInsights() } });
    renderSection('sales', <SalesPage />, '?from=2026-09-01&to=2026-09-30');
    await screen.findByTestId('sales-kpis');
    const q = new URLSearchParams(calls.find((c) => c.path === '/v1/vendor/insights/sales')!.search);
    expect(q.get('from')).toBe('2026-09-01');
    expect(q.get('to')).toBe('2026-09-30');
  });
});

describe('Sales overview (new insights report)', () => {
  it('renders KPI tiles with deltas, the trend against the previous period, sources and notes', async () => {
    mockApi({ [SALES]: { body: salesInsights() } });
    renderSection('sales', <SalesPage />);
    const kpis = await screen.findByTestId('sales-kpis');
    expect(within(kpis).getByText('Rs 60K')).toBeInTheDocument();
    const deltas = within(kpis).getAllByTestId('delta').map((d) => d.textContent);
    // revenue, net, orders, AOV, units, return rate (+2.1 pts, bad), views→orders, cancelled (-50 %, good)
    expect(deltas).toEqual(['+20%', '+19%', '+20%', '±0%', '+5.0%', '+2.1 pts', '±0%', '-50%']);
    expect(screen.getByText(/including ones later cancelled/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('trend-chart')).toHaveAttribute('data-series', 'current,previous'));
    expect(screen.getByTestId('trend-chart')).toHaveTextContent('2 points');
    const sources = screen.getByTestId('sales-sources');
    expect(within(sources).getByRole('cell', { name: 'Reels' })).toBeInTheDocument();
    expect(within(sources).getByText('+80%')).toBeInTheDocument();
    expect(within(sources).getByTestId('donut-chart')).toHaveTextContent('2 slices');
  });

  it('switches the trend to orders and regroups by week on the server', async () => {
    const calls = mockApi({ [SALES]: { body: salesInsights() } });
    renderSection('sales', <SalesPage />);
    await screen.findByTestId('sales-kpis');
    await userEvent.click(screen.getByRole('radio', { name: 'Orders' }));
    expect(await screen.findByText('Orders over time')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/vendor/insights/sales' && c.search.includes('granularity=week'))).toBe(true));
  });
});

describe('Sales overview (before the new report is live)', () => {
  it('falls back to the analytics overview with deltas against the previous period', async () => {
    const calls = mockApi({ [OVERVIEW]: { body: overview() } });
    renderSection('sales', <SalesPage />);
    const kpis = await screen.findByTestId('sales-kpis');
    expect(within(kpis).getByText('Rs 50K')).toBeInTheDocument();
    expect(within(kpis).getByText('Previous: Rs 40,000')).toBeInTheDocument();
    const deltas = within(kpis).getAllByTestId('delta').map((d) => d.textContent);
    expect(deltas).toEqual(['+25%', '+25%', '+25%', '±0%', '+0.4 pts']);
    await waitFor(() => expect(calls.filter((c) => c.path === '/v1/vendor/analytics/overview')).toHaveLength(2));
    const [a, b] = calls.filter((c) => c.path === '/v1/vendor/analytics/overview').map((c) => new URLSearchParams(c.search));
    expect(new Date(b.get('toUtc')!).getTime()).toBe(new Date(a.get('fromUtc')!).getTime());
    await waitFor(() => expect(screen.getByTestId('trend-chart')).toHaveAttribute('data-series', 'current,previous'));
    expect(screen.getByTestId('trend-chart')).toHaveTextContent('30 points');
    const sources = screen.getByTestId('sales-sources');
    expect(within(sources).getByRole('img', { name: /instagram 60%, tik tok 40%/i })).toBeInTheDocument();
    expect(within(sources).getByRole('cell', { name: 'Instagram' })).toBeInTheDocument();
  });

  it('turning compare off drops the previous-period request and the deltas', async () => {
    const calls = mockApi({ [OVERVIEW]: { body: overview() } });
    renderSection('sales', <SalesPage />, '?range=30d&compare=0');
    await screen.findByTestId('sales-kpis');
    expect(screen.getByTestId('range-caption')).not.toHaveTextContent(/compared with/);
    expect(calls.filter((c) => c.path === '/v1/vendor/analytics/overview')).toHaveLength(1);
    expect(within(screen.getByTestId('sales-kpis')).queryAllByTestId('delta')).toHaveLength(0);
  });

  it('says "could not load" with a retry — never "no sales" — when the overview fails', async () => {
    let fail = true;
    const calls = mockApi({
      [OVERVIEW]: () => (fail ? { status: 500, body: { title: 'Database is busy', status: 500 } } : { body: overview() }),
    });
    renderSection('sales', <SalesPage />);
    const errors = await screen.findAllByTestId('state-error');
    expect(screen.getAllByText('Database is busy').length).toBeGreaterThan(0);
    expect(screen.queryByText(/no sales in this period/i)).not.toBeInTheDocument();
    fail = false;
    const before = calls.length;
    await userEvent.click(within(errors[0]).getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('sales-kpis')).toBeInTheDocument();
    expect(calls.length).toBeGreaterThan(before);
  });

  it('shows empty states only when the server answered with nothing', async () => {
    mockApi({
      [OVERVIEW]: { body: overview({ grossSales: { current: npr(0), previous: npr(0), deltaPercent: null }, revenueTrend: [], trafficSources: [] }) },
    });
    renderSection('sales', <SalesPage />);
    expect(await screen.findByText(/no sales in this period yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no orders came from reels/i)).toBeInTheDocument();
  });

  it('says "coming soon" when neither report is live', async () => {
    mockApi({});
    renderSection('sales', <SalesPage />);
    expect((await screen.findAllByTestId('state-not-yet')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('state-error')).not.toBeInTheDocument();
  });
});

// ================================================================== 2 products

const product = (id: string, name: string, units: number, revenue: number) => ({
  productId: id,
  name,
  thumbnailUrl: null,
  unitsSold: units,
  totalRevenue: npr(revenue),
  distinctCreatorCount: 0,
});

const STORE_ACTIONS = {
  generatedUtc: '2026-10-13T00:00:00Z',
  actions: [
    {
      kind: 1,
      severity: 1,
      productId: 'p-a',
      productVariantId: 'v-1',
      productName: 'Dhaka topi',
      sku: 'TOPI-M',
      recommendation: 'Restock 20 units this week',
      evidence: ['Sold 10 in 7 days', '3 left'],
      valueAtStake: npr(4500),
    },
  ],
};

function legacyProductRoutes(over: Record<string, unknown> = {}) {
  return {
    'GET /v1/vendor/analytics/products': (c: RecordedCall) => ({
      body: {
        window: {},
        items: isCurrent(c)
          ? [product('p-a', 'Dhaka topi', 10, 10000), product('p-b', 'Pashmina shawl', 5, 3000)]
          : [product('p-a', 'Dhaka topi', 5, 5000), product('p-c', 'Felt slippers', 3, 6000)],
      },
    }),
    'GET /v1/vendor/store/actions': { body: STORE_ACTIONS },
    'GET /v1/vendor/store/digital-twin': {
      body: { activeProductCount: 12, outOfStockProductCount: 1, lowStockVariantCount: 3, totalUnitsOnHand: 240, activeFlashSaleCount: 0, unitsSoldLast7Days: 14, generatedUtc: '2026-10-13T00:00:00Z' },
    },
    'GET /v1/vendor/products/p-a/analytics': {
      body: {
        window: {},
        header: { productId: 'p-a', title: 'Dhaka topi', thumbnailUrl: null, inStockUnits: 3, isActive: true },
        revenue: { current: npr(10000), previous: npr(5000), deltaPercent: 100 },
        unitsSold: { current: 10, previous: 5, deltaPercent: 100 },
        revenueTrend: [{ date: '2026-10-02', amount: npr(10000) }],
        topCreators: [],
        locations: [{ region: 'Kathmandu', orderCount: 7, revenue: npr(7000) }],
        reviews: { reviewCount: 4, averageRating: 4.5, starDistribution: { '5': 2, '4': 2 } },
      },
    },
    ...over,
  };
}

function productInsight(over: Record<string, unknown>) {
  return {
    productId: 'p-a',
    name: 'Dhaka topi',
    thumbnailUrl: null,
    state: 2,
    categoryId: 'cat-1',
    categoryName: 'Hats',
    productViews: 400,
    addToCarts: 40,
    orders: 10,
    unitsSold: 10,
    grossSales: 10000,
    previousUnitsSold: 5,
    previousGrossSales: 5000,
    salesDeltaPercent: 100,
    momentum: 'rising',
    viewToCartPercent: 10,
    cartToOrderPercent: 25,
    viewToOrderPercent: 2.5,
    returnedUnits: 1,
    returnRatePercent: 10,
    averageRating: 4.5,
    reviewCount: 4,
    stockOnHand: 3,
    averageDailyUnits: 0.33,
    daysOfCover: 9.1,
    stockStatus: 'critical',
    ...over,
  };
}

function productsInsights() {
  return {
    period: PERIOD,
    funnel: {
      productViews: m(1200, 1000, 20),
      addToCarts: m(150, 120, 25),
      orders: m(30, 25, 20),
      unitsSold: m(42, 40, 5),
      grossSales: m(60000, 50000, 20),
      viewToCartPercent: m(12.5, 12, null),
      cartToOrderPercent: m(20, 20.8, null),
      viewToOrderPercent: m(2.5, 2.5, null),
    },
    stock: { outOfStock: 1, critical: 1, low: 0, healthy: 5, noRecentSales: 2, untracked: 0 },
    items: [
      productInsight({}),
      productInsight({
        productId: 'p-b',
        name: 'Pashmina shawl',
        unitsSold: 0,
        grossSales: 0,
        previousGrossSales: 6000,
        salesDeltaPercent: -100,
        momentum: 'falling',
        returnedUnits: 0,
        returnRatePercent: null,
        stockOnHand: 0,
        daysOfCover: null,
        stockStatus: 'out_of_stock',
        productViews: 50,
        viewToOrderPercent: 0,
      }),
    ],
    page: 1,
    pageSize: 100,
    totalCount: 140,
    hasMore: true,
    truncated: false,
    notes: ['Views come from the product-view beacon, counted from 2026-10-13 onward.'],
  };
}

describe('Products', () => {
  it('joins the two periods: rising, falling and new products', () => {
    const rows = productRowsFromTop([product('a', 'A', 10, 10000), product('b', 'B', 5, 3000), product('s', 'S', 1, 1050)], [
      product('a', 'A', 5, 5000),
      product('c', 'C', 3, 6000),
      product('s', 'S', 1, 1000),
    ]);
    expect(rows.find((r) => r.productId === 'a')).toMatchObject({ prevRevenue: 5000, changePercent: 100, momentum: 'rising' });
    expect(rows.find((r) => r.productId === 'b')).toMatchObject({ prevRevenue: 0, changePercent: null, momentum: 'new' });
    expect(rows.find((r) => r.productId === 'c')).toMatchObject({ revenue: 0, changePercent: -100, momentum: 'falling' });
    expect(rows.find((r) => r.productId === 's')!.momentum).toBe('steady');
    const { rising, falling } = risingFalling(rows);
    expect(rising.map((r) => r.productId)).toEqual(['a', 'b']);
    expect(falling.map((r) => r.productId)).toEqual(['c']);
    expect(productRowsFromTop([product('a', 'A', 1, 100)], null)[0].changePercent).toBeNull();
  });

  it('shows the funnel, conversion, stock cover and returns from the new report', async () => {
    mockApi({
      'GET /v1/vendor/insights/products': { body: productsInsights() },
      'GET /v1/vendor/store/actions': { body: STORE_ACTIONS },
      'GET /v1/vendor/products/p-a/analytics': legacyProductRoutes()['GET /v1/vendor/products/p-a/analytics'],
    });
    renderSection('products', <ProductsPage />);
    const funnel = await screen.findByTestId('product-funnel');
    expect(await within(funnel).findByText('1,200')).toBeInTheDocument();
    expect(within(funnel).getByText(/12.5% of views/)).toBeInTheDocument();
    expect(within(funnel).getByText(/product-view beacon/)).toBeInTheDocument();
    const best = screen.getByTestId('best-sellers');
    expect(within(best).getByRole('columnheader', { name: /conversion/i })).toBeInTheDocument();
    expect(within(best).getByText('2.5%')).toBeInTheDocument();
    expect(within(best).getByText(/top 2 of 140/)).toBeInTheDocument();
    const cover = screen.getByTestId('stock-cover');
    expect(within(cover).getByText('9.1')).toBeInTheDocument();
    expect(within(cover).getByText('Runs out within days')).toBeInTheDocument();
    expect(within(cover).getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('returns')).getByText('10.0%')).toBeInTheDocument();
    const moves = screen.getByTestId('rising-falling');
    expect(within(moves).getByText('Pashmina shawl')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-today')).not.toBeInTheDocument();
  });

  it('falls back to best sellers, rising/falling, stock today and a drill-down from older endpoints', async () => {
    mockApi(legacyProductRoutes());
    renderSection('products', <ProductsPage />);
    const best = await screen.findByTestId('best-sellers');
    await waitFor(() => expect(within(best).getByText('Pashmina shawl')).toBeInTheDocument());
    expect(within(best).getByText('+100%')).toBeInTheDocument();
    expect(within(best).getByText('new')).toBeInTheDocument();
    expect(within(screen.getByTestId('rising-falling')).getByText('Felt slippers')).toBeInTheDocument();
    expect(within(screen.getByTestId('product-funnel')).getByTestId('state-not-yet')).toBeInTheDocument();
    const risk = await screen.findByTestId('stock-risk');
    expect(await within(risk).findByText('Restock soon')).toBeInTheDocument();
    expect(within(risk).getByText('Rs 4,500')).toBeInTheDocument();
    expect(await within(await screen.findByTestId('stock-today')).findByText('240')).toBeInTheDocument();
    const deep = await screen.findByTestId('product-deep-dive');
    expect(await within(deep).findByText('Kathmandu')).toBeInTheDocument();
    expect(within(deep).getByText('4.5')).toBeInTheDocument();
  });

  it('sorts a table by a column header', async () => {
    mockApi(legacyProductRoutes());
    renderSection('products', <ProductsPage />, '?range=30d&compare=0');
    const best = await screen.findByTestId('best-sellers');
    await waitFor(() => expect(within(best).getByText('Pashmina shawl')).toBeInTheDocument());
    const names = () => within(best).getAllByRole('link').map((a) => a.textContent);
    expect(names()).toEqual(['Dhaka topi', 'Pashmina shawl']);
    await userEvent.click(within(best).getByRole('button', { name: /revenue/i }));
    expect(names()).toEqual(['Pashmina shawl', 'Dhaka topi']);
    expect(within(best).getByRole('columnheader', { name: /revenue/i })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('exports the table as CSV', async () => {
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:1';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockApi(legacyProductRoutes());
    renderSection('products', <ProductsPage />);
    const best = await screen.findByTestId('best-sellers');
    await waitFor(() => expect(within(best).getByText('Pashmina shawl')).toBeInTheDocument());
    await userEvent.click(within(best).getByRole('button', { name: /export csv/i }));
    expect(blob).not.toBeNull();
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blob!);
    });
    const lines = text.slice(text.charCodeAt(0) === 0xfeff ? 1 : 0).trim().split('\r\n');
    expect(lines[0]).toBe('Product,Units,Revenue,Previous,Change');
    expect(lines[1]).toBe('Dhaka topi,10,10000,5000,100');
    expect(lines[2]).toBe('Pashmina shawl,5,3000,0,');
  });

  it('turns tables into cards on a phone', async () => {
    setPhone(true);
    mockApi(legacyProductRoutes());
    renderSection('products', <ProductsPage />, '?range=30d&compare=0');
    const best = await screen.findByTestId('best-sellers');
    const cards = await within(best).findByTestId('insights-cards');
    expect(within(cards).getByText('Dhaka topi')).toBeInTheDocument();
    expect(within(best).queryByTestId('insights-table')).not.toBeInTheDocument();
  });

  it('keeps each widget independent: a failing stock list does not hide best sellers', async () => {
    mockApi(legacyProductRoutes({ 'GET /v1/vendor/store/actions': { status: 500, body: { title: 'Stock service down' } } }));
    renderSection('products', <ProductsPage />);
    const risk = await screen.findByTestId('stock-risk');
    expect(await within(risk).findByText('Stock service down')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('best-sellers')).getByText('Dhaka topi')).toBeInTheDocument());
  });
});

// ================================================================== 3 demand

const BOARD = {
  generatedUtc: '2026-10-13T00:00:00Z',
  windowDays: 30,
  governance: '',
  channels: [
    { channel: 1, signalCount: 300, knownShopperCount: 100, totalWeight: 1, totalAmount: null, currency: null },
    { channel: 4, signalCount: 12, knownShopperCount: 12, totalWeight: 1, totalAmount: 24000, currency: 'NPR' },
  ],
  opportunities: [
    { subject: 'pashmina', searches: 80, unmetSearches: 10, cartActions: 20, purchases: 6, purchaseConversionPercent: 7.5, distinctShoppers: 30, recommendation: 'Stock more colours' },
  ],
  minimumCohortSize: 5,
  reportableSubjects: 1,
  withheldSubjects: 3,
  anonymousSignals: 0,
};

describe('Demand', () => {
  it('shows StyleMint-wide searches before the vendor-matched report is live — never a buyer phone number', async () => {
    const calls = mockApi({
      'GET /api/v1/vendor/demand-signals': {
        body: {
          windowDays: 30,
          generatedUtc: '2026-10-13T00:00:00Z',
          topSearches: [
            { query: 'dhaka topi', count: 120 },
            { query: 'call me 9812345678', count: 9 },
          ],
          unmetSearches: [],
        },
      },
      'GET /api/v1/vendor/unmet-demand': {
        body: {
          generatedUtc: '2026-10-13T00:00:00Z',
          window: { days: 30, observedRequests: 400, unmetRequests: 40, minimumCohortSize: 5, reportableQueries: 1, withheldQueries: 6 },
          channels: [],
          unmet: [
            {
              query: 'yak wool socks',
              foldedVariants: [],
              observations: 25,
              distinctShoppers: 11,
              shareOfObservedRequestsPercent: 6.25,
              reasons: [{ reason: 'NoResults', observations: 25 }],
              observedOnDays: 8,
              firstObservedUtc: '2026-09-20T00:00:00Z',
              lastObservedUtc: '2026-10-12T00:00:00Z',
            },
          ],
          basis: '',
          governance: '',
        },
      },
      'GET /api/v1/vendor/intent-decision-board': { body: BOARD },
      'GET /v1/vendor/pricing/suggestions': { body: [] },
    });
    renderSection('demand', <DemandPage />, '?range=90d');
    const top = await screen.findByTestId('top-searches');
    expect(await within(top).findByText('dhaka topi')).toBeInTheDocument();
    expect(within(top).getByText('call me [phone hidden]')).toBeInTheDocument();
    expect(screen.queryByText(/9812345678/)).not.toBeInTheDocument();
    expect(screen.getByTestId('demand-basis')).toHaveTextContent(/across all of StyleMint/);
    expect(within(screen.getByTestId('unmet-demand')).getByText('yak wool socks')).toBeInTheDocument();
    expect(within(screen.getByTestId('unmet-demand')).getByText(/6 rarer terms withheld/)).toBeInTheDocument();
    expect(within(screen.getByTestId('demand-kpis')).getByText('10.0%')).toBeInTheDocument();
    expect(within(screen.getByTestId('demand-categories')).getByTestId('state-not-yet')).toBeInTheDocument();
    expect(await within(screen.getByTestId('intent-board')).findByText('Stock more colours')).toBeInTheDocument();
    expect(within(screen.getByTestId('price-sensitivity')).getByText(/no price suggestions/i)).toBeInTheDocument();
    // Discovery's windows: 30 days at most for signals / unmet, 90 for the board.
    expect(new URLSearchParams(calls.find((c) => c.path.endsWith('/demand-signals'))!.search).get('days')).toBe('30');
    expect(new URLSearchParams(calls.find((c) => c.path.endsWith('/intent-decision-board'))!.search).get('days')).toBe('90');
  });

  it('shows demand matched to the seller: categories, searches, unmet, trending attributes and ideas', async () => {
    const q = (query: string, searches: number, unmet: number, prev: number) => ({
      query,
      searches,
      unmetSearches: unmet,
      previousSearches: prev,
      deltaPercent: prev ? ((searches - prev) / prev) * 100 : null,
      matchedOn: 'category',
      categoryId: 'cat-1',
      categoryName: 'Hats',
      yourMatchingProducts: 3,
    });
    mockApi({
      'GET /v1/vendor/insights/demand': {
        body: {
          period: PERIOD,
          previousComplete: true,
          relevantSearches: m(500, 400, 25),
          unmetRelevantSearches: m(50, 40, 25),
          categories: [{ categoryId: 'cat-1', name: 'Hats', yourProducts: 3, yourUnitsSold: 12, searches: 300, unmetSearches: 20, previousSearches: 200, deltaPercent: 50 }],
          searches: [q('dhaka topi', 120, 0, 100)],
          unmetSearches: [q('felt hat kids', 30, 30, 0)],
          trendingAttributes: [{ kind: 'colour', value: 'maroon', searches: 40, previousSearches: 20, deltaPercent: 100 }],
          suggestions: ['Add a kids size of the felt hat'],
          basis: '',
          notes: [],
        },
      },
      'GET /api/v1/vendor/intent-decision-board': { body: BOARD },
      'GET /v1/vendor/pricing/suggestions': { body: [] },
    });
    renderSection('demand', <DemandPage />);
    const kpis = await screen.findByTestId('demand-kpis');
    expect(await within(kpis).findByText('500')).toBeInTheDocument();
    expect(within(kpis).getAllByText('+25%')).toHaveLength(2);
    expect(screen.getByTestId('demand-basis')).toHaveTextContent(/match your categories/);
    expect(within(screen.getByTestId('demand-categories')).getByText('+50%')).toBeInTheDocument();
    expect(within(screen.getByTestId('top-searches')).getByText('dhaka topi')).toBeInTheDocument();
    expect(within(screen.getByTestId('unmet-demand')).getByText('felt hat kids')).toBeInTheDocument();
    expect(within(screen.getByTestId('demand-attributes')).getByText(/maroon/)).toBeInTheDocument();
    expect(screen.getByText('Add a kids size of the felt hat')).toBeInTheDocument();
  });
});

// ================================================================== 4 reels

const PARTNERSHIPS = {
  items: [
    {
      id: 'pa-1',
      creatorProfileId: 'cp-1',
      creatorAccountId: 'cr-1',
      creatorName: 'Asha Rai',
      creatorHandle: 'asha.styles',
      creatorLogoUrl: null,
      state: 3,
      commissionMinPercent: 8,
      commissionMaxPercent: 12,
      invitedUtc: '2026-09-01T00:00:00Z',
      respondedUtc: '2026-09-02T00:00:00Z',
      endedUtc: null,
      initiatedByCreator: false,
    },
  ],
  totalCount: 1,
  nextCursor: null,
  previousCursor: null,
  pageSize: 100,
  hasMore: false,
};

const APPROVALS = [
  { id: 'r-2', reelId: 'reel-2', creatorAccountId: 'cr-2', partnershipId: 'pa-2', round: 1, state: 1, creatorNote: null, submittedUtc: '2026-10-12T00:00:00Z', decidedUtc: null, rejectionReason: null, expiredUtc: null },
  { id: 'r-1', reelId: 'reel-1', creatorAccountId: 'cr-1', partnershipId: 'pa-1', round: 2, state: 1, creatorNote: 'Second take', submittedUtc: '2026-10-10T00:00:00Z', decidedUtc: null, rejectionReason: null, expiredUtc: null },
];

describe('Reels performance', () => {
  it('lists reels waiting for approval with the creator name, oldest first; per-reel results are "coming soon"', async () => {
    mockApi({ 'GET /v1/vendor/reel-approvals': { body: APPROVALS }, 'GET /v1/vendor/partnerships': { body: PARTNERSHIPS } });
    renderSection('reels', <ReelsPage />);
    const box = await screen.findByTestId('reel-approvals');
    expect(await within(box).findByText('2 waiting')).toBeInTheDocument();
    await waitFor(() => expect(within(box).getByText('Asha Rai (@asha.styles)')).toBeInTheDocument());
    const rows = within(box).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Asha Rai');
    expect(rows[1]).toHaveTextContent('Creator cr-2');
    expect(within(screen.getByTestId('reel-table')).getByTestId('state-not-yet')).toBeInTheDocument();
  });

  it('shows every reel with views, engagement and sales, and filters to creators', async () => {
    const reel = (id: string, own: boolean, sales: number) => ({
      reelId: id,
      creatorAccountId: own ? 'vendor' : 'cr-1',
      isOwnReel: own,
      caption: own ? 'Our new topi drop' : 'Asha styles the shawl',
      thumbnailUrl: null,
      sourcePlatform: 1,
      state: 3,
      publishedAtUtc: '2026-10-01T00:00:00Z',
      durationSeconds: 20,
      taggedProductIds: ['p-a'],
      views: 5000,
      completedViews: 2000,
      completionRatePercent: 40,
      likes: 300,
      saves: 40,
      shares: 12,
      productTaps: null,
      productDetailViews: 200,
      addToCarts: 30,
      orders: 6,
      unitsSold: 7,
      grossSales: sales,
      creatorCommission: 0,
      salesPerThousandViews: sales / 5,
      latestApprovalState: null,
    });
    const calls = mockApi({
      'GET /v1/vendor/insights/reels': (c) => ({
        body: {
          period: PERIOD,
          totals: {
            reels: 2,
            views: m(10000, 8000, 25),
            completedViews: m(4000, 3000, 33),
            completionRatePercent: m(40, 37.5, null),
            likes: m(600, 500, 20),
            saves: m(80, 60, 33),
            shares: m(24, 20, 20),
            productDetailViews: m(400, 300, 33),
            addToCarts: m(60, 50, 20),
            orders: m(12, 10, 20),
            unitsSold: m(14, 12, 16),
            grossSales: m(14000, 10000, 40),
            creatorCommission: m(1200, 1000, 20),
          },
          approvals: { pending: 0, approvedInPeriod: 3, rejectedInPeriod: 1 },
          items: new URLSearchParams(c.search).get('filter') === 'creators' ? [reel('b', false, 6000)] : [reel('a', true, 8000), reel('b', false, 6000)],
          byProduct: [{ productId: 'p-a', productName: 'Dhaka topi', reels: 2, addToCarts: 60, orders: 12, unitsSold: 14, grossSales: 14000 }],
          page: 1,
          pageSize: 100,
          totalCount: 2,
          hasMore: false,
          notes: ['Product-tag taps are not recorded yet.'],
        },
      }),
      'GET /v1/vendor/reel-approvals': { body: [] },
      'GET /v1/vendor/partnerships': { body: PARTNERSHIPS },
    });
    renderSection('reels', <ReelsPage />);
    const kpis = await screen.findByTestId('reel-kpis');
    expect(await within(kpis).findByText('10,000')).toBeInTheDocument();
    expect(within(kpis).getByText('+2.5 pts')).toBeInTheDocument();
    expect(within(kpis).getByText(/not recorded yet/)).toBeInTheDocument();
    const table = screen.getByTestId('reel-table');
    expect(within(table).getByText('Our new topi drop')).toBeInTheDocument();
    expect(within(table).getByText('Rs 8,000')).toBeInTheDocument();
    expect(within(screen.getByTestId('reel-products')).getByText('Dhaka topi')).toBeInTheDocument();
    expect(within(screen.getByTestId('reel-approvals')).getByText(/3 approved · 1 sent back/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Creators' }));
    await waitFor(() => expect(within(screen.getByTestId('reel-table')).queryByText('Our new topi drop')).not.toBeInTheDocument());
    expect(calls.some((c) => c.path === '/v1/vendor/insights/reels' && c.search.includes('filter=creators'))).toBe(true);
  });
});

// ================================================================== 5 creators

describe('Creators & reach', () => {
  const creator = (id: string, revenue: number, commission: number) => ({
    creatorAccountId: id,
    unitsSold: 4,
    attributedRevenue: npr(revenue),
    commissionPaid: npr(commission),
    distinctReelCount: 2,
  });
  const legacy = (names: unknown[]) => ({
    'GET /v1/vendor/analytics/creators': (c: RecordedCall) => ({
      body: { window: {}, items: isCurrent(c) ? [creator('cr-1', 20000, 2000)] : [creator('cr-1', 10000, 1000)] },
    }),
    'GET /v1/vendor/creator-performance': { body: names },
    'GET /v1/vendor/dashboard': { body: { topCreatorsByAttributedSales: [] } },
    'GET /v1/vendor/partnerships': { body: PARTNERSHIPS },
  });

  it('falls back to sales, commission, return on commission and change per creator', async () => {
    mockApi(
      legacy([
        { creatorAccountId: 'cr-1', unitsSold: 4, attributedRevenue: 20000, commissionPaid: 2000, currency: 'NPR', distinctReelCount: 2, creatorHandle: 'asha.styles', creatorDisplayName: 'Asha Rai', creatorAvatarUrl: null },
      ]),
    );
    renderSection('creators', <CreatorsPage />);
    const table = await screen.findByTestId('creator-table');
    await waitFor(() => expect(within(table).getByText('Asha Rai (@asha.styles)')).toBeInTheDocument());
    expect(within(table).getByText('10.0×')).toBeInTheDocument();
    expect(within(table).getByText('+100%')).toBeInTheDocument();
    expect(within(screen.getByTestId('creator-kpis')).getByText('Rs 20K')).toBeInTheDocument();
    expect(within(screen.getByTestId('partnerships')).getByText('8–12%')).toBeInTheDocument();
  });

  it('still shows the numbers to a team member who gets no names', async () => {
    mockApi(legacy([]));
    renderSection('creators', <CreatorsPage />, '?range=30d&compare=0');
    const table = await screen.findByTestId('creator-table');
    expect(await within(table).findByText('Creator cr-1')).toBeInTheDocument();
    expect(within(table).getByText('Rs 20,000')).toBeInTheDocument();
  });

  it('shows reach, engagement and clicks per creator from the new report', async () => {
    mockApi({
      'GET /v1/vendor/insights/creators': {
        body: {
          period: PERIOD,
          totals: {
            creators: 1,
            views: m(9000, 6000, 50),
            engagements: m(700, 500, 40),
            affiliateClicks: m(120, 100, 20),
            addToCarts: m(40, 30, 33),
            orders: m(9, 6, 50),
            grossSales: m(18000, 12000, 50),
            commission: m(1800, 1200, 50),
            returnOnCommission: m(10, 10, 0),
          },
          items: [
            {
              creatorAccountId: 'cr-1',
              displayName: 'Asha Rai',
              handle: 'asha.styles',
              avatarUrl: null,
              reels: 3,
              views: 9000,
              completedViews: 3000,
              engagements: 700,
              productDetailViews: 300,
              addToCarts: 40,
              affiliateClicks: 120,
              orders: 9,
              unitsSold: 10,
              grossSales: 18000,
              previousGrossSales: 12000,
              salesDeltaPercent: 50,
              commission: 1800,
              returnOnCommission: 10,
              salesPerThousandViews: 2000,
            },
          ],
          page: 1,
          pageSize: 100,
          totalCount: 1,
          hasMore: false,
          notes: [],
        },
      },
      'GET /v1/vendor/partnerships': { body: PARTNERSHIPS },
    });
    renderSection('creators', <CreatorsPage />);
    const kpis = await screen.findByTestId('creator-kpis');
    expect(await within(kpis).findByText('9,000')).toBeInTheDocument();
    expect(within(kpis).getByText('Link clicks')).toBeInTheDocument();
    const table = screen.getByTestId('creator-table');
    expect(within(table).getByRole('columnheader', { name: /reach/i })).toBeInTheDocument();
    expect(within(table).getByText('120')).toBeInTheDocument();
    expect(within(table).getByText('+50%')).toBeInTheDocument();
  });
});

// ================================================================== 6 promotions

describe('Promotions', () => {
  it('falls back to the seller’s own flash sales with the measured lift, sponsored, campaigns and EMI', async () => {
    mockApi({
      'GET /v1/vendor/pricing/flash-sales': {
        body: [
          { flashSaleId: 'f-1', productId: 'p-a', productName: 'Dhaka topi', originalPrice: 1000, salePrice: 800, currency: 'NPR', startUtc: '2026-10-10T00:00:00Z', endUtc: '2026-10-15T00:00:00Z', maxUnits: 50, unitsSold: 0, isActive: true },
          { flashSaleId: 'f-x', productId: 'other', productName: 'Someone else’s jacket', originalPrice: 5000, salePrice: 4000, currency: 'NPR', startUtc: '2026-10-10T00:00:00Z', endUtc: '2026-10-15T00:00:00Z', maxUnits: 5, unitsSold: 0, isActive: true },
        ],
      },
      'GET /v1/vendor/products': { body: { items: [{ id: 'p-a' }], totalCount: 1, hasMore: false } },
      'GET /v1/vendor/pricing/flash-sales/f-1/incrementality': { body: { flashSaleId: 'f-1', baselineDailyUnits: 2, promoDailyUnits: 2.5, liftPercent: 0.25, verdict: 'Lift' } },
      'GET /v1/vendor/store/sponsored': {
        body: [
          { id: 's-1', productId: 'p-a', productName: 'Dhaka topi', state: 1, isLive: true, dailyImpressionCap: 500, endsUtc: null, impressionsToday: 120, impressionsLast7Days: 2100, unitsSoldLast7Days: 6, unitsSoldPrevious7Days: 4, disclosure: '', salesComparisonNote: '', createdUtc: '', updatedUtc: '' },
        ],
      },
      'GET /v1/vendor/campaign-workspaces': { body: [] },
      'GET /v1/vendor/emi/products': { body: [{ productId: 'p-a', productName: 'Dhaka topi', enabled: true, tenures: [3, 6], minDownPaymentPercent: 20, eligibleVariantCount: 2 }] },
    });
    renderSection('promotions', <PromotionsPage />);
    const flash = await screen.findByTestId('flash-sales');
    await waitFor(() => expect(within(flash).getByText('Dhaka topi')).toBeInTheDocument());
    expect(within(flash).queryByText(/someone else/i)).not.toBeInTheDocument();
    expect(within(flash).getByText('20%')).toBeInTheDocument();
    expect(await within(flash).findByText('+25%')).toBeInTheDocument();
    const sponsored = screen.getByTestId('sponsored');
    expect(within(sponsored).getByText('2,100')).toBeInTheDocument();
    expect(within(sponsored).getByText('+50%')).toBeInTheDocument();
    expect(within(screen.getByTestId('campaigns')).getByText(/no campaigns yet/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('emi')).getByText('3, 6')).toBeInTheDocument();
  });

  it('shows uplift against the baseline, codes, payment plans and what is not measured, from the new report', async () => {
    const win = (units: number, perDay: number, sales: number) => ({ fromUtc: '', toUtc: '', days: 5, unitsSold: units, orders: units, grossSales: sales, unitsPerDay: perDay, salesPerDay: sales / 5 });
    mockApi({
      'GET /v1/vendor/insights/promotions': {
        body: {
          period: PERIOD,
          flashSales: [
            {
              flashSaleId: 'f-1',
              productId: 'p-a',
              productName: 'Dhaka topi',
              originalPrice: 1000,
              salePrice: 800,
              discountPercent: 20,
              startUtc: '2026-10-01T00:00:00Z',
              endUtc: '2026-10-06T00:00:00Z',
              status: 'ended',
              maxUnits: 50,
              sale: win(15, 3, 12000),
              baseline: win(10, 2, 10000),
              unitsUpliftPercent: 50,
              salesUpliftPercent: 20,
              discountCost: 3000,
            },
          ],
          sponsored: [],
          codes: [{ code: 'SM-AB12', kind: 'Store', status: 'Active', label: 'Counter QR', productId: null, storeId: 's-1', scans: 80, uniqueScanners: 60, orders: 4, unitsSold: 5, grossSales: 5000, scanToOrderPercent: 5 }],
          campaigns: [{ workspaceId: 'w-1', name: 'Dashain', state: 6, budgetAmount: 20000, spentAmount: 15000, currency: 'NPR', activatedUtc: null, completedUtc: null, measured: false, incrementalLiftPercent: null, primaryMetric: null }],
          paymentPlans: {
            applications: m(10, 5, 100),
            approved: m(8, 4, 100),
            declined: m(2, 1, 100),
            planSales: m(40000, 20000, 100),
            financed: m(30000, 15000, 100),
            approvalRatePercent: m(80, 80, 0),
            shareOfOrdersPercent: m(12, 8, 50),
            byKind: [{ kind: 1, label: 'Instalments', applications: 10, approved: 8, declined: 2, planSales: 40000, financed: 30000 }],
          },
          unavailable: ['Cart offers and promo codes are StyleMint-wide and have no per-seller results.'],
          notes: [],
        },
      },
    });
    renderSection('promotions', <PromotionsPage />);
    const flash = await screen.findByTestId('flash-sales');
    expect(within(flash).getByText('3.0 vs 2.0')).toBeInTheDocument();
    expect(within(flash).getByText('+50%')).toBeInTheDocument();
    expect(within(flash).getByText('Ended')).toBeInTheDocument();
    expect(within(screen.getByTestId('codes')).getByText('Counter QR')).toBeInTheDocument();
    const plans = screen.getByTestId('payment-plans');
    expect(within(plans).getByText('Instalments')).toBeInTheDocument();
    expect(within(plans).getByText('+4.0 pts')).toBeInTheDocument();
    expect(within(screen.getByTestId('campaigns')).getByText('not measured')).toBeInTheDocument();
    expect(screen.getByTestId('promo-unavailable')).toHaveTextContent(/Cart offers/);
    expect(within(screen.getByTestId('sponsored')).getByText(/not sponsoring/i)).toBeInTheDocument();
  });
});

// ================================================================== 7 customers

describe('Customers', () => {
  const crmRoutes = (role = 'Owner', areas?: string[]) => ({
    [SESSION]: { body: { ...sessionBody(role), ...(areas ? { areas } : {}) } },
    [`GET ${CRM}/seller/customers`]: (c: RecordedCall) => {
      const q = new URLSearchParams(c.search);
      if (q.get('minOrders') === '2') return pagedEnvelope([sellerCustomer()], { total: 30, pageSize: 1 });
      if (q.get('consent') === 'push') return pagedEnvelope([sellerCustomer()], { total: 45, pageSize: 1 });
      if (q.get('sort') === 'ltv') return pagedEnvelope([sellerCustomer()], { total: 120, pageSize: 25 });
      return pagedEnvelope([sellerCustomer()], { total: 120, pageSize: 1 });
    },
  });

  it('shows buyers, repeat rate and top buyers without phone or email, with CRM links', async () => {
    mockApi(crmRoutes());
    renderSection('customers', <CustomersPage />);
    const kpis = await screen.findByTestId('customer-kpis');
    await waitFor(() => expect(within(kpis).getByText('25.0%')).toBeInTheDocument());
    expect(within(kpis).getByText('120')).toBeInTheDocument();
    const top = await screen.findByTestId('top-customers');
    expect(await within(top).findByText('Sita Sharma')).toBeInTheDocument();
    expect(screen.queryByText(/sita\.sharma@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/9812345678/)).not.toBeInTheDocument();
    expect(within(screen.getByTestId('crm-links')).getByRole('link', { name: 'Segments' })).toHaveAttribute('href', '/crm/segments');
    expect(within(screen.getByTestId('buyer-mix')).getByTestId('state-not-yet')).toBeInTheDocument();
  });

  it('shows new and returning buyers from the new sales report', async () => {
    mockApi({ ...crmRoutes(), [SALES]: { body: salesInsights() } });
    renderSection('customers', <CustomersPage />);
    const mix = await screen.findByTestId('buyer-mix');
    expect(await within(mix).findByText('Returning buyers')).toBeInTheDocument();
    expect(within(mix).getByText('+100%')).toBeInTheDocument();
    expect(within(mix).getByText('28.6%')).toBeInTheDocument();
    expect(within(mix).getByText('+10.4 pts')).toBeInTheDocument();
  });

  it('offers only the CRM areas the seller’s session allows', async () => {
    mockApi(crmRoutes('Agent', ['customers', 'tasks']));
    renderSection('customers', <CustomersPage />);
    const links = await screen.findByTestId('crm-links');
    await waitFor(() => expect(within(links).getAllByRole('link')).toHaveLength(2));
    expect(within(links).queryByRole('link', { name: 'Segments' })).not.toBeInTheDocument();
  });

  it('explains when the account cannot see customers', async () => {
    mockApi({ [SESSION]: { status: 403, body: { title: 'Forbidden' } } });
    renderSection('customers', <CustomersPage />);
    expect(await screen.findByTestId('crm-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('customer-kpis')).not.toBeInTheDocument();
  });

  it('says the CRM is being set up when it does not exist yet', async () => {
    mockApi({});
    renderSection('customers', <CustomersPage />);
    expect(await screen.findByTestId('crm-setting-up')).toBeInTheDocument();
  });
});
