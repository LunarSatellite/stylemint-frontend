import { Avatar, Badge, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatMoney, formatMoneyCompact, formatNumber } from '../../lib/format';
import {
  creatorLabel,
  INSIGHTS_KEY,
  insightsApi,
  partnershipStateColor,
  partnershipStateLabel,
  type CreatorPerformanceRow,
  type DashboardSnapshot,
  type TopCreator,
} from './api';
import { DataTable, DeltaBadge, KpiGrid, Notes, rangeKey, useRange, Widget, type Column } from './components';
import { newInsightsApi, preferInsights, type CreatorInsight, type CreatorInsightsPage } from './contracts';
import type { KpiSpec } from './model';
import { deltaPercent, ratio } from './period';

export interface CreatorRow {
  creatorAccountId: string;
  name: string;
  avatarUrl: string | null;
  reels: number;
  /** Reach and engagement — only from the new insights report. */
  views: number | null;
  engagements: number | null;
  clicks: number | null;
  carts: number | null;
  orders: number | null;
  units: number;
  revenue: number;
  commission: number;
  /** Sales per rupee of commission. */
  roi: number | null;
  prevRevenue: number | null;
  changePercent: number | null;
}

export function creatorRowFromInsight(c: CreatorInsight): CreatorRow {
  return {
    creatorAccountId: c.creatorAccountId,
    name: creatorLabel({ creatorName: c.displayName, creatorHandle: c.handle }, c.creatorAccountId),
    avatarUrl: c.avatarUrl,
    reels: c.reels,
    views: c.views,
    engagements: c.engagements,
    clicks: c.affiliateClicks,
    carts: c.addToCarts,
    orders: c.orders,
    units: c.unitsSold,
    revenue: c.grossSales,
    commission: c.commission,
    roi: c.returnOnCommission,
    prevRevenue: c.previousGrossSales,
    changePercent: c.salesDeltaPercent,
  };
}

/**
 * Older endpoints: numbers from `analytics/creators` (scoped to the shop, so team members see them
 * too); names from `creator-performance` (the owner's view) when available; return on commission
 * from the dashboard's delivered-only ratio when it has one.
 */
export function creatorRows(
  current: TopCreator[],
  previous: TopCreator[] | null,
  names: CreatorPerformanceRow[] | undefined,
  dashboard: DashboardSnapshot | undefined,
): CreatorRow[] {
  const prev = new Map((previous ?? []).map((c) => [c.creatorAccountId, c]));
  const who = new Map((names ?? []).map((c) => [c.creatorAccountId, c]));
  const dash = new Map((dashboard?.topCreatorsByAttributedSales ?? []).map((c) => [c.creatorAccountId, c]));
  return current.map((c) => {
    const before = prev.get(c.creatorAccountId);
    const prevRevenue = previous ? (before?.attributedRevenue.amount ?? 0) : null;
    const n = who.get(c.creatorAccountId);
    const d = dash.get(c.creatorAccountId);
    const revenue = c.attributedRevenue.amount;
    const commission = c.commissionPaid.amount;
    return {
      creatorAccountId: c.creatorAccountId,
      name: creatorLabel({ creatorName: n?.creatorDisplayName ?? null, creatorHandle: n?.creatorHandle ?? null }, c.creatorAccountId),
      avatarUrl: n?.creatorAvatarUrl ?? null,
      reels: c.distinctReelCount,
      views: null,
      engagements: null,
      clicks: null,
      carts: null,
      orders: null,
      units: c.unitsSold,
      revenue,
      commission,
      roi: d && d.roiRatio > 0 ? d.roiRatio : ratio(revenue, commission),
      prevRevenue,
      changePercent: prevRevenue === null ? null : deltaPercent(revenue, prevRevenue),
    };
  });
}

const times = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(1)}×`);

function moneySpec(key: string, label: string, cur: number, prev: number, extra: Partial<KpiSpec> = {}): KpiSpec {
  return { key, label, value: formatMoneyCompact(cur), previous: formatMoney(prev), delta: deltaPercent(cur, prev), unit: 'percent', isNew: prev === 0 && cur > 0, ...extra };
}

export function creatorKpisFromInsights(t: CreatorInsightsPage['totals']): KpiSpec[] {
  const count = (key: string, label: string, m: { current: number; previous: number }): KpiSpec => ({
    key,
    label,
    value: formatNumber(m.current),
    previous: formatNumber(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
  });
  return [
    { ...count('views', 'Reach (views)', t.views), hint: `${formatNumber(t.creators)} creators` },
    count('engagements', 'Engagements', t.engagements),
    count('clicks', 'Link clicks', t.affiliateClicks),
    count('orders', 'Orders', t.orders),
    moneySpec('sales', 'Sales from creators', t.grossSales.current, t.grossSales.previous),
    moneySpec('commission', 'Commission paid', t.commission.current, t.commission.previous, { invert: true, isNew: false }),
    {
      key: 'roi',
      label: 'Return on commission',
      value: times(t.returnOnCommission.current),
      previous: times(t.returnOnCommission.previous),
      delta: deltaPercent(t.returnOnCommission.current, t.returnOnCommission.previous),
      unit: 'percent',
    },
  ];
}

export function creatorKpisFromRows(rows: CreatorRow[], previous: TopCreator[] | null): KpiSpec[] {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const commission = rows.reduce((s, r) => s + r.commission, 0);
  const prevRevenue = (previous ?? []).reduce((s, r) => s + r.attributedRevenue.amount, 0);
  const prevCommission = (previous ?? []).reduce((s, r) => s + r.commissionPaid.amount, 0);
  const roi = ratio(revenue, commission);
  const prevRoi = ratio(prevRevenue, prevCommission);
  return [
    moneySpec('sales', 'Sales from creators', revenue, prevRevenue),
    moneySpec('commission', 'Commission paid', commission, prevCommission, { invert: true, isNew: false }),
    { key: 'roi', label: 'Return on commission', value: times(roi), previous: times(prevRoi), delta: deltaPercent(roi, prevRoi), unit: 'percent' },
    {
      key: 'selling',
      label: 'Creators selling',
      value: formatNumber(rows.filter((r) => r.units > 0).length),
      previous: formatNumber((previous ?? []).filter((r) => r.unitsSold > 0).length),
      delta: null,
      unit: 'percent',
    },
  ];
}

export default function CreatorsPage() {
  const range = useRange();
  const key = rangeKey(range);
  const creators = useQuery({
    queryKey: [INSIGHTS_KEY, 'creators', key, range.compare],
    queryFn: () =>
      preferInsights(
        () => newInsightsApi.creators(range.current),
        async () => {
          const [cur, prev, names, dashboard] = await Promise.all([
            insightsApi.creators(range.current),
            range.compare ? insightsApi.creators(range.previous) : Promise.resolve(null),
            // Names and the delivered-only ROI are extras: without them the ids and ratios still show.
            insightsApi.creatorPerformance(range.current, 100).catch(() => undefined),
            insightsApi.dashboard(range.current).catch(() => undefined),
          ]);
          return { cur: cur.items, prev: prev?.items ?? null, names, dashboard };
        },
      ),
    staleTime: 60_000,
  });
  const partnerships = useQuery({ queryKey: [INSIGHTS_KEY, 'partnerships'], queryFn: insightsApi.partnerships, staleTime: 300_000 });

  const rows = {
    isPending: creators.isPending,
    error: creators.error,
    data: creators.data
      ? creators.data.source === 'insights'
        ? creators.data.data.items.map(creatorRowFromInsight)
        : creatorRows(creators.data.data.cur, creators.data.data.prev, creators.data.data.names, creators.data.data.dashboard)
      : undefined,
    refetch: () => void creators.refetch(),
  };
  const isNew = creators.data?.source === 'insights';
  const optional = (c: Column<CreatorRow>, when: boolean) => (when ? [c] : []);

  return (
    <Stack gap="md">
      <Widget title="Creators at a glance" query={creators} testId="creator-kpis">
        {(d) => (
          <Stack gap="xs">
            <KpiGrid
              compare={range.compare}
              specs={d.source === 'insights' ? creatorKpisFromInsights(d.data.totals) : creatorKpisFromRows(rows.data ?? [], d.data.prev)}
            />
            {d.source === 'insights' && <Notes notes={d.data.notes} />}
          </Stack>
        )}
      </Widget>

      <Widget
        title="Every creator's results"
        description="Reach, clicks and sales from their reels, the commission you paid and what each rupee of commission brought back"
        query={rows}
        isEmpty={(d) => d.length === 0}
        empty={<Text size="sm" c="dimmed">No creator promoted your products in this period.</Text>}
        testId="creator-table"
      >
        {(d) => (
          <DataTable
            rows={d}
            rowKey={(r) => r.creatorAccountId}
            exportName="Creator performance"
            initialSort={{ key: 'revenue', dir: 'desc' }}
            minWidth={isNew ? 1040 : 780}
            columns={[
              {
                key: 'name',
                header: 'Creator',
                sortValue: (r) => r.name,
                render: (r) => (
                  <Group gap="xs" wrap="nowrap">
                    <Avatar src={r.avatarUrl ?? undefined} size={28} radius="xl" color="forest">
                      {r.name.replace('@', '').slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {r.name}
                    </Text>
                  </Group>
                ),
              },
              { key: 'reels', header: 'Reels', align: 'right', sortValue: (r) => r.reels, render: (r) => formatNumber(r.reels), hideOnPhone: true },
              ...optional({ key: 'views', header: 'Reach', align: 'right', sortValue: (r) => r.views, render: (r) => formatNumber(r.views) }, isNew),
              ...optional({ key: 'engagements', header: 'Engagements', align: 'right', sortValue: (r) => r.engagements, render: (r) => formatNumber(r.engagements), hideOnPhone: true }, isNew),
              ...optional({ key: 'clicks', header: 'Clicks', align: 'right', sortValue: (r) => r.clicks, render: (r) => formatNumber(r.clicks), hideOnPhone: true }, isNew),
              ...optional({ key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders) }, isNew),
              ...optional({ key: 'units', header: 'Units', align: 'right', sortValue: (r) => r.units, render: (r) => formatNumber(r.units) }, !isNew),
              { key: 'revenue', header: 'Sales', align: 'right', sortValue: (r) => r.revenue, render: (r) => formatMoney(r.revenue) },
              { key: 'commission', header: 'Commission', align: 'right', sortValue: (r) => r.commission, render: (r) => formatMoney(r.commission) },
              { key: 'roi', header: 'Return', align: 'right', sortValue: (r) => r.roi, render: (r) => times(r.roi) },
              ...optional(
                {
                  key: 'change',
                  header: 'Change',
                  align: 'right',
                  sortValue: (r) => r.changePercent,
                  render: (r) => <DeltaBadge value={r.changePercent} isNew={r.prevRevenue === 0 && r.revenue > 0} />,
                },
                range.compare,
              ),
            ]}
          />
        )}
      </Widget>

      <Widget
        title="Partnerships"
        query={partnerships}
        isEmpty={(d) => d.items.length === 0}
        empty={<Text size="sm" c="dimmed">You have not partnered with a creator yet.</Text>}
        testId="partnerships"
      >
        {(d) => (
          <DataTable
            rows={d.items}
            rowKey={(r) => r.id}
            exportName="Partnerships"
            initialSort={{ key: 'since', dir: 'desc' }}
            minWidth={560}
            columns={[
              { key: 'creator', header: 'Creator', sortValue: (r) => creatorLabel(r, r.creatorAccountId ?? r.creatorProfileId) },
              {
                key: 'state',
                header: 'Status',
                sortValue: (r) => partnershipStateLabel[r.state] ?? '',
                render: (r) => (
                  <Badge variant="light" color={partnershipStateColor[r.state] ?? 'gray'}>
                    {partnershipStateLabel[r.state] ?? '—'}
                  </Badge>
                ),
              },
              {
                key: 'commission',
                header: 'Commission',
                align: 'right',
                sortValue: (r) => r.commissionMaxPercent,
                render: (r) => (r.commissionMinPercent === r.commissionMaxPercent ? `${r.commissionMaxPercent}%` : `${r.commissionMinPercent}–${r.commissionMaxPercent}%`),
                csv: (r) => `${r.commissionMinPercent}-${r.commissionMaxPercent}%`,
              },
              { key: 'since', header: 'Since', sortValue: (r) => r.respondedUtc ?? r.invitedUtc, render: (r) => formatDate(r.respondedUtc ?? r.invitedUtc) },
            ]}
          />
        )}
      </Widget>
    </Stack>
  );
}
