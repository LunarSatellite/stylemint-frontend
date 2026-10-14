import { useState } from 'react';
import { Anchor, Badge, Grid, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney, formatNumber, fromNow } from '../../lib/format';
import { creatorLabel, INSIGHTS_KEY, insightsApi } from './api';
import { DataTable, formatPercent, KpiGrid, Notes, rangeKey, useRange, Widget } from './components';
import { newInsightsApi, type Metric, type ReelInsight, type ReelInsightsPage } from './contracts';
import type { KpiSpec } from './model';
import { deltaPercent, pointDelta } from './period';

const reelPlatformLabel: Record<number, string> = { 1: 'Instagram', 2: 'TikTok', 3: 'YouTube Shorts', 4: 'Facebook' };

function reelKpis(t: ReelInsightsPage['totals']): KpiSpec[] {
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
  return [
    count('views', 'Views', t.views, { hint: `${formatNumber(t.reels)} reels` }),
    {
      key: 'completion',
      label: 'Watched to the end',
      value: formatPercent(t.completionRatePercent.current),
      previous: formatPercent(t.completionRatePercent.previous),
      delta: pointDelta(t.completionRatePercent.current, t.completionRatePercent.previous),
      unit: 'points',
    },
    count('engagement', 'Likes · saves · shares', {
      current: t.likes.current + t.saves.current + t.shares.current,
      previous: t.likes.previous + t.saves.previous + t.shares.previous,
      deltaPercent: null,
    }),
    count('detail', 'Product page visits', t.productDetailViews),
    count('carts', 'Added to cart', t.addToCarts),
    count('orders', 'Orders', t.orders),
    {
      key: 'sales',
      label: 'Sales from reels',
      value: formatMoney(t.grossSales.current),
      previous: formatMoney(t.grossSales.previous),
      delta: deltaPercent(t.grossSales.current, t.grossSales.previous),
      unit: 'percent',
      isNew: t.grossSales.previous === 0 && t.grossSales.current > 0,
    },
    {
      key: 'commission',
      label: 'Creator commission',
      value: formatMoney(t.creatorCommission.current),
      previous: formatMoney(t.creatorCommission.previous),
      delta: deltaPercent(t.creatorCommission.current, t.creatorCommission.previous),
      unit: 'percent',
      invert: true,
    },
  ];
}

function ReelTitle({ r }: { r: ReelInsight }) {
  return (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <Text size="sm" lineClamp={2} style={{ overflowWrap: 'anywhere' }}>
        {r.caption || 'Reel without a caption'}
      </Text>
      <Group gap={4}>
        <Badge size="xs" variant="light" color={r.isOwnReel ? 'blue' : 'forest'}>
          {r.isOwnReel ? 'Your reel' : 'Creator'}
        </Badge>
        <Text size="xs" c="dimmed">
          {reelPlatformLabel[r.sourcePlatform] ?? 'Reel'}
          {r.publishedAtUtc ? ` · ${formatDate(r.publishedAtUtc)}` : ''}
        </Text>
      </Group>
    </Stack>
  );
}

export default function ReelsPage() {
  const range = useRange();
  const key = rangeKey(range);
  const [filter, setFilter] = useState<'all' | 'own' | 'creators'>('all');
  const reels = useQuery({
    queryKey: [INSIGHTS_KEY, 'reels', key, filter],
    queryFn: () => newInsightsApi.reels(range.current, { filter: filter === 'all' ? undefined : filter }),
    staleTime: 60_000,
  });
  const approvals = useQuery({ queryKey: [INSIGHTS_KEY, 'reel-approvals'], queryFn: insightsApi.reelApprovals, staleTime: 60_000 });
  const partnerships = useQuery({ queryKey: [INSIGHTS_KEY, 'partnerships'], queryFn: insightsApi.partnerships, staleTime: 300_000 });
  const byPartnership = new Map((partnerships.data?.items ?? []).map((p) => [p.id, p]));

  return (
    <Stack gap="md">
      <Widget title="Your reels at a glance" query={reels} notYet="Views, engagement and sales from reels" testId="reel-kpis">
        {(d) => (
          <Stack gap="xs">
            <KpiGrid specs={reelKpis(d.totals)} compare={range.compare} />
            <Notes notes={d.notes} />
          </Stack>
        )}
      </Widget>

      <Widget
        title="Every reel"
        description="Reels that tag your products — yours and creators' — and what each one sold"
        action={
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Yours', value: 'own' },
              { label: 'Creators', value: 'creators' },
            ]}
            aria-label="Whose reels"
          />
        }
        query={reels}
        notYet="Per-reel results"
        isEmpty={(d) => d.items.length === 0}
        empty={<Text size="sm" c="dimmed">No reels tag your products in this period.</Text>}
        testId="reel-table"
      >
        {(d) => (
          <Stack gap={4}>
            <DataTable
              rows={d.items}
              rowKey={(r) => r.reelId}
              exportName="Reels"
              initialSort={{ key: 'sales', dir: 'desc' }}
              minWidth={1000}
              columns={[
                { key: 'reel', header: 'Reel', sortValue: (r) => r.caption ?? '', render: (r) => <ReelTitle r={r} />, csv: (r) => r.caption ?? '' },
                { key: 'views', header: 'Views', align: 'right', sortValue: (r) => r.views, render: (r) => formatNumber(r.views) },
                { key: 'completion', header: 'Watched to end', align: 'right', sortValue: (r) => r.completionRatePercent, render: (r) => formatPercent(r.completionRatePercent), hideOnPhone: true },
                { key: 'likes', header: 'Likes', align: 'right', sortValue: (r) => r.likes, render: (r) => formatNumber(r.likes), hideOnPhone: true },
                { key: 'saves', header: 'Saves', align: 'right', sortValue: (r) => r.saves, render: (r) => formatNumber(r.saves), hideOnPhone: true },
                { key: 'shares', header: 'Shares', align: 'right', sortValue: (r) => r.shares, render: (r) => formatNumber(r.shares), hideOnPhone: true },
                { key: 'detail', header: 'Product visits', align: 'right', sortValue: (r) => r.productDetailViews, render: (r) => formatNumber(r.productDetailViews), hideOnPhone: true },
                { key: 'carts', header: 'To cart', align: 'right', sortValue: (r) => r.addToCarts, render: (r) => formatNumber(r.addToCarts) },
                { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders) },
                { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.grossSales, render: (r) => formatMoney(r.grossSales) },
                { key: 'perk', header: 'Sales / 1k views', align: 'right', sortValue: (r) => r.salesPerThousandViews, render: (r) => formatMoney(r.salesPerThousandViews), hideOnPhone: true },
              ]}
            />
            {d.totalCount > d.items.length && (
              <Text size="xs" c="dimmed">
                Showing the top {d.items.length} of {formatNumber(d.totalCount)} reels by sales.
              </Text>
            )}
          </Stack>
        )}
      </Widget>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Widget
            title="Reels per product"
            query={reels}
            notYet="Reel results per product"
            isEmpty={(d) => d.byProduct.length === 0}
            empty={<Text size="sm" c="dimmed">No reel sold a product in this period.</Text>}
            testId="reel-products"
          >
            {(d) => (
              <DataTable
                rows={d.byProduct}
                rowKey={(r) => r.productId}
                exportName="Reels per product"
                initialSort={{ key: 'sales', dir: 'desc' }}
                minWidth={0}
                columns={[
                  {
                    key: 'product',
                    header: 'Product',
                    sortValue: (r) => r.productName ?? '',
                    render: (r) => (
                      <Anchor component={Link} to={`/products/${r.productId}`} size="sm">
                        {r.productName ?? 'Product'}
                      </Anchor>
                    ),
                  },
                  { key: 'reels', header: 'Reels', align: 'right', sortValue: (r) => r.reels },
                  { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orders, render: (r) => formatNumber(r.orders) },
                  { key: 'sales', header: 'Sales', align: 'right', sortValue: (r) => r.grossSales, render: (r) => formatMoney(r.grossSales) },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Widget
            title="Reels waiting for your approval"
            description="Creators' reels about your products go live after you approve them"
            query={approvals}
            isEmpty={(d) => d.length === 0}
            empty={
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  No reels are waiting for you.
                </Text>
                {reels.data && (
                  <Text size="xs" c="dimmed">
                    In this period: {formatNumber(reels.data.approvals.approvedInPeriod)} approved · {formatNumber(reels.data.approvals.rejectedInPeriod)} sent back
                  </Text>
                )}
              </Stack>
            }
            testId="reel-approvals"
          >
            {(d) => (
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge color="amber" variant="light">
                    {d.length} waiting
                  </Badge>
                  <Text size="xs" c="dimmed">
                    Oldest sent {fromNow([...d].sort((a, b) => a.submittedUtc.localeCompare(b.submittedUtc))[0].submittedUtc)}
                  </Text>
                </Group>
                <DataTable
                  rows={d}
                  rowKey={(r) => r.id}
                  exportName="Reels waiting for approval"
                  initialSort={{ key: 'submitted', dir: 'asc' }}
                  minWidth={0}
                  columns={[
                    { key: 'creator', header: 'Creator', sortValue: (r) => creatorLabel(byPartnership.get(r.partnershipId), r.creatorAccountId) },
                    { key: 'submitted', header: 'Sent', sortValue: (r) => r.submittedUtc, render: (r) => formatDate(r.submittedUtc) },
                    { key: 'round', header: 'Round', align: 'right', sortValue: (r) => r.round },
                    { key: 'note', header: 'Creator note', sortValue: (r) => r.creatorNote ?? '', render: (r) => r.creatorNote || '—', hideOnPhone: true },
                  ]}
                />
                {reels.data && (
                  <Text size="xs" c="dimmed">
                    In this period: {formatNumber(reels.data.approvals.approvedInPeriod)} approved · {formatNumber(reels.data.approvals.rejectedInPeriod)} sent back
                  </Text>
                )}
              </Stack>
            )}
          </Widget>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
