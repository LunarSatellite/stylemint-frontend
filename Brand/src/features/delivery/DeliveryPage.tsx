import { Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconStar, IconTruckDelivery } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { fromNow } from '../../lib/format';
import { POLL_MS } from '../../lib/live';
import { ordersApi, type SubOrderListItem } from '../orders/api';
import { OrderStateBadge } from '../orders/components';

function ParcelRow({ o, action }: { o: SubOrderListItem; action?: React.ReactNode }) {
  return (
    <Card padding="sm" withBorder>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={650} size="sm" component={Link} to={`/orders/${o.id}`} c="inherit" style={{ textDecoration: 'none' }}>
              #{o.orderNumber}
            </Text>
            <OrderStateBadge state={o.state} />
          </Group>
          <Text size="sm">{o.receiverName}</Text>
          <Text size="xs" c="dimmed">
            {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} · placed {fromNow(o.placedUtc)}
            {o.carrier ? ` · ${o.carrier}` : ''}
            {o.trackingNumber ? ` ${o.trackingNumber}` : ''}
          </Text>
        </div>
        {action}
      </Group>
    </Card>
  );
}

function ParcelList({
  states,
  queryId,
  empty,
  action,
  pageSize = 20,
}: {
  states: number[];
  queryId: string;
  empty: string;
  action?: (o: SubOrderListItem) => React.ReactNode;
  pageSize?: number;
}) {
  const q = useQuery({
    queryKey: ['delivery', queryId],
    queryFn: () => ordersApi.list({ states, pageSize }, null),
    refetchInterval: POLL_MS,
  });
  if (q.isPending) return <ListSkeleton rows={2} height={70} />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} title="Could not load parcels" />;
  const items = q.data.items.filter((o) => o.fulfillmentChannel === 'Delivery');
  if (items.length === 0) return <EmptyBlock title={empty} />;
  return (
    <Stack gap="xs">
      {items.map((o) => (
        <ParcelRow key={o.id} o={o} action={action?.(o)} />
      ))}
      {q.data.hasMore && (
        <Button component={Link} to="/orders?tab=packed" variant="subtle" size="xs">
          See all in Orders
        </Button>
      )}
    </Stack>
  );
}

/** Parcels waiting for a rider, on their way, and riders to rate. */
export default function DeliveryPage() {
  const waiting = useQuery({ queryKey: ['orders', 'count', 'packed'], queryFn: () => ordersApi.count([13, 4, 5]), refetchInterval: POLL_MS });
  const moving = useQuery({ queryKey: ['orders', 'count', 'shipping'], queryFn: () => ordersApi.count([14, 6, 10, 11]), refetchInterval: POLL_MS });
  const toPack = useQuery({ queryKey: ['orders', 'count', 'accepted'], queryFn: () => ordersApi.count([12]), refetchInterval: POLL_MS });

  return (
    <>
      <PageHeader title="Delivery" description="Hand parcels to StyleMint riders or your own courier, and follow them to the customer." />
      <SimpleGrid cols={{ base: 3 }} spacing="sm" mb="md">
        <KpiTile label="To pack" value={toPack.data ?? '–'} loading={toPack.isPending} tone="gray" to="/orders?tab=accepted" />
        <KpiTile label="Waiting for pickup" value={waiting.data ?? '–'} loading={waiting.isPending} tone={(waiting.data ?? 0) > 0 ? 'amber' : 'forest'} />
        <KpiTile label="On the way" value={moving.data ?? '–'} loading={moving.isPending} />
      </SimpleGrid>
      <Stack gap="md">
        <SectionCard title="Waiting for a delivery partner" description="Packed parcels. Find a StyleMint rider or hand over to your own courier.">
          <ParcelList
            states={[13]}
            queryId="packed"
            empty="No parcels are waiting for pickup"
            action={(o) => (
              <Button size="xs" component={Link} to={`/orders/${o.id}?partner=1`} leftSection={<IconTruckDelivery size={14} />}>
                Find a rider
              </Button>
            )}
          />
        </SectionCard>
        <SectionCard title="Ready to ship with your courier" description="Add the courier’s tracking number once it is collected.">
          <ParcelList
            states={[4, 5]}
            queryId="ready"
            empty="Nothing waiting for tracking"
            action={(o) => (
              <Button size="xs" variant="default" component={Link} to={`/orders/${o.id}`}>
                Add tracking
              </Button>
            )}
          />
        </SectionCard>
        <SectionCard title="On the way" description="The customer confirms delivery with the rider’s code — the order then shows Delivered by itself.">
          <ParcelList states={[14, 6, 10, 11]} queryId="moving" empty="No parcels on the way" />
        </SectionCard>
        <SectionCard title="Rate your riders" description="Ratings help every seller choose good delivery partners. You can rate for 7 days after pickup.">
          <ParcelList
            states={[14, 10, 11, 7]}
            queryId="rate"
            pageSize={10}
            empty="No recent rider deliveries"
            action={(o) => (
              <Button size="xs" variant="light" component={Link} to={`/orders/${o.id}`} leftSection={<IconStar size={14} />}>
                Rate rider
              </Button>
            )}
          />
        </SectionCard>
      </Stack>
    </>
  );
}
