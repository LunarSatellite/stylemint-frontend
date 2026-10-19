import { Alert, Anchor, Avatar, Badge, Button, Card, Divider, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArchive, IconArchiveOff, IconCalendarEvent, IconMapPin, IconReceiptRefund, IconTruck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import {
  CANCEL_REASON,
  channelLabel,
  isServiceLine,
  ORDER_STATE,
  ORDER_TONE,
  ordersApi,
  PAYMENT_METHOD,
  paymentsApi,
  REFUND_TAGS,
  SUB_ORDER_STATE,
  SUB_ORDER_TONE,
  type OrderDetail,
  type OrderLineBooking,
  type SubOrder,
  type SubOrderLine,
} from '@/api/orders';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, StatusBadge, When } from '@/components/Bits';
import { DetailDrawer } from '@/components/DetailDrawer';
import { EmptyBlock, ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { BOOKING_STATE, BOOKING_STATE_TONE, PAYMENT_MODE } from '@/api/services';
import { fmtDate, fmtMoney, maskPhone } from '@/lib/format';

export function OrderDrawer({ orderNumber, onClose }: { orderNumber: string | null | undefined; onClose: () => void }) {
  const opened = !!orderNumber;
  const order = useQuery({
    queryKey: ['orders', 'detail', orderNumber],
    queryFn: ({ signal }) => ordersApi.byNumber(orderNumber!, signal),
    enabled: opened,
    retry: (n, e) => !(e instanceof ApiError && e.isNotFound) && n < 2,
  });
  const o = order.data;
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={<span className="sm-mono">{orderNumber}</span>}
      subtitle={o ? `${o.shipTo.receiverName} · placed ${new Date(o.placedUtc).toLocaleString()}` : undefined}
      badges={
        o && (
          <>
            <Badge variant="light" color={ORDER_TONE[o.state]}>
              {ORDER_STATE[o.state]}
            </Badge>
            {o.archivedUtc && (
              <Badge variant="outline" color="gray">
                Hidden
              </Badge>
            )}
          </>
        )
      }
    >
      {order.error ? (
        order.error instanceof ApiError && order.error.isNotFound ? (
          <EmptyBlock title="No order with that number" body="Check the number - it looks like SM-… on the receipt." />
        ) : (
          <ErrorBlock error={order.error} onRetry={() => void order.refetch()} />
        )
      ) : !o ? (
        <Stack>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={260} radius="lg" />
        </Stack>
      ) : (
        <OrderCase order={o} />
      )}
    </DetailDrawer>
  );
}

function OrderCase({ order: o }: { order: OrderDetail }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['orders'] });

  const refund = async () => {
    let context;
    try {
      context = await paymentsApi.refundContext(o.id);
    } catch {
      context = null;
    }
    const intent = context?.paymentIntentId ?? o.paymentIntentId;
    const max = context?.refundableAmount ?? o.grandTotalAmount;
    const currency = context?.currency ?? o.grandTotalCurrency;
    open({
      title: `Refund order ${o.orderNumber}`,
      consequence: (
        <>
          Money goes back to the buyer through {PAYMENT_METHOD[o.paymentMethod] ?? 'the original payment'}. The order total is {fmtMoney(max, currency)}; earlier refunds are not subtracted
          here, so check the order’s history before refunding twice.{' '}
          {o.paymentMethod === 4 && 'This is cash on delivery: the refund is recorded as pending for a manual payout.'}
        </>
      ),
      confirmLabel: 'Issue refund',
      danger: true,
      fields: [
        { name: 'amount', kind: 'number', label: `Amount (${currency})`, required: true, min: 0.01, max, decimalScale: 2, defaultValue: String(max) },
        { name: 'tag', kind: 'select', label: 'Reason category', required: true, options: REFUND_TAGS },
        { name: 'reason', kind: 'textarea', label: 'Reason (kept in the audit log)', required: true, minLength: 5 },
      ],
      run: (v) => {
        if (!intent) return Promise.reject(new ApiError({ status: 400, message: 'This order has no payment to refund against.' }));
        const amount = Number(v.amount);
        if (!(amount > 0) || amount > max) return Promise.reject(new ApiError({ status: 400, message: `Enter an amount between 0.01 and ${max}.` }));
        return paymentsApi.refund(intent, { amount, currency, reasonTag: v.tag!, reason: v.reason!.trim() });
      },
      success: (r) => ((r as { state?: string })?.state === 'Pending' ? 'Refund recorded - pending with the provider or for manual payout.' : 'Refund completed.'),
      onDone: refresh,
    });
  };

  const archive = (hide: boolean) =>
    open({
      title: hide ? `Hide order ${o.orderNumber}` : `Unhide order ${o.orderNumber}`,
      consequence: hide
        ? 'Hidden orders drop out of vendor, buyer and admin lists and out of reports. Nothing is deleted; you can unhide it. Use this for test or demo orders.'
        : 'The order returns to every list and report.',
      confirmLabel: hide ? 'Hide order' : 'Unhide order',
      danger: hide,
      fields: [{ name: 'reason', kind: 'textarea', label: 'Reason', required: hide, minLength: hide ? 5 : undefined, placeholder: hide ? 'e.g. Test order placed during vendor onboarding' : undefined }],
      run: (v) => {
        const body = { orderIds: [o.id], reason: v.reason?.trim() || null, dryRun: false };
        return hide ? ordersApi.archive(body) : ordersApi.unarchive(body);
      },
      success: (r) => {
        const res = r as { changedCount?: number };
        return res?.changedCount === 0 ? 'Nothing changed - it was already in that state.' : hide ? 'Order hidden.' : 'Order unhidden.';
      },
      onDone: refresh,
    });

  return (
    <Stack gap="lg">
      {dialog}
      <Group gap="sm">
        {can('refund') && o.paymentIntentId && (
          <Button size="sm" variant="light" color="signal" leftSection={<IconReceiptRefund size={16} />} onClick={() => void refund()}>
            Refund…
          </Button>
        )}
        {can('archiveOrders') &&
          (o.archivedUtc ? (
            <Button size="sm" variant="default" leftSection={<IconArchiveOff size={16} />} onClick={() => archive(false)}>
              Unhide
            </Button>
          ) : (
            <Button size="sm" variant="default" leftSection={<IconArchive size={16} />} onClick={() => archive(true)}>
              Hide test order
            </Button>
          ))}
      </Group>

      {o.archivedUtc && (
        <Alert color="gray" variant="light" title="Hidden from lists and reports">
          {o.archivedReason ?? 'No reason recorded.'} · <When value={o.archivedUtc} />
        </Alert>
      )}
      {o.cancelledUtc && (
        <Alert color="signal" variant="light" title="Cancelled">
          {o.cancellationReasonCode ? CANCEL_REASON[o.cancellationReasonCode] : 'No reason'}
          {o.cancellationNote ? ` - “${o.cancellationNote}”` : ''} · <When value={o.cancelledUtc} />
        </Alert>
      )}

      <SectionCard title="Buyer & payment">
        <FieldGrid
          cols={3}
          fields={[
            { label: 'Receiver', value: o.shipTo.receiverName },
            { label: 'Phone', value: maskPhone(o.shipTo.receiverPhone) },
            { label: 'Buyer account', value: <IdText value={o.accountId} /> },
            {
              label: 'Ship to',
              wide: true,
              value: (
                <Group gap={6} wrap="nowrap" align="flex-start">
                  <IconMapPin size={14} style={{ marginTop: 3, flexShrink: 0 }} aria-hidden />
                  <span>
                    {[o.shipTo.addressLine1, o.shipTo.landmark, o.shipTo.city, o.shipTo.state, o.shipTo.zipCode, o.shipTo.country].filter(Boolean).join(', ')}
                    {o.shipTo.locationNote && <Text size="xs" c="dimmed">“{o.shipTo.locationNote}”</Text>}
                    {o.shipTo.mapsLink && /^https:\/\//i.test(o.shipTo.mapsLink) && (
                      <Anchor href={o.shipTo.mapsLink} target="_blank" rel="noopener noreferrer" size="xs">
                        Open map
                      </Anchor>
                    )}
                  </span>
                </Group>
              ),
            },
            { label: 'Payment', value: PAYMENT_METHOD[o.paymentMethod] ?? String(o.paymentMethod) },
            { label: 'Payment intent', value: <IdText value={o.paymentIntentId} /> },
            { label: 'Placed', value: <When value={o.placedUtc} /> },
          ]}
        />
        <Divider my="md" />
        <Stack gap={4} maw={360} ml="auto">
          <Row label="Items" value={fmtMoney(o.subtotalAmount, o.subtotalCurrency)} />
          <Row label="Shipping" value={fmtMoney(o.shippingTotalAmount, o.shippingTotalCurrency)} />
          {o.discountTotalAmount > 0 && <Row label="Discount" value={`− ${fmtMoney(o.discountTotalAmount, o.discountTotalCurrency)}`} />}
          <Row label={o.taxIncluded ? 'VAT (included)' : 'Tax'} value={fmtMoney(o.taxTotalAmount, o.taxTotalCurrency)} />
          <Divider />
          <Row label={o.hasServiceLines ? 'Total charged' : 'Total'} value={fmtMoney(o.grandTotalAmount, o.grandTotalCurrency)} strong />
          {(o.payAtVenueTotalAmount ?? 0) > 0 && (
            <Row label="Pay at venue (not through StyleMint)" value={fmtMoney(o.payAtVenueTotalAmount, o.payAtVenueTotalCurrency ?? o.grandTotalCurrency)} />
          )}
        </Stack>
      </SectionCard>

      {o.subOrders.map((s) => (
        <SubOrderCard key={s.id} sub={s} />
      ))}
    </Stack>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c={strong ? undefined : 'dimmed'} fw={strong ? 700 : undefined}>
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 500}>
        {value}
      </Text>
    </Group>
  );
}

/** Guest / traveller names, deduplicated (the booking never carries the buyer's contact details). */
export function bookingGuestNames(b: Pick<OrderLineBooking, 'guestName' | 'travellers'>): string[] {
  const names = [b.guestName, ...(b.travellers ?? []).map((t) => t.fullName)].map((n) => (n ?? '').trim()).filter(Boolean);
  return [...new Set(names)];
}

function BookingLineCard({ line }: { line: SubOrderLine }) {
  const { can } = useAuth();
  const b = line.booking;
  if (!b)
    return (
      <Card withBorder padding="sm" radius="md" data-testid={`booking-line-${line.id}`}>
        <Text size="sm" fw={600}>
          {line.productTitleSnapshot}
        </Text>
        <Text size="xs" c="dimmed">
          {line.optionLabel ?? 'Booking details not available yet.'}
        </Text>
      </Card>
    );
  const stay = b.kind === 1;
  const party = [stay && b.rooms ? `${b.rooms} room${b.rooms === 1 ? '' : 's'}` : null, `${b.adults} adult${b.adults === 1 ? '' : 's'}`, b.children ? `${b.children} child${b.children === 1 ? '' : 'ren'}` : null]
    .filter(Boolean)
    .join(' · ');
  const names = bookingGuestNames(b);
  return (
    <Card withBorder padding="sm" radius="md" bg="var(--sm-inset)" data-testid={`booking-line-${line.id}`}>
      <Stack gap="xs">
        <Group gap="sm" wrap="wrap" justify="space-between">
          <Group gap="sm" wrap="nowrap">
            <IconCalendarEvent size={18} aria-hidden />
            <div>
              <Text size="sm" fw={600}>
                {b.listingTitle || line.productTitleSnapshot}
              </Text>
              {b.itemName && (
                <Text size="xs" c="dimmed">
                  {b.itemName}
                </Text>
              )}
            </div>
          </Group>
          <Badge variant="light" color={BOOKING_STATE_TONE[b.state] ?? 'gray'}>
            {BOOKING_STATE[b.state] ?? `State ${b.state}`}
          </Badge>
        </Group>
        <FieldGrid
          cols={3}
          fields={[
            { label: 'Booking', value: <span className="sm-mono">{b.bookingNumber}</span> },
            { label: stay ? 'Dates' : 'Departs', value: stay ? `${fmtDate(b.startDate)} → ${fmtDate(b.endDate)}${b.nights != null ? ` (${b.nights} night${b.nights === 1 ? '' : 's'})` : ''}` : fmtDate(b.startDate) },
            { label: stay ? 'Guests' : 'Travellers', value: party },
            { label: 'Names', wide: true, value: names.length ? names.join(', ') : null },
            { label: 'Payment', value: b.paymentMode != null ? PAYMENT_MODE[b.paymentMode] ?? null : null },
            { label: 'Booking total', value: fmtMoney(b.totalPrice, b.currency) },
            { label: 'Paid now', value: <span data-testid="admin-paid-now">{fmtMoney(b.paidNowAmount, b.currency)}</span> },
            { label: 'Pay at venue', value: <span data-testid="admin-pay-at-venue">{fmtMoney(b.payAtVenueAmount, b.currency)}</span> },
          ]}
        />
        {can('viewBookings') && (
          <Anchor component={Link} to={`/bookings?open=${encodeURIComponent(b.bookingId)}`} size="sm">
            Open booking
          </Anchor>
        )}
      </Stack>
    </Card>
  );
}

function SubOrderCard({ sub: s }: { sub: SubOrder }) {
  const serviceLines = s.lines.filter(isServiceLine);
  const productLines = s.lines.filter((l) => !isServiceLine(l));
  const isService = s.fulfillmentChannel === 'Service' || (s.lines.length > 0 && productLines.length === 0);
  const milestones: [string, string | null][] = [
    ['Accepted', s.acceptedUtc],
    ['Packed', s.packedUtc],
    ['Handed over', s.handedOverUtc],
    ['Shipped', s.shippedUtc],
    ['Out for delivery', s.outForDeliveryUtc],
    ['Delivered', s.deliveredUtc],
    ['Collected', s.collectedUtc],
  ];
  const reached = milestones.filter(([, at]) => !!at);
  return (
    <SectionCard
      title={
        <Group gap="sm">
          <span>{isService ? 'Vendor part · bookings' : 'Vendor part'}</span>
          <Badge variant="light" color={SUB_ORDER_TONE[s.state]}>
            {SUB_ORDER_STATE[s.state]}
          </Badge>
        </Group>
      }
      description={<IdText value={s.vendorAccountId} />}
    >
      <Stack gap="md">
        {serviceLines.map((l) => (
          <BookingLineCard key={l.id} line={l} />
        ))}
        {productLines.length > 0 && (
          <Table.ScrollContainer minWidth={520}>
            <Table aria-label="Order lines" verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Line total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {productLines.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar src={l.thumbnailUrlSnapshot} radius="sm" size={36} alt="">
                          {l.productTitleSnapshot.slice(0, 1)}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {l.productTitleSnapshot}
                          </Text>
                          {(l.optionLabel || l.variantLabelSnapshot) && (
                            <Text size="xs" c="dimmed">
                              {l.optionLabel || l.variantLabelSnapshot}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{l.quantity}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(l.unitPriceAmount, l.unitPriceCurrency)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(l.lineSubtotalAmount, l.lineSubtotalCurrency)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <FieldGrid
          cols={3}
          fields={
            isService
              ? [
                  { label: 'Fulfilment', value: channelLabel(s.fulfillmentChannel) },
                  { label: 'Paid now (vendor part)', value: fmtMoney(s.subtotalAmount, s.subtotalCurrency) },
                  { label: 'Progress', value: s.deliveredUtc ? 'All bookings finished' : s.cancelledUtc ? 'Cancelled' : 'Bookings open' },
                ]
              : [
                  { label: 'Fulfilment', value: channelLabel(s.fulfillmentChannel) },
                  { label: 'Shipping fee', value: fmtMoney(s.shippingFeeAmount, s.shippingFeeCurrency) },
                  { label: 'Vendor total', value: fmtMoney(s.subtotalAmount, s.subtotalCurrency) },
                  { label: 'Carrier', value: s.carrier },
                  { label: 'Tracking', value: s.trackingNumber ? <span className="sm-mono">{s.trackingNumber}</span> : null },
                  { label: 'Progress', value: reached.length ? reached.map(([n]) => n).join(' → ') : 'Not started' },
                ]
          }
        />
        {s.cancelledUtc && (
          <Text size="sm" c="signal">
            Cancelled {s.cancellationReasonCode ? `- ${CANCEL_REASON[s.cancellationReasonCode]}` : ''} {s.cancellationNote ? `(“${s.cancellationNote}”)` : ''}
          </Text>
        )}
        {s.delivery && (
          <Card withBorder padding="sm" radius="md" bg="var(--sm-inset)">
            <Group gap="sm" wrap="wrap">
              <IconTruck size={18} aria-hidden />
              <Text size="sm" fw={600} className="sm-mono">
                {s.delivery.packageNumber}
              </Text>
              <StatusBadge value={s.delivery.status} />
              <Text size="sm" c="dimmed">
                {s.delivery.riderName ? `Rider: ${s.delivery.riderName}` : 'No rider yet'}
              </Text>
              {s.delivery.riderRating && (
                <Badge variant="light" color="amber">
                  {s.delivery.riderRating.stars} ★
                </Badge>
              )}
            </Group>
          </Card>
        )}
      </Stack>
    </SectionCard>
  );
}
