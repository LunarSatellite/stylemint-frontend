import { useState } from 'react';
import { Alert, Grid, Group, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, formatNumber, humanize } from '../../lib/format';
import { INSIGHTS_KEY, insightsApi } from './api';
import { DataTable, DeltaBadge, formatPercent, KpiGrid, MetricTile, Notes, rangeKey, ShareDonut, TrendChart, useRange, Widget } from './components';
import { newInsightsApi, preferInsights } from './contracts';
import { salesKpisFromInsights, salesKpisFromOverview, trendFromInsights } from './model';
import { alignCompare, bucketSeries, sumOf, type ComparePoint, type Grain } from './period';

function TrendTable({ points, grain, compare, metric }: { points: ComparePoint[]; grain: Grain; compare: boolean; metric: 'sales' | 'orders' }) {
  const fmt = (v: number | null) => (metric === 'sales' ? formatMoney(v) : formatNumber(v));
  return (
    <DataTable
      rows={points.map((p, i) => ({ ...p, i }))}
      rowKey={(r) => String(r.i)}
      exportName={metric === 'sales' ? 'Revenue over time' : 'Orders over time'}
      pageSize={7}
      minWidth={0}
      columns={[
        { key: 'label', header: grain === 'day' ? 'Day' : grain === 'week' ? 'Week' : 'Month', sortValue: (r) => r.i, render: (r) => r.label, csv: (r) => r.label },
        { key: 'current', header: metric === 'sales' ? 'Revenue' : 'Orders', align: 'right', sortValue: (r) => r.current, render: (r) => fmt(r.current) },
        ...(compare
          ? [{ key: 'previous', header: 'Previous period', align: 'right' as const, sortValue: (r: ComparePoint) => r.previous, render: (r: ComparePoint) => fmt(r.previous) }]
          : []),
      ]}
    />
  );
}

export default function SalesPage() {
  const range = useRange();
  const key = rangeKey(range);
  const client = useQueryClient();
  const [grain, setGrain] = useState<Grain | null>(null);
  const [metric, setMetric] = useState<'sales' | 'orders'>('sales');
  const activeGrain = grain ?? range.grain;

  // The older overview is cached on its own key, so switching day/week/month does not ask again.
  const legacyOverview = () =>
    client.fetchQuery({ queryKey: [INSIGHTS_KEY, 'overview', key], queryFn: () => insightsApi.overview(range.current), staleTime: 60_000 });

  const sales = useQuery({
    queryKey: [INSIGHTS_KEY, 'sales', key, activeGrain],
    queryFn: () => preferInsights(() => newInsightsApi.sales(range.current, activeGrain), legacyOverview),
    staleTime: 60_000,
  });
  const isLegacy = sales.data?.source === 'legacy';
  // Only the older endpoint needs a second request for the previous period's trend.
  const previous = useQuery({
    queryKey: [INSIGHTS_KEY, 'overview', key, 'previous'],
    queryFn: () => insightsApi.overview(range.previous),
    staleTime: 60_000,
    enabled: range.compare && isLegacy,
  });

  const trendPoints = (): ComparePoint[] => {
    const d = sales.data!;
    if (d.source === 'insights') return trendFromInsights(d.data, metric);
    const cur = bucketSeries(
      d.data.revenueTrend.map((p) => ({ date: p.date, value: p.amount.amount })),
      range.current,
      activeGrain,
    );
    const prev =
      range.compare && previous.data
        ? bucketSeries(
            previous.data.revenueTrend.map((p) => ({ date: p.date, value: p.amount.amount })),
            range.previous,
            activeGrain,
          )
        : null;
    return alignCompare(cur, prev);
  };

  return (
    <Stack gap="md">
      <Widget
        title="Headline numbers"
        query={sales}
        skeleton={
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
            {Array.from({ length: 4 }, (_, i) => (
              <MetricTile key={i} label="…" value="" loading />
            ))}
          </SimpleGrid>
        }
      >
        {(d) => (
          <Stack gap="xs">
            {d.source === 'insights' && d.data.truncated && (
              <Alert color="amber" variant="light" py={6}>
                This period has a very large number of orders; some totals are approximate.
              </Alert>
            )}
            <KpiGrid
              testId="sales-kpis"
              compare={range.compare}
              cols={d.source === 'insights' ? 4 : 5}
              specs={d.source === 'insights' ? salesKpisFromInsights(d.data) : salesKpisFromOverview(d.data)}
            />
            {d.source === 'insights' && <Notes notes={d.data.notes} />}
          </Stack>
        )}
      </Widget>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Widget
            title={metric === 'sales' ? 'Revenue over time' : 'Orders over time'}
            description={range.compare ? 'This period against the one before it' : undefined}
            action={
              <Group gap="xs">
                {sales.data?.source === 'insights' && (
                  <SegmentedControl
                    size="xs"
                    value={metric}
                    onChange={(v) => setMetric(v as 'sales' | 'orders')}
                    data={[
                      { label: 'Revenue', value: 'sales' },
                      { label: 'Orders', value: 'orders' },
                    ]}
                    aria-label="Measure"
                  />
                )}
                <SegmentedControl
                  size="xs"
                  value={activeGrain}
                  onChange={(v) => setGrain(v as Grain)}
                  data={[
                    { label: 'Day', value: 'day' },
                    { label: 'Week', value: 'week' },
                    { label: 'Month', value: 'month' },
                  ]}
                  aria-label="Group by"
                />
              </Group>
            }
            query={sales}
            isEmpty={(d) =>
              d.source === 'insights' ? d.data.summary.grossSales.current === 0 && d.data.summary.orders.current === 0 : d.data.revenueTrend.length === 0 && d.data.grossSales.current.amount === 0
            }
            empty={<Text size="sm" c="dimmed">No sales in this period yet.</Text>}
            skeleton={<div style={{ height: 240 }} data-testid="state-loading" />}
            testId="revenue-trend"
          >
            {() => {
              const points = trendPoints();
              const showPrev = range.compare && points.some((p) => p.previous !== null);
              const total = sumOf(points.map((p) => ({ value: p.current })));
              const prevTotal = sumOf(points.map((p) => ({ value: p.previous ?? 0 })));
              const fmt = metric === 'sales' ? formatMoney : formatNumber;
              return (
                <Stack gap="xs">
                  <TrendChart points={points} kind={metric === 'sales' ? 'money' : 'count'} label={metric === 'sales' ? 'Revenue' : 'Orders'} compare={showPrev} />
                  <TrendTable points={points} grain={activeGrain} compare={showPrev} metric={metric} />
                  <Text size="xs" c="dimmed">
                    Total {fmt(total)}
                    {showPrev ? ` · previous period ${fmt(prevTotal)}` : ''}
                  </Text>
                </Stack>
              );
            }}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Widget
            title={isLegacy ? 'Reel orders by platform' : 'Where sales come from'}
            description={isLegacy ? 'Where the reels that sold your products were posted' : 'Each sale counted once, by its most specific source'}
            query={sales}
            isEmpty={(d) => (d.source === 'insights' ? d.data.bySource.every((s) => s.orders === 0 && s.previousOrders === 0) : d.data.trafficSources.length === 0)}
            empty={<Text size="sm" c="dimmed">{isLegacy ? 'No orders came from reels in this period.' : 'No sales in this period yet.'}</Text>}
            testId="sales-sources"
          >
            {(d) =>
              d.source === 'insights' ? (
                <Stack gap="sm">
                  <ShareDonut
                    data={d.data.bySource.filter((s) => (s.sharePercent ?? 0) > 0).map((s) => ({ label: s.label, value: s.sharePercent ?? 0 }))}
                    label="Sales by source"
                  />
                  <DataTable
                    rows={d.data.bySource}
                    rowKey={(r) => r.source}
                    exportName="Sales by source"
                    initialSort={{ key: 'sales', dir: 'desc' }}
                    minWidth={0}
                    columns={[
                      { key: 'source', header: 'Source', sortValue: (r) => r.label },
                      { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.grossSales, render: (r) => formatMoney(r.grossSales) },
                      { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders), hideOnPhone: true },
                      { key: 'share', header: 'Share', align: 'right', sortValue: (r) => r.sharePercent, render: (r) => formatPercent(r.sharePercent) },
                      ...(range.compare
                        ? [
                            {
                              key: 'change',
                              header: 'Change',
                              align: 'right' as const,
                              sortValue: (r: { deltaPercent: number | null }) => r.deltaPercent,
                              render: (r: { deltaPercent: number | null; previousGrossSales: number; grossSales: number }) => (
                                <DeltaBadge value={r.deltaPercent} isNew={r.previousGrossSales === 0 && r.grossSales > 0} />
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Stack>
              ) : (
                <Stack gap="sm">
                  <ShareDonut data={d.data.trafficSources.map((s) => ({ label: humanize(s.platform), value: s.percent }))} label="Reel orders by platform" />
                  <DataTable
                    rows={d.data.trafficSources}
                    rowKey={(r) => r.platform}
                    exportName="Reel orders by platform"
                    initialSort={{ key: 'percent', dir: 'desc' }}
                    minWidth={0}
                    columns={[
                      { key: 'platform', header: 'Platform', sortValue: (r) => humanize(r.platform) },
                      { key: 'percent', header: 'Share of reel orders', align: 'right', sortValue: (r) => r.percent, render: (r) => formatPercent(r.percent) },
                    ]}
                  />
                </Stack>
              )
            }
          </Widget>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
