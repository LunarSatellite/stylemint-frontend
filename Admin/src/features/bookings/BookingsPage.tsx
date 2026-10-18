import { useEffect } from 'react';
import { Badge, Button, Group, Select, Skeleton, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCalendarCheck, IconPercentage, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import {
  BOOKING_STATE,
  BOOKING_STATE_TONE,
  bookingsAdminApi,
  CANCELLED_BY,
  LISTING_KIND,
  PAYMENT_MODE,
  REFUND_FAILED,
  REFUND_STATE,
  type AdminBooking,
} from '@/api/services';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtDate, fmtMoney } from '@/lib/format';
import { CommissionSettingsPanel } from './CommissionSettingsPanel';

const STATE_OPTIONS = Object.entries(BOOKING_STATE).map(([value, label]) => ({ value, label }));
const KIND_OPTIONS = Object.entries(LISTING_KIND).map(([value, label]) => ({ value, label }));

export function BookingStateBadge({ state }: { state: number }) {
  return (
    <Badge variant="light" color={BOOKING_STATE_TONE[state] ?? 'gray'} size="sm">
      {BOOKING_STATE[state] ?? `State ${state}`}
    </Badge>
  );
}

const isMissing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;

/**
 * Hotel and travel bookings across every vendor (service-bookings-contract v1, Admin): find one by number, guest
 * name, vendor or status; cancel with or without the policy fee; retry a failed refund. The Commission tab sets the
 * percent per category and per vendor.
 */
export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'commission' ? 'commission' : 'bookings';
  return (
    <>
      <PageHeader
        title="Service bookings"
        description="Hotel stays and travel packages booked through StyleMint. Commission is taken per completed booking."
      />
      <Tabs value={tab} onChange={(v) => v && setParams(v === 'bookings' ? new URLSearchParams() : new URLSearchParams({ tab: v }), { replace: true })} keepMounted={false} variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="bookings" leftSection={<IconCalendarCheck size={16} />}>
            Bookings
          </Tabs.Tab>
          <Tabs.Tab value="commission" leftSection={<IconPercentage size={16} />}>
            Commission
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="bookings">
          <BookingsList />
        </Tabs.Panel>
        <Tabs.Panel value="commission">
          <CommissionSettingsPanel />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function BookingsList() {
  const list = useListState(['state', 'kind', 'vendor'] as const);
  const resetKey = [list.search, list.filters.state, list.filters.kind, list.filters.vendor, list.pageSize].join('|');
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['bookings', 'list', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) =>
      bookingsAdminApi.list(
        { q: list.search, state: list.filters.state, kind: list.filters.kind, vendorAccountId: list.filters.vendor, cursor: cursors.cursor, pageSize: list.pageSize, page: list.page },
        signal,
      ),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
    retry: false,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  if (isMissing(query.error)) return <NotAvailableBlock what="Service bookings" detail="The bookings module is not deployed on this server yet. Hotel and travel bookings will appear here once it is." />;

  const columns: Column<AdminBooking>[] = [
    { key: 'number', header: 'Booking', render: (b) => <TwoLine primary={<span className="sm-mono">{b.number}</span>} secondary={LISTING_KIND[b.kind]} /> },
    { key: 'guest', header: 'Guest', render: (b) => b.guestName },
    { key: 'vendor', header: 'Vendor', visibleFrom: 'sm', render: (b) => <TwoLine primary={b.vendor?.name ?? '—'} secondary={b.listingTitle} /> },
    { key: 'dates', header: 'Dates', visibleFrom: 'md', render: (b) => `${fmtDate(b.startDate)}${b.kind === 1 ? ` → ${fmtDate(b.endDate)}` : ''}` },
    { key: 'state', header: 'Status', render: (b) => <BookingStateBadge state={b.state} /> },
    { key: 'total', header: 'Total', align: 'right', visibleFrom: 'sm', render: (b) => fmtMoney(b.totalPrice, b.currency) },
    {
      key: 'refund',
      header: 'Refund',
      visibleFrom: 'lg',
      render: (b) =>
        b.refundState ? (
          <Badge variant="light" size="sm" color={b.refundState === REFUND_FAILED ? 'signal' : b.refundState === 2 ? 'forest' : 'amber'}>
            {REFUND_STATE[b.refundState]}
          </Badge>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <DataTable
        label="Service bookings"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(b) => b.id}
        onRowClick={(b) => list.open(b.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        filtered={list.filtered}
        emptyTitle="No bookings yet"
        emptyBody="Bookings appear here as soon as guests book a stay or a trip."
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput label="Search" placeholder="Booking number or guest name" leftSection={<IconSearch size={14} />} w={260} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
            <Select label="Status" w={200} clearable placeholder="Any" data={STATE_OPTIONS} value={list.filters.state || null} onChange={(v) => list.setFilter('state', v)} />
            <Select label="Type" w={170} clearable placeholder="Any" data={KIND_OPTIONS} value={list.filters.kind || null} onChange={(v) => list.setFilter('kind', v)} />
            <TextInput
              label="Vendor account ID"
              placeholder="Paste a vendor ID"
              w={300}
              value={list.filters.vendor}
              onChange={(e) => list.setFilter('vendor', e.currentTarget.value.trim() || null)}
              rightSection={
                list.filters.vendor ? (
                  <IconX size={14} style={{ cursor: 'pointer' }} aria-label="Clear vendor" onClick={() => list.setFilter('vendor', null)} />
                ) : undefined
              }
            />
          </Group>
        }
      />
      <BookingDrawer id={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function BookingDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['bookings', 'detail', id], queryFn: ({ signal }) => bookingsAdminApi.get(id!, signal), enabled: !!id });
  const b = q.data;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['bookings'] });
  const m = (n: number | null | undefined) => (n === null || n === undefined ? null : fmtMoney(n, b?.currency ?? 'NPR'));
  const cancellable = b && (b.state === 1 || b.state === 2);

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={b ? `Booking ${b.number}` : 'Booking'}
      subtitle={b ? `${b.listingTitle} · ${b.vendor?.name ?? 'Vendor'}` : undefined}
      badges={b && <BookingStateBadge state={b.state} />}
      actions={
        b &&
        can('manageBookings') && (
          <>
            {cancellable && (
              <Button
                size="sm"
                variant="light"
                color="signal"
                leftSection={<IconX size={16} />}
                onClick={() =>
                  open({
                    title: `Cancel booking ${b.number}`,
                    consequence: `The guest and the vendor are told. With the fee waived the guest gets back everything paid online (${fmtMoney(b.paidOnline, b.currency)}); otherwise the cancellation policy applies.`,
                    confirmLabel: 'Cancel booking',
                    danger: true,
                    fields: [
                      { name: 'reason', kind: 'textarea', label: 'Reason (shown to the guest and vendor, kept in the audit log)', required: true, minLength: 3 },
                      { name: 'waiveFee', kind: 'checkbox', label: 'Waive the cancellation fee (full refund)', defaultValue: 'true' },
                    ],
                    run: (f) => bookingsAdminApi.cancel(b.id, f.reason!.trim(), f.waiveFee === 'true'),
                    success: 'Booking cancelled.',
                    onDone: refresh,
                  })
                }
              >
                Cancel…
              </Button>
            )}
            {b.refundState === REFUND_FAILED && (
              <Button
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={() =>
                  open({
                    title: 'Retry the refund',
                    consequence: `StyleMint asks the payment provider again to refund ${fmtMoney(b.refundAmount ?? 0, b.currency)}.`,
                    confirmLabel: 'Retry refund',
                    run: () => bookingsAdminApi.retryRefund(b.id),
                    success: 'Refund retried.',
                    onDone: refresh,
                  })
                }
              >
                Retry refund
              </Button>
            )}
          </>
        )
      }
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !b ? (
        <Stack>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      ) : (
        <Stack gap="lg">
          <SectionCard title="Booking">
            <FieldGrid
              fields={[
                { label: 'Type', value: LISTING_KIND[b.kind] },
                { label: b.kind === 1 ? 'Room' : 'Package', value: b.kind === 1 ? `${b.rooms && b.rooms > 1 ? `${b.rooms} × ` : ''}${b.roomTypeName ?? '—'}` : b.listingTitle },
                { label: b.kind === 1 ? 'Check-in' : 'Departs', value: fmtDate(b.startDate) },
                { label: b.kind === 1 ? 'Check-out' : 'Returns', value: fmtDate(b.endDate) },
                { label: 'Guest', value: b.guestName },
                { label: 'Party', value: `${b.adults} adults${b.children ? `, ${b.children} children` : ''}` },
                { label: 'Travellers', value: b.travellers.length ? b.travellers.map((t) => t.fullName).join(', ') : null, wide: true },
                { label: 'Special requests', value: b.specialRequests, wide: true },
                { label: 'Buyer account', value: <IdText value={b.buyerAccountId} /> },
                { label: 'Vendor account', value: <IdText value={b.vendor?.vendorAccountId} /> },
                { label: 'Booked', value: <When value={b.createdUtc} /> },
                { label: 'Completed', value: <When value={b.completedUtc} /> },
              ]}
            />
          </SectionCard>
          <SectionCard title="Money">
            {b.lines.length > 0 && (
              <Table mb="md" aria-label="Price lines">
                <Table.Tbody>
                  {b.lines.map((l, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{l.label}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {l.quantity} × {fmtMoney(l.unitPrice, b.currency)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(l.amount, b.currency)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            <FieldGrid
              cols={3}
              fields={[
                { label: 'Total', value: m(b.totalPrice) },
                { label: 'Payment', value: `${PAYMENT_MODE[b.paymentMode] ?? '—'}${b.paymentMode === 2 ? ` (${b.depositPercent}%)` : ''}` },
                { label: 'Paid online', value: m(b.paidOnline) },
                { label: 'Collected at venue', value: m(b.balanceReceivedAmount) },
                { label: 'Balance due', value: m(b.balanceDue) },
                { label: 'Commission', value: b.commissionPercent !== null ? `${b.commissionPercent}%${b.commissionAmount !== null ? ` · ${fmtMoney(b.commissionAmount, b.currency)}` : ''}` : null },
                { label: 'Vendor net', value: m(b.vendorNetAmount) },
                { label: 'Settled', value: <When value={b.settledUtc} /> },
              ]}
            />
          </SectionCard>
          {(b.state === 5 || b.refundState > 0) && (
            <SectionCard title="Cancellation & refund">
              <FieldGrid
                fields={[
                  { label: 'Cancelled by', value: b.cancelledBy ? CANCELLED_BY[b.cancelledBy] : null },
                  { label: 'Cancelled', value: <When value={b.cancelledUtc} /> },
                  { label: 'Reason', value: b.cancelReason, wide: true },
                  { label: 'Fee kept', value: m(b.cancellationFee) },
                  { label: 'Refund', value: b.refundAmount !== null ? `${fmtMoney(b.refundAmount, b.currency)} · ${REFUND_STATE[b.refundState]}` : REFUND_STATE[b.refundState] },
                  { label: 'Policy', value: b.cancellationPolicy?.summary, wide: true },
                ]}
              />
            </SectionCard>
          )}
          {!can('manageBookings') && (
            <Text size="sm" c="dimmed">
              Your role can look at bookings but not change them.
            </Text>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
