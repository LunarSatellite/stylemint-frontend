import { Anchor, Badge, Button, Card, Grid, Group, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowRight, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../auth/useSession';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { TrendBars } from '../../components/TrendBars';
import { formatMoney, formatMoneyCompact, formatNumber } from '../../lib/format';
import { POLL_MS } from '../../lib/live';
import { ordersApi } from '../orders/api';
import { OrderCard } from '../orders/components';
import { payoutsApi } from '../payouts/api';
import { productsApi } from '../products/api';
import { homeApi } from './api';

function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <Badge size="sm" variant="light" color={Math.abs(value) < 0.5 ? 'gray' : up ? 'forest' : 'signal'}>
      {up ? '+' : ''}
      {value.toFixed(0)}%
    </Badge>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function HomePage() {
  const account = useAccount();
  const [days, setDays] = useState('7');

  const overview = useQuery({ queryKey: ['home', 'overview', days], queryFn: () => homeApi.overview(Number(days)), staleTime: 60_000 });
  const toAct = useQuery({
    queryKey: ['home', 'to-act'],
    queryFn: () => ordersApi.list({ states: [2, 3, 12], pageSize: 5 }, null),
    refetchInterval: POLL_MS,
  });
  const countNew = useQuery({ queryKey: ['orders', 'count', 'new'], queryFn: () => ordersApi.count([2, 3]), refetchInterval: POLL_MS });
  const countPack = useQuery({ queryKey: ['orders', 'count', 'accepted'], queryFn: () => ordersApi.count([12]), refetchInterval: POLL_MS });
  const countHandover = useQuery({ queryKey: ['orders', 'count', 'packed'], queryFn: () => ordersApi.count([13, 4, 5]), refetchInterval: POLL_MS });
  const countMoving = useQuery({ queryKey: ['orders', 'count', 'shipping'], queryFn: () => ordersApi.count([14, 6, 10, 11]), refetchInterval: POLL_MS });
  const balance = useQuery({ queryKey: ['home', 'balance'], queryFn: payoutsApi.balance, staleTime: 60_000 });
  const snapshot = useQuery({ queryKey: ['home', 'store'], queryFn: productsApi.storeSnapshot, staleTime: 60_000, retry: false });

  const name = account.data?.displayName?.split(' ')[0];
  const actNow = (countNew.data ?? 0) + (countPack.data ?? 0) + (countHandover.data ?? 0);
  const ov = overview.data;

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        description={
          countNew.data
            ? `You have ${countNew.data} new ${countNew.data === 1 ? 'order' : 'orders'} waiting to be accepted.`
            : 'Here is how your shop is doing.'
        }
        actions={
          <Button component={Link} to="/products/new" leftSection={<IconPlus size={16} />}>
            Add product
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
        <KpiTile
          label="To act on"
          value={formatNumber(actNow)}
          hint={`${countNew.data ?? '–'} new · ${countPack.data ?? '–'} to pack · ${countHandover.data ?? '–'} to hand over`}
          tone={actNow > 0 ? 'amber' : 'forest'}
          to="/orders"
          loading={countNew.isPending}
        />
        <KpiTile
          label={`Sales · ${days} days`}
          value={ov ? formatMoneyCompact(ov.grossSales.current) : overview.error ? '—' : ''}
          hint={ov ? `${formatNumber(ov.totalOrders.current)} orders` : overview.error ? 'Could not load' : undefined}
          right={<Delta value={ov?.grossSales.deltaPercent} />}
          loading={overview.isPending}
        />
        <KpiTile
          label="On the way"
          value={formatNumber(countMoving.data ?? 0)}
          hint="Parcels with riders or couriers"
          tone="gray"
          to="/delivery"
          loading={countMoving.isPending}
        />
        <KpiTile
          label="Available to pay out"
          value={balance.data ? formatMoneyCompact({ amount: balance.data.availableValue, currency: balance.data.currency }) : balance.error ? '—' : ''}
          hint={
            balance.data
              ? `${formatMoney({ amount: balance.data.pendingValue, currency: balance.data.currency })} pending`
              : balance.error
                ? 'Could not load'
                : undefined
          }
          to="/payouts"
          loading={balance.isPending}
        />
      </SimpleGrid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <SectionCard
              title="Orders to act on"
              action={
                <Anchor component={Link} to="/orders" size="sm">
                  All orders <IconArrowRight size={12} />
                </Anchor>
              }
            >
              {toAct.isPending ? (
                <ListSkeleton rows={3} height={80} />
              ) : toAct.error ? (
                <ErrorBlock error={toAct.error} onRetry={() => void toAct.refetch()} title="Could not load orders" />
              ) : toAct.data.items.length === 0 ? (
                <EmptyBlock title="You are all caught up" body="New orders appear here as soon as customers pay." />
              ) : (
                <Stack gap="sm">
                  {toAct.data.items.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </Stack>
              )}
            </SectionCard>

            <SectionCard
              title="Sales"
              action={
                <Group gap="sm" wrap="nowrap">
                  <Anchor component={Link} to={`/insights/sales?range=${days}d`} size="sm">
                    Insights <IconArrowRight size={12} />
                  </Anchor>
                  <SegmentedControl
                    size="xs"
                    value={days}
                    onChange={setDays}
                    data={[
                      { label: '7 days', value: '7' },
                      { label: '30 days', value: '30' },
                    ]}
                    aria-label="Sales period"
                  />
                </Group>
              }
            >
              {overview.isPending ? (
                <ListSkeleton rows={2} height={60} />
              ) : overview.error ? (
                <ErrorBlock error={overview.error} onRetry={() => void overview.refetch()} title="Could not load sales" />
              ) : (
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                    <div>
                      <Text size="xs" c="dimmed">
                        Gross sales
                      </Text>
                      <Group gap={6}>
                        <Text fw={700} size="lg">
                          {formatMoney(ov!.grossSales.current)}
                        </Text>
                        <Delta value={ov!.grossSales.deltaPercent} />
                      </Group>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        You earn (after fees)
                      </Text>
                      <Text fw={700} size="lg">
                        {formatMoney(ov!.netRevenue.current)}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Orders
                      </Text>
                      <Group gap={6}>
                        <Text fw={700} size="lg">
                          {formatNumber(ov!.totalOrders.current)}
                        </Text>
                        <Delta value={ov!.totalOrders.deltaPercent} />
                      </Group>
                    </div>
                  </SimpleGrid>
                  {ov!.revenueTrend.length > 0 ? (
                    <TrendBars points={ov!.revenueTrend} />
                  ) : (
                    <Text size="sm" c="dimmed">
                      No sales in this period yet.
                    </Text>
                  )}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <SectionCard title="Stock">
              {snapshot.isPending ? (
                <ListSkeleton rows={2} height={40} />
              ) : snapshot.error ? (
                <ErrorBlock error={snapshot.error} onRetry={() => void snapshot.refetch()} title="Could not load stock" />
              ) : (
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Live products</Text>
                    <Text fw={650}>{formatNumber(snapshot.data.activeProductCount)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Low stock (5 or fewer)</Text>
                    <Badge color={snapshot.data.lowStockVariantCount > 0 ? 'amber' : 'gray'} variant="light">
                      {snapshot.data.lowStockVariantCount}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Out of stock</Text>
                    <Badge color={snapshot.data.outOfStockProductCount > 0 ? 'signal' : 'gray'} variant="light">
                      {snapshot.data.outOfStockProductCount}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Sold in the last 7 days</Text>
                    <Text fw={650}>{formatNumber(snapshot.data.unitsSoldLast7Days)} units</Text>
                  </Group>
                  {(snapshot.data.lowStockVariantCount > 0 || snapshot.data.outOfStockProductCount > 0) && (
                    <Button component={Link} to="/products?stock=low" variant="light" color="amber" size="xs" mt={4}>
                      Restock now
                    </Button>
                  )}
                </Stack>
              )}
            </SectionCard>

            <SectionCard title="Top products" description={`Last ${days} days`}>
              {overview.isPending ? (
                <ListSkeleton rows={3} height={36} />
              ) : overview.error ? (
                <Text size="sm" c="dimmed">
                  Could not load.
                </Text>
              ) : ov!.topProducts.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No sales in this period yet.
                </Text>
              ) : (
                <Stack gap="xs">
                  {ov!.topProducts.map((p) => (
                    <Group key={p.productId} justify="space-between" wrap="nowrap">
                      <Anchor component={Link} to={`/products/${p.productId}`} size="sm" truncate style={{ minWidth: 0 }}>
                        {p.name}
                      </Anchor>
                      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                        {p.unitsSold} sold · {formatMoneyCompact(p.totalRevenue)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </SectionCard>

            <Card>
              <Text fw={650}>Pending deliveries</Text>
              <Text size="sm" c="dimmed" mb="sm">
                {countHandover.data ?? 0} parcels waiting for a rider or courier.
              </Text>
              <Button component={Link} to="/delivery" variant="default" size="xs" rightSection={<IconArrowRight size={14} />}>
                Open delivery
              </Button>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
