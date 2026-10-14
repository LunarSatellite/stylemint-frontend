import { Alert, Anchor, Badge, Grid, List, Loader, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDate, formatDateTime, formatMoney, formatNumber, humanize } from '../../lib/format';
import { campaignStateColor, campaignStateLabel, INSIGHTS_KEY, insightsApi, type FlashSale, type FlashSaleLift } from './api';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { DataTable, DeltaBadge, formatPercent, KpiGrid, MetricTile, Notes, rangeKey, useRange, Widget } from './components';
import { newInsightsApi, preferInsights, type Metric, type PromotionInsights } from './contracts';
import type { KpiSpec } from './model';
import { deltaPercent, pointDelta, ratio } from './period';

/** The older flash-sale list is StyleMint-wide; keep the seller's own. */
export function ownFlashSales(all: FlashSale[], own: Set<string>): FlashSale[] {
  return all.filter((s) => own.has(s.productId));
}

export function discountPercent(s: Pick<FlashSale, 'originalPrice' | 'salePrice'>): number | null {
  const r = ratio(s.originalPrice - s.salePrice, s.originalPrice);
  return r === null ? null : r * 100;
}

const flashStatusColor: Record<string, string> = { live: 'forest', scheduled: 'blue', ended: 'gray', stopped: 'gray' };

function ProductLink({ id, name }: { id: string; name: string | null }) {
  return (
    <Anchor component={Link} to={`/products/${id}`} size="sm">
      {name ?? 'Product'}
    </Anchor>
  );
}

export function paymentPlanKpis(p: PromotionInsights['paymentPlans']): KpiSpec[] {
  const count = (key: string, label: string, m: Metric, extra: Partial<KpiSpec> = {}): KpiSpec => ({
    key,
    label,
    value: formatNumber(m.current),
    previous: formatNumber(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
    ...extra,
  });
  const rate = (key: string, label: string, m: Metric<number | null>): KpiSpec => ({
    key,
    label,
    value: formatPercent(m.current),
    previous: formatPercent(m.previous),
    delta: pointDelta(m.current, m.previous),
    unit: 'points',
  });
  return [
    count('applications', 'Applications', p.applications),
    rate('approval', 'Approved', p.approvalRatePercent),
    {
      key: 'sales',
      label: 'Sales on plans',
      value: formatMoney(p.planSales.current),
      previous: formatMoney(p.planSales.previous),
      delta: deltaPercent(p.planSales.current, p.planSales.previous),
      unit: 'percent',
      isNew: p.planSales.previous === 0 && p.planSales.current > 0,
    },
    rate('share', 'Share of orders', p.shareOfOrdersPercent),
  ];
}

function upliftBadge(v: number | null) {
  return <DeltaBadge value={v} />;
}

// ------------------------------------------------------------------ new report

function InsightsPromotions({ d, compare }: { d: PromotionInsights; compare: boolean }) {
  const live = d.flashSales.filter((f) => f.status === 'live').length;
  const scans = d.codes.reduce((s, c) => s + c.scans, 0);
  const codeOrders = d.codes.reduce((s, c) => s + c.orders, 0);
  const sponsoredSales = d.sponsored.reduce((s, x) => s + x.grossSales, 0);
  const sponsoredPrev = d.sponsored.reduce((s, x) => s + x.previousGrossSales, 0);
  const summary: KpiSpec[] = [
    { key: 'flash', label: 'Flash sales', value: formatNumber(d.flashSales.length), delta: null, unit: 'percent', hint: `${live} live now` },
    {
      key: 'sponsored',
      label: 'Sponsored sales',
      value: formatMoney(sponsoredSales),
      previous: formatMoney(sponsoredPrev),
      delta: deltaPercent(sponsoredSales, sponsoredPrev),
      unit: 'percent',
      isNew: sponsoredPrev === 0 && sponsoredSales > 0,
    },
    { key: 'scans', label: 'Code scans', value: formatNumber(scans), delta: null, unit: 'percent', hint: `${formatNumber(codeOrders)} orders after a scan` },
    {
      key: 'plans',
      label: 'Payment plans',
      value: formatNumber(d.paymentPlans.applications.current),
      previous: formatNumber(d.paymentPlans.applications.previous),
      delta: deltaPercent(d.paymentPlans.applications.current, d.paymentPlans.applications.previous),
      unit: 'percent',
      hint: 'applications',
    },
  ];
  return (
    <Stack gap="md">
      <KpiGrid specs={summary} compare={compare} testId="promo-kpis" />

      <Widget
        title="Flash sales"
        description="Sales per day during each sale against the days before it"
        query={{ isPending: false, error: null, data: d.flashSales, refetch: () => undefined }}
        isEmpty={(x) => x.length === 0}
        empty={<Text size="sm" c="dimmed">No flash sales on your products in this period.</Text>}
        testId="flash-sales"
      >
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.flashSaleId}
            exportName="Flash sales"
            initialSort={{ key: 'uplift', dir: 'desc' }}
            minWidth={980}
            columns={[
              { key: 'product', header: 'Product', sortValue: (r) => r.productName ?? '', render: (r) => <ProductLink id={r.productId} name={r.productName} /> },
              { key: 'discount', header: 'Off', align: 'right', sortValue: (r) => r.discountPercent, render: (r) => formatPercent(r.discountPercent, { digits: 0 }) },
              {
                key: 'status',
                header: 'Status',
                sortValue: (r) => r.status,
                render: (r) => (
                  <Badge variant="light" color={flashStatusColor[r.status] ?? 'gray'}>
                    {humanize(r.status)}
                  </Badge>
                ),
              },
              { key: 'runs', header: 'Runs', sortValue: (r) => r.startUtc, render: (r) => `${formatDate(r.startUtc)} – ${formatDate(r.endUtc)}`, csv: (r) => `${r.startUtc} – ${r.endUtc}`, hideOnPhone: true },
              { key: 'units', header: 'Units / day', align: 'right', sortValue: (r) => r.sale.unitsPerDay, render: (r) => `${r.sale.unitsPerDay.toFixed(1)} vs ${r.baseline.unitsPerDay.toFixed(1)}`, csv: (r) => r.sale.unitsPerDay },
              { key: 'baseline', header: 'Before (units / day)', align: 'right', sortValue: (r) => r.baseline.unitsPerDay, hideOnPhone: true, render: (r) => r.baseline.unitsPerDay.toFixed(1) },
              { key: 'uplift', header: 'Units lift', align: 'right', sortValue: (r) => r.unitsUpliftPercent, render: (r) => upliftBadge(r.unitsUpliftPercent) },
              { key: 'salesUplift', header: 'Sales lift', align: 'right', sortValue: (r) => r.salesUpliftPercent, render: (r) => upliftBadge(r.salesUpliftPercent), hideOnPhone: true },
              { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.sale.grossSales, render: (r) => formatMoney(r.sale.grossSales) },
              { key: 'cost', header: 'Discount given', align: 'right', sortValue: (r) => r.discountCost, render: (r) => formatMoney(r.discountCost), hideOnPhone: true },
            ]}
          />
        )}
      </Widget>

      <Widget
        title="Sponsored placements"
        description="Sales of sponsored products in this period against the previous one"
        query={{ isPending: false, error: null, data: d.sponsored, refetch: () => undefined }}
        isEmpty={(x) => x.length === 0}
        empty={<Text size="sm" c="dimmed">You are not sponsoring any product.</Text>}
        testId="sponsored"
      >
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.listingId}
            exportName="Sponsored placements"
            initialSort={{ key: 'sales', dir: 'desc' }}
            minWidth={880}
            columns={[
              { key: 'product', header: 'Product', sortValue: (r) => r.productName ?? '', render: (r) => <ProductLink id={r.productId} name={r.productName} /> },
              {
                key: 'state',
                header: 'Status',
                sortValue: (r) => (r.isLive ? 'Live' : 'Paused'),
                render: (r) => (
                  <Badge variant="light" color={r.isLive ? 'forest' : 'gray'}>
                    {r.isLive ? 'Live' : r.state === 2 ? 'Paused' : 'Ended'}
                  </Badge>
                ),
              },
              { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => r.impressions, render: (r) => formatNumber(r.impressions), hideOnPhone: true },
              { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders) },
              { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.grossSales, render: (r) => formatMoney(r.grossSales) },
              ...(compare
                ? [
                    {
                      key: 'change',
                      header: 'Change',
                      align: 'right' as const,
                      sortValue: (r: { salesDeltaPercent: number | null }) => r.salesDeltaPercent,
                      render: (r: { salesDeltaPercent: number | null; previousGrossSales: number; grossSales: number }) => (
                        <DeltaBadge value={r.salesDeltaPercent} isNew={r.previousGrossSales === 0 && r.grossSales > 0} />
                      ),
                    },
                  ]
                : []),
              {
                key: 'per1k',
                header: 'Orders / 1k impressions',
                align: 'right',
                sortValue: (r) => r.ordersPerThousandImpressions,
                render: (r) => (r.ordersPerThousandImpressions === null ? '—' : r.ordersPerThousandImpressions.toFixed(1)),
                hideOnPhone: true,
              },
            ]}
          />
        )}
      </Widget>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Widget
            title="Store codes and product tags"
            description="QR / NFC codes and links: scans and the orders that followed"
            query={{ isPending: false, error: null, data: d.codes, refetch: () => undefined }}
            isEmpty={(x) => x.length === 0}
            empty={<Text size="sm" c="dimmed">No codes were scanned in this period.</Text>}
            testId="codes"
          >
            {(rows) => (
              <DataTable
                rows={rows}
                rowKey={(r) => r.code}
                exportName="Codes"
                initialSort={{ key: 'scans', dir: 'desc' }}
                minWidth={640}
                columns={[
                  { key: 'code', header: 'Code', sortValue: (r) => r.label ?? r.code, render: (r) => r.label ?? r.code, csv: (r) => r.code },
                  { key: 'kind', header: 'Type', sortValue: (r) => humanize(r.kind), hideOnPhone: true },
                  { key: 'scans', header: 'Scans', align: 'right', sortValue: (r) => r.scans, render: (r) => formatNumber(r.scans) },
                  { key: 'people', header: 'People', align: 'right', sortValue: (r) => r.uniqueScanners, render: (r) => formatNumber(r.uniqueScanners), hideOnPhone: true },
                  { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders) },
                  { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.grossSales, render: (r) => formatMoney(r.grossSales) },
                  { key: 'rate', header: 'Scan → order', align: 'right', sortValue: (r) => r.scanToOrderPercent, render: (r) => formatPercent(r.scanToOrderPercent), hideOnPhone: true },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Widget title="EMI and payment plans" query={{ isPending: false, error: null, data: d.paymentPlans, refetch: () => undefined }} testId="payment-plans">
            {(p) => (
              <Stack gap="sm">
                <KpiGrid specs={paymentPlanKpis(p)} compare={compare} cols={2} />
                {p.byKind.length > 0 && (
                  <DataTable
                    rows={p.byKind}
                    rowKey={(r) => String(r.kind)}
                    exportName="Payment plans"
                    initialSort={{ key: 'applications', dir: 'desc' }}
                    minWidth={0}
                    columns={[
                      { key: 'label', header: 'Plan', sortValue: (r) => r.label },
                      { key: 'applications', header: 'Applied', align: 'right', sortValue: (r) => r.applications },
                      { key: 'approved', header: 'Approved', align: 'right', sortValue: (r) => r.approved },
                      { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.planSales, render: (r) => formatMoney(r.planSales) },
                    ]}
                  />
                )}
              </Stack>
            )}
          </Widget>
        </Grid.Col>
      </Grid>

      <Widget
        title="Campaigns"
        description="Campaign workspaces, their budget, spend and measured lift"
        query={{ isPending: false, error: null, data: d.campaigns, refetch: () => undefined }}
        isEmpty={(x) => x.length === 0}
        empty={<Text size="sm" c="dimmed">No campaigns yet.</Text>}
        testId="campaigns"
      >
        {(rows) => (
          <DataTable
            rows={rows}
            rowKey={(r) => r.workspaceId}
            exportName="Campaigns"
            initialSort={{ key: 'spent', dir: 'desc' }}
            minWidth={640}
            columns={[
              { key: 'name', header: 'Campaign', sortValue: (r) => r.name },
              {
                key: 'state',
                header: 'Status',
                sortValue: (r) => campaignStateLabel[r.state] ?? '',
                render: (r) => (
                  <Badge variant="light" color={campaignStateColor[r.state] ?? 'gray'}>
                    {campaignStateLabel[r.state] ?? '—'}
                  </Badge>
                ),
              },
              { key: 'budget', header: 'Budget', align: 'right', sortValue: (r) => r.budgetAmount, render: (r) => formatMoney({ amount: r.budgetAmount, currency: r.currency }) },
              { key: 'spent', header: 'Spent', align: 'right', sortValue: (r) => r.spentAmount, render: (r) => formatMoney({ amount: r.spentAmount, currency: r.currency }) },
              {
                key: 'lift',
                header: 'Measured lift',
                align: 'right',
                sortValue: (r) => r.incrementalLiftPercent,
                render: (r) => (r.measured ? <DeltaBadge value={r.incrementalLiftPercent} /> : <Text size="xs" c="dimmed">not measured</Text>),
                csv: (r) => (r.measured ? r.incrementalLiftPercent : null),
              },
            ]}
          />
        )}
      </Widget>

      {d.unavailable.length > 0 && (
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />} title="Not measured for sellers yet" data-testid="promo-unavailable">
          <List size="sm" spacing={2}>
            {d.unavailable.map((u) => (
              <List.Item key={u}>{u}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      <Notes notes={d.notes} />
    </Stack>
  );
}

// ------------------------------------------------------------------ older endpoints

function LiftCell({ lift }: { lift: { isPending: boolean; error: unknown; data: FlashSaleLift | undefined } }) {
  if (lift.isPending) return <Loader size={14} color="forest" aria-label="Measuring lift" />;
  if (lift.error || !lift.data) return <Text size="sm" c="dimmed">—</Text>;
  // The backend sends the lift as a fraction (0.25 = +25 %).
  return <DeltaBadge value={lift.data.liftPercent === null ? null : lift.data.liftPercent * 100} />;
}

const LIFT_LIMIT = 10;

function LegacyPromotions() {
  const sales = useQuery({ queryKey: [INSIGHTS_KEY, 'flash-sales'], queryFn: insightsApi.flashSales, staleTime: 60_000 });
  const own = useQuery({ queryKey: [INSIGHTS_KEY, 'own-products'], queryFn: insightsApi.ownProductIds, staleTime: 300_000 });
  const sponsored = useQuery({ queryKey: [INSIGHTS_KEY, 'sponsored'], queryFn: insightsApi.sponsored, staleTime: 60_000 });
  const campaigns = useQuery({ queryKey: [INSIGHTS_KEY, 'campaigns'], queryFn: insightsApi.campaigns, staleTime: 120_000 });
  const emi = useQuery({ queryKey: [INSIGHTS_KEY, 'emi-products'], queryFn: insightsApi.emiProducts, staleTime: 300_000 });

  const flash = {
    isPending: sales.isPending || own.isPending,
    error: sales.error ?? own.error,
    data: sales.data && own.data ? ownFlashSales(sales.data, own.data) : undefined,
    refetch: () => {
      void sales.refetch();
      void own.refetch();
    },
  };
  const mine = flash.data ?? [];
  const lifts = useQueries({
    queries: mine.slice(0, LIFT_LIMIT).map((s) => ({
      queryKey: [INSIGHTS_KEY, 'flash-lift', s.flashSaleId],
      queryFn: () => insightsApi.flashSaleLift(s.flashSaleId),
      staleTime: 300_000,
      retry: false,
    })),
  });
  const liftById = new Map(mine.slice(0, LIFT_LIMIT).map((s, i) => [s.flashSaleId, lifts[i]]));

  return (
    <Stack gap="md">
      <Grid gutter="md" data-testid="promo-kpis">
        <Grid.Col span={{ base: 6, md: 3 }}>
          <MetricTile label="Flash sales live" value={flash.data ? formatNumber(mine.length) : ''} loading={flash.isPending} error={!!flash.error} compare={false} />
        </Grid.Col>
        <Grid.Col span={{ base: 6, md: 3 }}>
          <MetricTile
            label="Sponsored live"
            value={sponsored.data ? formatNumber(sponsored.data.filter((s) => s.isLive).length) : ''}
            loading={sponsored.isPending}
            error={!!sponsored.error}
            hint={sponsored.data ? `${formatNumber(sponsored.data.reduce((s, x) => s + x.impressionsLast7Days, 0))} impressions in 7 days` : undefined}
            compare={false}
            tone="gray"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, md: 3 }}>
          <MetricTile
            label="Campaign spend"
            value={campaigns.data ? formatMoney(campaigns.data.reduce((s, c) => s + c.spentAmount, 0)) : ''}
            loading={campaigns.isPending}
            error={!!campaigns.error}
            hint={campaigns.data ? `${campaigns.data.filter((c) => c.state === 4).length} active campaigns` : undefined}
            compare={false}
            tone="amber"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 6, md: 3 }}>
          <MetricTile
            label="Products with EMI"
            value={emi.data ? formatNumber(emi.data.filter((p) => p.enabled).length) : ''}
            loading={emi.isPending}
            error={!!emi.error}
            hint="Pay in instalments"
            compare={false}
          />
        </Grid.Col>
      </Grid>

      <Widget
        title="Flash sales"
        description="Live flash sales on your products and the lift in daily units against the 7 days before"
        query={flash}
        isEmpty={(d) => d.length === 0}
        empty={<Text size="sm" c="dimmed">No flash sale is running on your products.</Text>}
        testId="flash-sales"
      >
        {(d) => (
          <DataTable
            rows={d}
            rowKey={(r) => r.flashSaleId}
            exportName="Flash sales"
            initialSort={{ key: 'product', dir: 'asc' }}
            minWidth={720}
            columns={[
              { key: 'product', header: 'Product', sortValue: (r) => r.productName, render: (r) => <ProductLink id={r.productId} name={r.productName} /> },
              { key: 'price', header: 'Sale price', align: 'right', sortValue: (r) => r.salePrice, render: (r) => formatMoney({ amount: r.salePrice, currency: r.currency }) },
              { key: 'discount', header: 'Off', align: 'right', sortValue: (r) => discountPercent(r), render: (r) => formatPercent(discountPercent(r), { digits: 0 }) },
              { key: 'window', header: 'Runs', sortValue: (r) => r.startUtc, render: (r) => `${formatDateTime(r.startUtc)} – ${formatDateTime(r.endUtc)}`, csv: (r) => `${r.startUtc} – ${r.endUtc}`, hideOnPhone: true },
              {
                key: 'lift',
                header: 'Lift',
                align: 'right',
                sortValue: (r) => liftById.get(r.flashSaleId)?.data?.liftPercent ?? null,
                csv: (r) => {
                  const l = liftById.get(r.flashSaleId)?.data?.liftPercent;
                  return l === null || l === undefined ? null : Math.round(l * 1000) / 10;
                },
                render: (r) => {
                  const lift = liftById.get(r.flashSaleId);
                  return lift ? <LiftCell lift={lift} /> : '—';
                },
              },
            ]}
          />
        )}
      </Widget>

      <Widget
        title="Sponsored placements"
        description="Impressions and units sold in the last 7 days against the 7 days before"
        query={sponsored}
        isEmpty={(d) => d.length === 0}
        empty={<Text size="sm" c="dimmed">You are not sponsoring any product.</Text>}
        testId="sponsored"
      >
        {(d) => (
          <DataTable
            rows={d}
            rowKey={(r) => r.id}
            exportName="Sponsored placements"
            initialSort={{ key: 'impressions', dir: 'desc' }}
            minWidth={760}
            columns={[
              { key: 'product', header: 'Product', sortValue: (r) => r.productName, render: (r) => <ProductLink id={r.productId} name={r.productName} /> },
              {
                key: 'state',
                header: 'Status',
                sortValue: (r) => (r.isLive ? 'Live' : r.state === 2 ? 'Paused' : 'Ended'),
                render: (r) => (
                  <Badge variant="light" color={r.isLive ? 'forest' : 'gray'}>
                    {r.isLive ? 'Live' : r.state === 2 ? 'Paused' : 'Ended'}
                  </Badge>
                ),
              },
              { key: 'impressions', header: 'Impressions 7d', align: 'right', sortValue: (r) => r.impressionsLast7Days, render: (r) => formatNumber(r.impressionsLast7Days) },
              { key: 'units', header: 'Units 7d', align: 'right', sortValue: (r) => r.unitsSoldLast7Days, render: (r) => formatNumber(r.unitsSoldLast7Days) },
              {
                key: 'uplift',
                header: 'vs before',
                align: 'right',
                sortValue: (r) => deltaPercent(r.unitsSoldLast7Days, r.unitsSoldPrevious7Days),
                render: (r) => <DeltaBadge value={deltaPercent(r.unitsSoldLast7Days, r.unitsSoldPrevious7Days)} isNew={r.unitsSoldPrevious7Days === 0 && r.unitsSoldLast7Days > 0} />,
              },
              { key: 'ends', header: 'Ends', sortValue: (r) => r.endsUtc, render: (r) => (r.endsUtc ? formatDate(r.endsUtc) : 'No end'), hideOnPhone: true },
            ]}
          />
        )}
      </Widget>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Widget
            title="Campaigns"
            description="Campaign workspaces, their budget and what has been spent"
            query={campaigns}
            isEmpty={(d) => d.length === 0}
            empty={<Text size="sm" c="dimmed">No campaigns yet.</Text>}
            testId="campaigns"
          >
            {(d) => (
              <DataTable
                rows={d}
                rowKey={(r) => r.id}
                exportName="Campaigns"
                initialSort={{ key: 'spent', dir: 'desc' }}
                minWidth={600}
                columns={[
                  { key: 'name', header: 'Campaign', sortValue: (r) => r.name },
                  {
                    key: 'state',
                    header: 'Status',
                    sortValue: (r) => campaignStateLabel[r.state] ?? '',
                    render: (r) => (
                      <Badge variant="light" color={campaignStateColor[r.state] ?? 'gray'}>
                        {campaignStateLabel[r.state] ?? '—'}
                      </Badge>
                    ),
                  },
                  { key: 'budget', header: 'Budget', align: 'right', sortValue: (r) => r.budgetAmount, render: (r) => formatMoney({ amount: r.budgetAmount, currency: r.budgetCurrency }) },
                  { key: 'spent', header: 'Spent', align: 'right', sortValue: (r) => r.spentAmount, render: (r) => formatMoney({ amount: r.spentAmount, currency: r.budgetCurrency }) },
                  {
                    key: 'used',
                    header: 'Used',
                    align: 'right',
                    sortValue: (r) => ratio(r.spentAmount, r.budgetAmount),
                    render: (r) => formatPercent(ratio(r.spentAmount, r.budgetAmount), { fraction: true, digits: 0 }),
                  },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Widget
            title="EMI on your products"
            query={emi}
            isEmpty={(d) => d.filter((p) => p.enabled).length === 0}
            empty={<Text size="sm" c="dimmed">No product offers EMI yet. Turn it on from a product&apos;s pricing step.</Text>}
            testId="emi"
          >
            {(d) => (
              <DataTable
                rows={d.filter((p) => p.enabled)}
                rowKey={(r) => r.productId}
                exportName="EMI products"
                initialSort={{ key: 'product', dir: 'asc' }}
                minWidth={0}
                columns={[
                  { key: 'product', header: 'Product', sortValue: (r) => r.productName, render: (r) => <ProductLink id={r.productId} name={r.productName} /> },
                  { key: 'tenures', header: 'Months', sortValue: (r) => r.tenures.join(', ') },
                  { key: 'down', header: 'Down payment', align: 'right', sortValue: (r) => r.minDownPaymentPercent, render: (r) => `${r.minDownPaymentPercent}%` },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default function PromotionsPage() {
  const range = useRange();
  const key = rangeKey(range);
  // The new report covers everything in one read; before it is deployed each older endpoint loads on its own.
  const promos = useQuery({
    queryKey: [INSIGHTS_KEY, 'promotions', key],
    queryFn: () => preferInsights(() => newInsightsApi.promotions(range.current), async () => null),
    staleTime: 60_000,
  });
  if (promos.isPending) return <ListSkeleton rows={4} height={90} />;
  if (promos.error || !promos.data)
    return <ErrorBlock error={promos.error ?? new Error('No data')} title="Could not load promotions" onRetry={() => void promos.refetch()} />;
  if (promos.data.source === 'legacy') return <LegacyPromotions />;
  return <InsightsPromotions d={promos.data.data} compare={range.compare} />;
}
