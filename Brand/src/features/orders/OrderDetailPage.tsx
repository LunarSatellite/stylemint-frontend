import { useState } from 'react';
import { Alert, Anchor, Avatar, Badge, Card, Divider, Grid, Group, Stack, Text, Timeline } from '@mantine/core';
import { IconExternalLink, IconInfoCircle, IconMapPin, IconPhone, IconPhoto } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, formatMoney, humanize } from '../../lib/format';
import { ordersApi, isMoving, SubOrderState, type SubOrderDetail } from './api';
import { ChannelBadge, OrderStateBadge } from './components';
import { DeliveryPartnerDrawer } from './DeliveryPartner';
import { OrderActionBar } from './OrderActions';
import { RiderRatingCard } from './RiderRatingCard';

const cancelReasons: Record<number, string> = {
  1: 'Ordered by mistake',
  2: 'Found a better price',
  3: 'Changed their mind',
  4: 'Delivery took too long',
  5: 'Needed a different size or colour',
  6: 'Other',
};

function nextStepHint(o: SubOrderDetail): string | null {
  const S = SubOrderState;
  switch (o.state) {
    case S.Paid:
    case S.AwaitingFulfillment:
      return 'New order — accept it if you can ship it, or reject it so the customer is refunded quickly.';
    case S.Accepted:
      return o.fulfillmentChannel === 'Delivery'
        ? 'Pack the items, close the parcel with a StyleMint seal, then mark it packed.'
        : 'Pack the items and mark them packed when they are ready for the customer to collect.';
    case S.Packed:
      return o.fulfillmentChannel === 'Delivery'
        ? 'Find a StyleMint delivery partner, or hand the parcel to your own courier.'
        : 'Waiting for the customer to collect. Mark it collected when they pick it up.';
    case S.HandedOver:
    case S.Shipped:
    case S.InTransit:
    case S.OutForDelivery:
      return 'On its way to the customer. Delivery is confirmed by the customer.';
    default:
      return null;
  }
}

function TimelineCard({ o }: { o: SubOrderDetail }) {
  const steps: { label: string; at: string | null }[] = [
    { label: 'Placed', at: o.placedUtc },
    { label: 'Accepted', at: o.acceptedUtc },
    { label: 'Packed', at: o.packedUtc },
    ...(o.fulfillmentChannel === 'StorePickup'
      ? [{ label: 'Collected', at: o.collectedUtc }]
      : [
          { label: 'Handed over', at: o.handedOverUtc },
          { label: 'Shipped', at: o.shippedUtc },
          { label: 'In transit', at: o.inTransitUtc },
          { label: 'Out for delivery', at: o.outForDeliveryUtc },
          { label: 'Delivered', at: o.deliveredUtc },
        ]),
  ];
  if (o.cancelledUtc) steps.push({ label: 'Cancelled', at: o.cancelledUtc });
  const lastDone = steps.reduce((acc, s, i) => (s.at ? i : acc), 0);
  return (
    <SectionCard title="Progress">
      <Timeline active={lastDone} bulletSize={18} lineWidth={2} color={o.cancelledUtc ? 'signal' : 'forest'}>
        {steps.map((s) => (
          <Timeline.Item key={s.label} title={s.label}>
            <Text size="xs" c="dimmed">
              {s.at ? formatDateTime(s.at) : '—'}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </SectionCard>
  );
}

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  // Deep link from Delivery: /orders/:id?partner=1 opens the delivery-partner drawer.
  const [partnerOpen, setPartnerOpen] = useState(params.get('partner') === '1');
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.detail(id),
    refetchInterval: (q) => {
      const s = (q.state.data as SubOrderDetail | undefined)?.state;
      return s !== undefined && isMoving(s) ? 15_000 : false;
    },
  });

  if (order.isPending) {
    return (
      <>
        <PageHeader title="Order" back={{ to: '/orders', label: 'Orders' }} />
        <ListSkeleton rows={4} height={110} />
      </>
    );
  }
  if (order.error || !order.data) {
    return (
      <>
        <PageHeader title="Order" back={{ to: '/orders', label: 'Orders' }} />
        <ErrorBlock
          error={order.error ?? new Error('Not found')}
          onRetry={() => void order.refetch()}
          title="Could not load this order"
        />
      </>
    );
  }

  const o = order.data;
  const a = o.shipTo;
  const hint = nextStepHint(o);
  const fee = { amount: o.shippingFeeAmount, currency: o.shippingFeeCurrency };

  return (
    <>
      <PageHeader
        title={`Order #${o.orderNumber}`}
        back={{ to: '/orders', label: 'Orders' }}
        meta={
          <Group gap="xs">
            <OrderStateBadge state={o.state} size="md" />
            <ChannelBadge channel={o.fulfillmentChannel} />
            <Text size="sm" c="dimmed">
              Placed {formatDateTime(o.placedUtc)}
            </Text>
          </Group>
        }
      />

      <Card mb="md" className="no-print">
        <Stack gap="sm">
          {hint && (
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <IconInfoCircle size={18} color="var(--sm-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <Text size="sm">{hint}</Text>
            </Group>
          )}
          <OrderActionBar order={o} onFindRider={() => setPartnerOpen(true)} />
        </Stack>
      </Card>

      {o.state === SubOrderState.Cancelled && (
        <Alert color="signal" variant="light" mb="md" title="This order was cancelled">
          {o.cancellationReasonCode ? `Customer’s reason: ${cancelReasons[o.cancellationReasonCode] ?? 'Other'}. ` : ''}
          {o.cancellationNote ?? ''}
        </Alert>
      )}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <SectionCard title="Items" description={`${o.itemCount} ${o.itemCount === 1 ? 'item' : 'items'}`}>
              <Stack gap="sm">
                {o.lines.map((l) => (
                  <Group key={l.id} wrap="nowrap" align="flex-start" justify="space-between">
                    <Group wrap="nowrap" align="flex-start" gap="sm" style={{ minWidth: 0 }}>
                      <Avatar src={l.thumbnailUrlSnapshot ?? undefined} radius="md" size={56} color="forest">
                        <IconPhoto size={20} />
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600}>
                          {l.productTitleSnapshot}
                        </Text>
                        {(l.optionLabel || l.variantLabelSnapshot) && (
                          <Text size="xs" c="dimmed">
                            {l.optionLabel ?? l.variantLabelSnapshot}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {l.quantity} × {formatMoney({ amount: l.unitPriceAmount, currency: l.unitPriceCurrency })}
                        </Text>
                      </div>
                    </Group>
                    <Text size="sm" fw={600} style={{ flexShrink: 0 }}>
                      {formatMoney({ amount: l.lineSubtotalAmount, currency: l.lineSubtotalCurrency })}
                    </Text>
                  </Group>
                ))}
                <Divider />
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Items
                  </Text>
                  <Text size="sm">{formatMoney({ amount: o.lineSubtotalAmount, currency: o.lineSubtotalCurrency })}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Shipping
                  </Text>
                  <Text size="sm">{formatMoney(fee)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Total</Text>
                  <Text fw={700}>{formatMoney({ amount: o.subtotalAmount, currency: o.subtotalCurrency })}</Text>
                </Group>
              </Stack>
            </SectionCard>

            {o.delivery && (
              <SectionCard title="Parcel">
                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Parcel number
                    </Text>
                    <Text size="sm" ff="monospace">
                      {o.delivery.packageNumber}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Status
                    </Text>
                    <Badge variant="light" color={o.delivery.awaitingConfirmation ? 'amber' : 'blue'}>
                      {o.delivery.awaitingConfirmation ? 'Waiting for customer to confirm' : humanize(o.delivery.status)}
                    </Badge>
                  </Group>
                  {o.delivery.riderName && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Rider
                      </Text>
                      <Text size="sm">{o.delivery.riderName}</Text>
                    </Group>
                  )}
                  {(o.carrier || o.trackingNumber) && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {o.carrier ?? 'Tracking'}
                      </Text>
                      <Text size="sm" ff="monospace">
                        {o.trackingNumber ?? '—'}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </SectionCard>
            )}
            {!o.delivery && (o.carrier || o.trackingNumber) && (
              <SectionCard title="Tracking">
                <Text size="sm">
                  {o.carrier} <b>{o.trackingNumber}</b>
                </Text>
              </SectionCard>
            )}
            <RiderRatingCard order={o} />
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <SectionCard title={o.fulfillmentChannel === 'StorePickup' ? 'Customer' : 'Deliver to'}>
              <Stack gap={4}>
                <Text fw={650}>{a.receiverName}</Text>
                {a.receiverPhone && (
                  <Anchor href={`tel:${a.receiverPhone}`} size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <IconPhone size={14} /> {a.receiverPhone}
                  </Anchor>
                )}
                {o.fulfillmentChannel === 'Delivery' && (
                  <>
                    <Text size="sm">{[a.addressLine1, a.landmark].filter(Boolean).join(', ')}</Text>
                    <Text size="sm">{[a.city, a.state, a.zipCode].filter(Boolean).join(', ')}</Text>
                    {a.locationNote && (
                      <Text size="sm" c="dimmed">
                        “{a.locationNote}”
                      </Text>
                    )}
                    {(a.mapsLink || (a.latitude !== null && a.longitude !== null)) && (
                      <Anchor
                        href={a.mapsLink ?? `https://maps.google.com/?q=${a.latitude},${a.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <IconMapPin size={14} /> Open in Maps <IconExternalLink size={12} />
                      </Anchor>
                    )}
                  </>
                )}
                {o.fulfillmentChannel === 'StorePickup' && (
                  <Text size="sm" c="dimmed">
                    The customer collects this order at your store.
                  </Text>
                )}
              </Stack>
            </SectionCard>
            <TimelineCard o={o} />
          </Stack>
        </Grid.Col>
      </Grid>

      {o.fulfillmentChannel === 'Delivery' && (
        <DeliveryPartnerDrawer order={o} opened={partnerOpen} onClose={() => setPartnerOpen(false)} />
      )}
    </>
  );
}
