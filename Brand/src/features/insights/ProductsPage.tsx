import { useState } from 'react';
import { Anchor, Avatar, Badge, Grid, Group, Rating, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatMoney, formatNumber } from '../../lib/format';
import { INSIGHTS_KEY, insightsApi, severityColor, severityLabel, StoreActionKind, storeActionLabel } from './api';
import { BarsChart, DataTable, DeltaBadge, formatPercent, KpiGrid, MetricTile, Notes, rangeKey, Stat, TrendChart, useRange, Widget, type Column } from './components';
import { newInsightsApi, preferInsights, type ProductInsightsPage } from './contracts';
import {
  momentumLabel,
  productRowFromInsight,
  productRowsFromTop,
  risingFalling,
  stockStatusColor,
  stockStatusLabel,
  type KpiSpec,
  type ProductRow,
} from './model';
import { alignCompare, bucketSeries, deltaPercent, pointDelta } from './period';

function ProductName({ id, name, thumb }: { id: string; name: string; thumb: string | null }) {
  return (
    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
      <Avatar src={thumb ?? undefined} size={30} radius="sm" color="forest">
        {name.slice(0, 1)}
      </Avatar>
      <Anchor component={Link} to={`/products/${id}`} size="sm" style={{ overflowWrap: 'anywhere' }}>
        {name}
      </Anchor>
    </Group>
  );
}

function MoveList({ rows, empty }: { rows: ProductRow[]; empty: string }) {
  if (rows.length === 0)
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  return (
    <Stack gap={8}>
      {rows.map((r) => (
        <Group key={r.productId} justify="space-between" wrap="nowrap" gap="xs">
          <Anchor component={Link} to={`/products/${r.productId}`} size="sm" truncate style={{ minWidth: 0 }}>
            {r.name}
          </Anchor>
          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Text size="sm" c="dimmed">
              {formatMoney(r.revenue)}
            </Text>
            <DeltaBadge value={r.changePercent} isNew={r.momentum === 'new'} />
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

function funnelKpis(f: ProductInsightsPage['funnel']): KpiSpec[] {
  const count = (key: string, label: string, m: { current: number; previous: number }, hint?: string): KpiSpec => ({
    key,
    label,
    value: formatNumber(m.current),
    previous: formatNumber(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
    hint,
  });
  return [
    count('views', 'Product views', f.productViews),
    { ...count('carts', 'Added to cart', f.addToCarts), hint: `${formatPercent(f.viewToCartPercent.current)} of views` },
    { ...count('orders', 'Orders', f.orders), hint: `${formatPercent(f.cartToOrderPercent.current)} of carts` },
    {
      key: 'conversion',
      label: 'Views → orders',
      value: formatPercent(f.viewToOrderPercent.current),
      previous: formatPercent(f.viewToOrderPercent.previous),
      delta: pointDelta(f.viewToOrderPercent.current, f.viewToOrderPercent.previous),
      unit: 'points',
    },
  ];
}

function ProductDeepDive({ products }: { products: { id: string; name: string }[] }) {
  const range = useRange();
  const [id, setId] = useState<string | null>(products[0]?.id ?? null);
  const detail = useQuery({
    queryKey: [INSIGHTS_KEY, 'product', id, rangeKey(range)],
    queryFn: () => insightsApi.productAnalytics(id!, range.current),
    enabled: !!id,
    staleTime: 60_000,
  });
  return (
    <Widget
      title="One product in detail"
      action={
        <Select
          aria-label="Product"
          size="xs"
          w={240}
          searchable
          data={products.map((p) => ({ value: p.id, label: p.name }))}
          value={id}
          onChange={setId}
          allowDeselect={false}
        />
      }
      query={detail}
      testId="product-deep-dive"
    >
      {(d) => {
        const stars = [5, 4, 3, 2, 1].map((s) => ({ label: `${s}★`, value: Number(d.reviews.starDistribution?.[String(s)] ?? 0) }));
        return (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
              <MetricTile
                label="Revenue"
                value={formatMoney(d.revenue.current)}
                previous={formatMoney(d.revenue.previous)}
                delta={deltaPercent(d.revenue.current.amount, d.revenue.previous.amount)}
                compare={range.compare}
              />
              <MetricTile
                label="Units sold"
                value={formatNumber(d.unitsSold.current)}
                previous={formatNumber(d.unitsSold.previous)}
                delta={deltaPercent(d.unitsSold.current, d.unitsSold.previous)}
                compare={range.compare}
              />
              <MetricTile label="In stock" value={formatNumber(d.header.inStockUnits)} hint={d.header.isActive ? 'Live' : 'Not live'} compare={false} tone="gray" />
              <MetricTile
                label="Rating"
                value={d.reviews.reviewCount > 0 ? d.reviews.averageRating.toFixed(1) : '—'}
                hint={`${formatNumber(d.reviews.reviewCount)} reviews`}
                compare={false}
                tone="amber"
              />
            </SimpleGrid>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Text fw={600} size="sm" mb={6}>
                  Revenue
                </Text>
                <TrendChart
                  points={alignCompare(
                    bucketSeries(
                      d.revenueTrend.map((p) => ({ date: p.date, value: p.amount.amount })),
                      range.current,
                      range.grain,
                    ),
                    null,
                  )}
                  kind="money"
                  label="Product revenue"
                  compare={false}
                  height={200}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Text fw={600} size="sm" mb={6}>
                  Top cities
                </Text>
                {d.locations.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No orders in this period.
                  </Text>
                ) : (
                  <DataTable
                    rows={d.locations}
                    rowKey={(r) => r.region}
                    exportName={`Cities ${d.header.title}`}
                    initialSort={{ key: 'revenue', dir: 'desc' }}
                    minWidth={0}
                    pageSize={5}
                    columns={[
                      { key: 'region', header: 'City', sortValue: (r) => r.region },
                      { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orderCount, render: (r) => formatNumber(r.orderCount) },
                      { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.revenue.amount, render: (r) => formatMoney(r.revenue) },
                    ]}
                  />
                )}
                {d.reviews.reviewCount > 0 && (
                  <Stack gap={4} mt="md">
                    <Group gap="xs">
                      <Rating value={d.reviews.averageRating} fractions={10} readOnly size="sm" />
                      <Text size="sm" c="dimmed">
                        {d.reviews.averageRating.toFixed(1)} from {formatNumber(d.reviews.reviewCount)}
                      </Text>
                    </Group>
                    <BarsChart data={stars} kind="count" label="Reviews by stars" height={150} horizontal />
                  </Stack>
                )}
              </Grid.Col>
            </Grid>
          </Stack>
        );
      }}
    </Widget>
  );
}

export default function ProductsPage() {
  const range = useRange();
  const key = rangeKey(range);

  const products = useQuery({
    queryKey: [INSIGHTS_KEY, 'products', key, range.compare],
    queryFn: () =>
      preferInsights(
        () => newInsightsApi.products(range.current),
        async () => {
          const [cur, prev] = await Promise.all([
            insightsApi.topProducts(range.current, 100),
            range.compare ? insightsApi.topProducts(range.previous, 100) : Promise.resolve(null),
          ]);
          return { cur, prev };
        },
      ),
    staleTime: 60_000,
  });
  const actions = useQuery({ queryKey: [INSIGHTS_KEY, 'store-actions'], queryFn: insightsApi.storeActions, staleTime: 60_000 });
  const twin = useQuery({ queryKey: [INSIGHTS_KEY, 'digital-twin'], queryFn: insightsApi.digitalTwin, staleTime: 60_000, enabled: products.data?.source === 'legacy' });

  const rows = {
    isPending: products.isPending,
    error: products.error,
    data: products.data
      ? products.data.source === 'insights'
        ? products.data.data.items.map(productRowFromInsight)
        : productRowsFromTop(products.data.data.cur.items, products.data.data.prev?.items ?? null)
      : undefined,
    refetch: () => void products.refetch(),
  };
  const isNew = products.data?.source === 'insights';
  const page = products.data?.source === 'insights' ? products.data.data : null;

  const optional = (c: Column<ProductRow>, when: boolean) => (when ? [c] : []);
  const bestColumns: Column<ProductRow>[] = [
    { key: 'name', header: 'Product', sortValue: (r) => r.name, render: (r) => <ProductName id={r.productId} name={r.name} thumb={r.thumbnailUrl} /> },
    ...optional({ key: 'views', header: 'Views', align: 'right', hideOnPhone: true, sortValue: (r) => r.views, render: (r) => formatNumber(r.views) }, isNew),
    ...optional({ key: 'carts', header: 'To cart', align: 'right', hideOnPhone: true, sortValue: (r) => r.carts, render: (r) => formatNumber(r.carts) }, isNew),
    { key: 'units', header: 'Units', align: 'right', sortValue: (r) => r.units, render: (r) => formatNumber(r.units) },
    { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.revenue, render: (r) => formatMoney(r.revenue) },
    ...optional({ key: 'conversion', header: 'Conversion', align: 'right', sortValue: (r) => r.viewToOrder, render: (r) => formatPercent(r.viewToOrder) }, isNew),
    ...optional({ key: 'prevRevenue', header: 'Previous', align: 'right', hideOnPhone: true, sortValue: (r) => r.prevRevenue, render: (r) => formatMoney(r.prevRevenue ?? 0) }, range.compare),
    ...optional(
      {
        key: 'change',
        header: 'Change',
        align: 'right',
        sortValue: (r) => r.changePercent,
        render: (r) => <DeltaBadge value={r.changePercent} isNew={r.momentum === 'new'} />,
      },
      range.compare,
    ),
    ...optional(
      {
        key: 'rating',
        header: 'Rating',
        align: 'right',
        hideOnPhone: true,
        sortValue: (r) => r.rating,
        render: (r) => (r.rating === null ? '—' : `${r.rating.toFixed(1)} (${formatNumber(r.reviews)})`),
      },
      isNew,
    ),
  ];

  return (
    <Stack gap="md">
      <Widget title="From view to order" description="How many shoppers saw, carted and bought your products" query={products} notYet="The view → cart → order funnel" testId="product-funnel">
        {(d) =>
          d.source === 'insights' ? (
            <Stack gap="xs">
              <KpiGrid specs={funnelKpis(d.data.funnel)} compare={range.compare} />
              <Notes notes={d.data.notes} />
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" data-testid="state-not-yet">
              Product views and add-to-carts will show here once StyleMint switches this report on for your shop.
            </Text>
          )
        }
      </Widget>

      <Widget
        title="Best sellers"
        description={range.compare ? 'With the change against the previous period' : undefined}
        query={rows}
        isEmpty={(r) => r.every((x) => x.units === 0 && (x.views ?? 0) === 0)}
        empty={<Text size="sm" c="dimmed">No products sold in this period yet.</Text>}
        testId="best-sellers"
      >
        {(r) => (
          <Stack gap={4}>
            <DataTable
              rows={r.filter((x) => x.units > 0 || (x.views ?? 0) > 0)}
              rowKey={(x) => x.productId}
              exportName="Best sellers"
              initialSort={{ key: 'revenue', dir: 'desc' }}
              minWidth={isNew ? 980 : 640}
              columns={bestColumns}
            />
            {page && page.totalCount > page.items.length && (
              <Text size="xs" c="dimmed">
                Showing your top {page.items.length} of {formatNumber(page.totalCount)} products by revenue.
              </Text>
            )}
          </Stack>
        )}
      </Widget>

      {range.compare && (
        <Widget title="Rising and falling" description="Revenue up or down by 20% or more against the previous period" query={rows} testId="rising-falling">
          {(r) => {
            const { rising, falling } = risingFalling(r);
            return (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <div>
                  <Badge color="forest" variant="light" mb={8}>
                    {momentumLabel.rising}
                  </Badge>
                  <MoveList rows={rising} empty="Nothing grew against the previous period." />
                </div>
                <div>
                  <Badge color="signal" variant="light" mb={8}>
                    {momentumLabel.falling}
                  </Badge>
                  <MoveList rows={falling} empty="Nothing dropped against the previous period." />
                </div>
              </SimpleGrid>
            );
          }}
        </Widget>
      )}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Widget
            title="Stock cover"
            description="Days until each product runs out at this period's pace"
            query={rows}
            notYet="Days of stock cover"
            isEmpty={(r) => r.every((x) => x.stockStatus === null) || r.filter((x) => x.daysOfCover !== null || x.stockStatus === 'out_of_stock').length === 0}
            empty={
              isNew ? (
                <Text size="sm" c="dimmed">
                  Nothing is running low.
                </Text>
              ) : (
                <Text size="sm" c="dimmed" data-testid="state-not-yet">
                  Days of stock cover per product will show here once StyleMint switches this report on for your shop.
                </Text>
              )
            }
            testId="stock-cover"
          >
            {(r) => (
              <Stack gap="xs">
                {page && (
                  <Group gap={6}>
                    {(['out_of_stock', 'critical', 'low', 'healthy'] as const).map((s) => (
                      <Badge key={s} variant="light" color={stockStatusColor[s]}>
                        {stockStatusLabel[s]}: {formatNumber(page.stock[s === 'out_of_stock' ? 'outOfStock' : s])}
                      </Badge>
                    ))}
                  </Group>
                )}
                <DataTable
                  rows={r.filter((x) => x.daysOfCover !== null || x.stockStatus === 'out_of_stock')}
                  rowKey={(x) => x.productId}
                  exportName="Stock cover"
                  initialSort={{ key: 'cover', dir: 'asc' }}
                  minWidth={560}
                  columns={[
                    { key: 'name', header: 'Product', sortValue: (x) => x.name, render: (x) => <ProductName id={x.productId} name={x.name} thumb={x.thumbnailUrl} /> },
                    { key: 'stock', header: 'In stock', align: 'right', sortValue: (x) => x.stockOnHand, render: (x) => formatNumber(x.stockOnHand) },
                    {
                      key: 'cover',
                      header: 'Days of cover',
                      align: 'right',
                      sortValue: (x) => (x.stockStatus === 'out_of_stock' ? 0 : x.daysOfCover),
                      render: (x) => (x.stockStatus === 'out_of_stock' ? '0' : x.daysOfCover === null ? '—' : x.daysOfCover.toFixed(1)),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      sortValue: (x) => (x.stockStatus ? stockStatusLabel[x.stockStatus] : ''),
                      render: (x) =>
                        x.stockStatus ? (
                          <Badge variant="light" color={stockStatusColor[x.stockStatus]}>
                            {stockStatusLabel[x.stockStatus]}
                          </Badge>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              </Stack>
            )}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Widget
            title="Returns per product"
            query={rows}
            isEmpty={(r) => !isNew || r.every((x) => !x.returnedUnits)}
            empty={
              isNew ? (
                <Text size="sm" c="dimmed">
                  Nothing was returned in this period.
                </Text>
              ) : (
                <Text size="sm" c="dimmed" data-testid="state-not-yet">
                  Returns per product will show here once StyleMint switches this report on for your shop.
                </Text>
              )
            }
            testId="returns"
          >
            {(r) => (
              <DataTable
                rows={r.filter((x) => (x.returnedUnits ?? 0) > 0)}
                rowKey={(x) => x.productId}
                exportName="Returns per product"
                initialSort={{ key: 'rate', dir: 'desc' }}
                minWidth={0}
                columns={[
                  { key: 'name', header: 'Product', sortValue: (x) => x.name, render: (x) => <ProductName id={x.productId} name={x.name} thumb={x.thumbnailUrl} /> },
                  { key: 'returned', header: 'Returned', align: 'right', sortValue: (x) => x.returnedUnits, render: (x) => formatNumber(x.returnedUnits) },
                  { key: 'rate', header: 'Return rate', align: 'right', sortValue: (x) => x.returnRate, render: (x) => formatPercent(x.returnRate) },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: page ? 12 : 8 }}>
          <Widget
            title="What needs attention"
            description="Restock before you run out; clear what is not moving"
            query={actions}
            isEmpty={(d) => d.actions.length === 0}
            empty={<Text size="sm" c="dimmed">Nothing needs attention right now.</Text>}
            testId="stock-risk"
          >
            {(d) => (
              <DataTable
                rows={d.actions}
                rowKey={(x) => `${x.kind}-${x.productId}-${x.productVariantId ?? ''}`}
                exportName="Product actions"
                initialSort={{ key: 'severity', dir: 'asc' }}
                columns={[
                  { key: 'product', header: 'Product', sortValue: (x) => x.productName, render: (x) => <ProductName id={x.productId} name={x.sku ? `${x.productName} (${x.sku})` : x.productName} thumb={null} /> },
                  {
                    key: 'issue',
                    header: 'Issue',
                    sortValue: (x) => storeActionLabel[x.kind] ?? 'Other',
                    render: (x) => (
                      <Badge variant="light" color={x.kind === StoreActionKind.ReturnsRising ? 'signal' : x.kind === StoreActionKind.SlowMovingStock ? 'gray' : 'amber'}>
                        {storeActionLabel[x.kind] ?? 'Other'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'severity',
                    header: 'Urgency',
                    sortValue: (x) => x.severity,
                    render: (x) => (
                      <Badge variant="dot" color={severityColor[x.severity] ?? 'gray'}>
                        {severityLabel[x.severity] ?? '—'}
                      </Badge>
                    ),
                    csv: (x) => severityLabel[x.severity] ?? '',
                  },
                  { key: 'recommendation', header: 'What to do', sortValue: (x) => x.recommendation },
                  { key: 'value', header: 'At stake', align: 'right', sortValue: (x) => x.valueAtStake?.amount ?? null, render: (x) => (x.valueAtStake ? formatMoney(x.valueAtStake) : '—') },
                ]}
              />
            )}
          </Widget>
        </Grid.Col>
        {!page && (
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Widget title="Stock today" query={twin} testId="stock-today">
              {(d) => (
                <SimpleGrid cols={2} spacing="sm">
                  <Stat label="Live products" value={formatNumber(d.activeProductCount)} />
                  <Stat label="Out of stock" value={formatNumber(d.outOfStockProductCount)} />
                  <Stat label="Low-stock variants" value={formatNumber(d.lowStockVariantCount)} />
                  <Stat label="Units on hand" value={formatNumber(d.totalUnitsOnHand)} />
                  <Stat label="Sold last 7 days" value={formatNumber(d.unitsSoldLast7Days)} hint="units" />
                  <Stat label="Flash sales live" value={formatNumber(d.activeFlashSaleCount)} />
                </SimpleGrid>
              )}
            </Widget>
          </Grid.Col>
        )}
      </Grid>

      {rows.data && rows.data.some((x) => x.units > 0) && (
        <ProductDeepDive products={rows.data.filter((x) => x.units > 0).sort((a, b) => b.revenue - a.revenue).map((x) => ({ id: x.productId, name: x.name }))} />
      )}

      <Anchor component={Link} to="/products" size="sm">
        Manage products <IconArrowRight size={12} />
      </Anchor>
    </Stack>
  );
}
