import { useState } from 'react';
import { Avatar, Card, Group, Progress, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { DataList } from '../../components/DataList';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { TrendBars } from '../../components/TrendBars';
import { formatCompact, formatDate, formatMoney, formatNumber, formatPercent, formatPercentValue } from '../../lib/format';
import { analyticsApi, topReelsSortLabel, TopReelsSort, type TopProduct, type TopReel } from './api';
import { DeltaBadge, RangePicker, useRange } from './components';

function Funnel({ stages }: { stages: { label: string; count: number; percentOfTop: number; note?: string }[] }) {
  return (
    <Stack gap="sm">
      {stages.map((s) => (
        <div key={s.label}>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={600}>
              {s.label}
            </Text>
            <Text size="sm">
              {formatNumber(s.count)} <Text span c="dimmed" size="xs">({formatPercentValue(s.percentOfTop)})</Text>
            </Text>
          </Group>
          <Progress value={Math.min(100, s.percentOfTop)} color="forest" aria-label={`${s.label}: ${formatPercentValue(s.percentOfTop)} of views`} />
          {s.note && (
            <Text size="xs" c="dimmed" mt={2}>
              {s.note}
            </Text>
          )}
        </div>
      ))}
    </Stack>
  );
}

function TopReelsCard({ window }: { window: { fromUtc?: string; toUtc?: string } }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<string>(String(TopReelsSort.MostViewed));
  const reels = useQuery({
    queryKey: ['analytics', 'top-reels', window, sort],
    queryFn: () => analyticsApi.topReels({ ...window, sortBy: Number(sort), limit: 25 }),
    placeholderData: keepPreviousData,
  });
  return (
    <SectionCard
      title="Reels"
      description="Per-reel views, engagement, sales and commission in this period."
      action={
        <Select
          aria-label="Sort reels by"
          w={190}
          data={Object.entries(topReelsSortLabel).map(([value, label]) => ({ value, label }))}
          value={sort}
          onChange={(v) => v && setSort(v)}
          allowDeselect={false}
        />
      }
    >
      {reels.isPending ? (
        <ListSkeleton rows={4} />
      ) : reels.error ? (
        <ErrorBlock error={reels.error} onRetry={() => void reels.refetch()} title="Could not load your reels’ numbers" />
      ) : reels.data.length === 0 ? (
        <EmptyBlock title="No reel activity in this period" body="Publish a reel and its views, saves and sales show up here." />
      ) : (
        <DataList<TopReel>
          items={reels.data}
          rowKey={(r) => r.reelId}
          caption="Reel performance"
          onOpen={(r) => navigate(`/reels/${r.reelId}?tab=analytics`)}
          cardTitle={(r) => (
            <Group gap="sm" wrap="nowrap">
              <Avatar src={r.thumbnailUrl ?? undefined} radius="sm" size={40} />
              <Text size="sm" fw={600} lineClamp={2}>
                {r.title || 'Untitled reel'}
              </Text>
            </Group>
          )}
          columns={[
            {
              key: 'reel',
              header: 'Reel',
              hideOnCard: true,
              render: (r) => (
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={r.thumbnailUrl ?? undefined} radius="sm" size={36} />
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {r.title || 'Untitled reel'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(r.publishedAtUtc)}
                    </Text>
                  </div>
                </Group>
              ),
            },
            { key: 'views', header: 'Views', align: 'right', render: (r) => formatCompact(r.views) },
            { key: 'likes', header: 'Likes', align: 'right', render: (r) => formatCompact(r.likes) },
            { key: 'comments', header: 'Comments', align: 'right', render: (r) => formatCompact(r.comments) },
            { key: 'shares', header: 'Shares', align: 'right', render: (r) => formatCompact(r.shares) },
            { key: 'sales', header: 'Sales', align: 'right', render: (r) => formatNumber(r.sales) },
            { key: 'earnings', header: 'Commission', align: 'right', render: (r) => <b>{formatMoney(r.earnings)}</b> },
          ]}
        />
      )}
    </SectionCard>
  );
}

export function TopProductsList({ products }: { products: TopProduct[] }) {
  if (products.length === 0)
    return <EmptyBlock title="No product sales in this period" body="Products you tag earn you commission when someone buys from your reel." />;
  return (
    <DataList<TopProduct>
      items={products}
      rowKey={(p) => p.productId}
      caption="Products that earned you commission"
      cardTitle={(p) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={p.thumbnailUrl ?? undefined} radius="sm" size={36} />
          <Text size="sm" fw={600} lineClamp={2}>
            {p.name}
          </Text>
        </Group>
      )}
      columns={[
        {
          key: 'product',
          header: 'Product',
          hideOnCard: true,
          render: (p) => (
            <Group gap="sm" wrap="nowrap">
              <Avatar src={p.thumbnailUrl ?? undefined} radius="sm" size={32} />
              <Text size="sm" fw={600} lineClamp={1}>
                {p.name}
              </Text>
            </Group>
          ),
        },
        { key: 'sales', header: 'Sales', align: 'right', render: (p) => formatNumber(p.totalSales) },
        { key: 'rate', header: 'Rate', align: 'right', render: (p) => formatPercentValue(p.commissionRatePercent) },
        { key: 'avg', header: 'Per sale', align: 'right', render: (p) => formatMoney(p.avgCommissionPerSale) },
        { key: 'total', header: 'Commission', align: 'right', render: (p) => <b>{formatMoney(p.totalCommission)}</b> },
      ]}
    />
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useRange(30);
  const overview = useQuery({
    queryKey: ['analytics', 'overview', range.window],
    queryFn: () => analyticsApi.overview(range.window),
    placeholderData: keepPreviousData,
  });
  const report = useQuery({
    queryKey: ['analytics', 'report', range.window],
    queryFn: () => analyticsApi.report(range.window),
    placeholderData: keepPreviousData,
  });
  const o = overview.data;
  const r = report.data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your reels perform and what they earn. Compared with the same length of time just before."
        actions={<RangePicker value={range} onChange={setRange} />}
      />
      {overview.error ? (
        <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} title="Could not load your analytics" />
      ) : (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
          <KpiTile label="Views" value={o ? formatCompact(o.totalViews.current) : ''} loading={overview.isPending} right={o && <DeltaBadge value={o.totalViews.deltaPercent} />} />
          <KpiTile label="Sales" value={o ? formatNumber(o.totalSales.current) : ''} loading={overview.isPending} right={o && <DeltaBadge value={o.totalSales.deltaPercent} />} />
          <KpiTile
            label="Conversion"
            value={o ? formatPercent(o.conversionRate.current, 2) : ''}
            hint="Sales per view"
            loading={overview.isPending}
            right={o && <DeltaBadge value={o.conversionRate.deltaPercent} />}
          />
          <KpiTile
            label="Commission"
            value={o ? formatMoney(o.totalEarnings.current) : ''}
            hint={o ? `${formatMoney(o.pendingBalance)} pending` : undefined}
            loading={overview.isPending}
            right={o && <DeltaBadge value={o.totalEarnings.deltaPercent} />}
            to="/earnings"
          />
        </SimpleGrid>
      )}

      <Stack gap="md">
        <SectionCard title="Commission per day" description={o ? `${formatDate(o.window.fromUtc)} – ${formatDate(o.window.toUtc)}` : undefined}>
          {overview.isPending ? (
            <ListSkeleton rows={1} height={120} />
          ) : overview.error ? (
            <Text size="sm" c="dimmed">
              Not available.
            </Text>
          ) : o && o.earningsTrend.some((p) => p.amount.amount > 0) ? (
            <TrendBars points={o.earningsTrend} />
          ) : (
            <EmptyBlock title="No commission in this period" />
          )}
        </SectionCard>

        <TopReelsCard window={range.window} />

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <SectionCard title="Products that earn" description="Commission per product, from every reel.">
            {overview.isPending ? (
              <ListSkeleton rows={3} />
            ) : overview.error ? (
              <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} />
            ) : (
              <TopProductsList products={o?.topProducts ?? []} />
            )}
          </SectionCard>

          <SectionCard title="From view to order" description="Clicks and add-to-carts are not measured yet; orders are counted per reel view.">
            {report.isPending ? (
              <ListSkeleton rows={3} height={36} />
            ) : report.error ? (
              <ErrorBlock error={report.error} onRetry={() => void report.refetch()} title="Could not load the funnel" />
            ) : r ? (
              <Stack gap="md">
                <Funnel
                  stages={[
                    { label: 'Views', ...r.conversionFunnel.views },
                    { label: 'Product clicks', ...r.conversionFunnel.clicks, note: r.conversionFunnel.clicks.count === 0 ? 'Not measured yet' : undefined },
                    { label: 'Added to cart', ...r.conversionFunnel.addedToCart, note: r.conversionFunnel.addedToCart.count === 0 ? 'Not measured yet' : undefined },
                    { label: 'Orders', ...r.conversionFunnel.orders },
                  ]}
                />
                <Group gap="xl">
                  <div>
                    <Text size="xs" c="dimmed">
                      Orders
                    </Text>
                    <Text fw={700}>{formatNumber(r.conversionMetrics.totalOrders)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Average order
                    </Text>
                    <Text fw={700}>{formatMoney(r.conversionMetrics.averageOrderValue)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Orders per view
                    </Text>
                    <Text fw={700}>{formatPercent(r.conversionMetrics.conversionRate, 2)}</Text>
                  </div>
                </Group>
              </Stack>
            ) : null}
          </SectionCard>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <SectionCard title="Audience" description="Where your viewers are and who they are.">
            {report.isPending ? (
              <ListSkeleton rows={3} height={28} />
            ) : report.error ? (
              <ErrorBlock error={report.error} onRetry={() => void report.refetch()} />
            ) : r && (r.topLocations.length > 0 || r.audienceDemographic.length > 0) ? (
              <Stack gap="sm">
                {r.topLocations.map((l) => (
                  <div key={l.city}>
                    <Group justify="space-between">
                      <Text size="sm">{l.city}</Text>
                      <Text size="sm">{formatPercentValue(l.percent)}</Text>
                    </Group>
                    <Progress value={l.percent} color="forest" size="sm" aria-hidden />
                  </div>
                ))}
                {r.audienceDemographic.map((a) => (
                  <Group key={a.ageRange} justify="space-between">
                    <Text size="sm">Age {a.ageRange}</Text>
                    <Text size="sm">{formatPercentValue(a.percent)}</Text>
                  </Group>
                ))}
              </Stack>
            ) : (
              <EmptyBlock title="Audience details aren’t available yet" body="StyleMint will show locations and age groups once enough viewers are measured." />
            )}
          </SectionCard>
          <SectionCard title="Best times to post">
            {report.isPending ? (
              <ListSkeleton rows={2} height={28} />
            ) : report.error ? (
              <ErrorBlock error={report.error} onRetry={() => void report.refetch()} />
            ) : r && r.bestPostingTimes.length > 0 ? (
              <Stack gap="xs">
                {r.bestPostingTimes.map((b) => (
                  <Card key={`${b.dayOfWeekLabel}-${b.startHourLocal}`} padding="sm">
                    <Text fw={600} size="sm">
                      {b.dayOfWeekLabel}, {String(b.startHourLocal).padStart(2, '0')}:00–{String(b.endHourLocal).padStart(2, '0')}:00
                    </Text>
                    {b.annotation && (
                      <Text size="xs" c="dimmed">
                        {b.annotation}
                      </Text>
                    )}
                  </Card>
                ))}
              </Stack>
            ) : (
              <EmptyBlock title="Not enough data yet" body="Keep posting — suggestions appear once there is a pattern." />
            )}
          </SectionCard>
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Commission counts settled sales net of returns. See every entry in <Link to="/earnings">Earnings</Link>.
        </Text>
      </Stack>
    </>
  );
}
