import { useState, type ReactNode } from 'react';
import { Badge, Card, Group, ScrollArea, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../../api/client';
import { useCursorList } from '../../../api/useCursorList';
import { KpiTile } from '../../../components/KpiTile';
import { PageHeader } from '../../../components/PageHeader';
import { Pager } from '../../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatMoney, formatNumber } from '../../../lib/format';
import { useIsPhone } from '../../../lib/useIsPhone';
import { ServiceCategory, useServiceCategory } from '../category';
import { formatDay, kathmanduDate, RequireServiceCategory, ServiceSettingUp } from '../components';
import { BOOKINGS_KEY, bookingsApi, BookingState, ListingKind, stateLabelFor, type Booking, type BookingFilter } from '../listings/api';

export const bookingPath = (id: string) => `/services/bookings/${encodeURIComponent(id)}`;

export const BOOKING_FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'all', label: 'All' },
] as const;
export type BookingFilterKey = (typeof BOOKING_FILTERS)[number]['value'];

/** A tab → the server filter (`state` is one value; "upcoming" = confirmed and starting today or later). */
export function filterFor(key: string, today: string): BookingFilter {
  switch (key) {
    case 'upcoming':
      return { state: BookingState.Confirmed, from: today };
    case 'in_progress':
      return { state: BookingState.CheckedIn };
    case 'completed':
      return { state: BookingState.Completed };
    case 'cancelled':
      return { state: BookingState.Cancelled };
    case 'no_show':
      return { state: BookingState.NoShow };
    case 'pending':
      return { state: BookingState.PendingPayment };
    default:
      return {};
  }
}

export function BookingStateBadge({ booking }: { booking: Pick<Booking, 'state' | 'kind'> }) {
  const s = stateLabelFor(booking.state, booking.kind);
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

export function guestsText(b: Pick<Booking, 'adults' | 'children'>): string {
  const a = `${b.adults} ${b.adults === 1 ? 'adult' : 'adults'}`;
  return b.children ? `${a}, ${b.children} ${b.children === 1 ? 'child' : 'children'}` : a;
}

export function whatText(b: Booking): string {
  if (b.kind === ListingKind.Stay) {
    const rooms = b.rooms && b.rooms > 1 ? `${b.rooms} × ` : '';
    return `${rooms}${b.roomTypeName ?? 'Room'} · ${b.nights ?? '?'} ${b.nights === 1 ? 'night' : 'nights'}`;
  }
  return b.listingTitle;
}

/** Bookings for hotels and travel agencies: guest names only — never the buyer's phone or email. */
export default function BookingsPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Hotel, ServiceCategory.TravelAgency]}>
      <BookingsBody />
    </RequireServiceCategory>
  );
}

function BookingsBody() {
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { category } = useServiceCategory();
  const stay = category === ServiceCategory.Hotel;
  const [params, setParams] = useSearchParams();
  const tab = BOOKING_FILTERS.some((f) => f.value === params.get('filter')) ? params.get('filter')! : 'upcoming';
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const today = kathmanduDate();
  const filter: BookingFilter = { ...filterFor(tab, today), kind: stay ? ListingKind.Stay : ListingKind.Package, q: q || undefined };
  const summary = useQuery({ queryKey: [...BOOKINGS_KEY, 'summary'], queryFn: () => bookingsApi.summary(), retry: false, refetchInterval: 60_000 });
  const list = useCursorList({
    key: [...BOOKINGS_KEY, 'list'],
    resetKey: JSON.stringify(filter),
    fetchPage: (cursor) => bookingsApi.list(filter, cursor),
    refetchInterval: 30_000,
  });
  const query = list.query;
  const items = query.data?.items ?? [];
  const m = (b: Booking, amount: number) => formatMoney({ amount, currency: b.currency || 'NPR' });
  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'upcoming') next.delete('filter');
    else next.set('filter', v);
    setParams(next, { replace: true });
  };

  let body: ReactNode;
  if (query.isPending) body = <ListSkeleton rows={5} height={isPhone ? 110 : 52} />;
  else if (query.error && isMissingEndpoint(query.error)) body = <ServiceSettingUp what="Bookings" />;
  else if (query.error) body = <ErrorBlock error={query.error} title="Could not load your bookings" onRetry={() => void query.refetch()} />;
  else if (items.length === 0)
    body = (
      <Card>
        <EmptyBlock title={q ? 'No bookings match' : 'No bookings here'} body="Bookings guests make in the StyleMint app appear here." />
      </Card>
    );
  else if (isPhone)
    body = (
      <Stack gap="sm">
        {items.map((b) => (
          <Card key={b.id} withBorder component={Link} to={bookingPath(b.id)} data-testid={`booking-${b.id}`}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Text fw={650} truncate>
                  {b.guestName}
                </Text>
                <Text size="sm" c="dimmed" truncate>
                  {whatText(b)}
                </Text>
                <Text size="sm">
                  {formatDay(b.startDate)}
                  {b.kind === ListingKind.Stay ? ` → ${formatDay(b.endDate)}` : ''} · {guestsText(b)}
                </Text>
                <Text size="xs" c="dimmed" className="sm-mono">
                  {b.number}
                </Text>
              </div>
              <Stack gap={4} align="flex-end">
                <BookingStateBadge booking={b} />
                <Text size="sm" fw={600}>
                  {m(b, b.totalPrice)}
                </Text>
                {b.balanceDue > 0 && (
                  <Text size="xs" c="amber">
                    {m(b, b.balanceDue)} to collect
                  </Text>
                )}
              </Stack>
            </Group>
          </Card>
        ))}
      </Stack>
    );
  else
    body = (
      <Card padding={0}>
        <Table.ScrollContainer minWidth={900}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Booking</Table.Th>
                <Table.Th>Guest</Table.Th>
                <Table.Th>{stay ? 'Room' : 'Package'}</Table.Th>
                <Table.Th>{stay ? 'Dates' : 'Departure'}</Table.Th>
                <Table.Th>Guests</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th ta="right">To collect</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((b) => (
                <Table.Tr key={b.id} data-testid={`booking-${b.id}`} style={{ cursor: 'pointer' }} onClick={() => navigate(bookingPath(b.id))}>
                  <Table.Td>
                    <Text component={Link} to={bookingPath(b.id)} fw={600} size="sm" className="sm-mono">
                      {b.number}
                    </Text>
                  </Table.Td>
                  <Table.Td>{b.guestName}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {whatText(b)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {formatDay(b.startDate, false)}
                    {b.kind === ListingKind.Stay ? ` → ${formatDay(b.endDate, false)}` : ''}
                  </Table.Td>
                  <Table.Td>{guestsText(b)}</Table.Td>
                  <Table.Td>
                    <BookingStateBadge booking={b} />
                  </Table.Td>
                  <Table.Td ta="right">{m(b, b.totalPrice)}</Table.Td>
                  <Table.Td ta="right">{b.balanceDue > 0 ? m(b, b.balanceDue) : '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    );

  const s = summary.data;
  return (
    <>
      <PageHeader
        title="Bookings"
        description={
          stay
            ? 'Stays booked by guests. Check guests in, mark stays completed, and record money collected at the front desk.'
            : 'Trips booked by travellers. Mark trips in progress or completed, and record money collected at the meeting point.'
        }
      />
      <Stack gap="md">
        {s && (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm" data-testid="booking-summary">
            <KpiTile label="Upcoming" value={formatNumber(s.upcoming)} />
            <KpiTile label={stay ? 'In house' : 'On a trip'} value={formatNumber(s.inHouse)} tone="gray" />
            <KpiTile label="Awaiting payment" value={formatNumber(s.pendingPayment)} tone="amber" />
            <KpiTile label="To collect at the venue" value={formatMoney({ amount: s.balanceToCollect, currency: s.currency || 'NPR' })} tone="amber" />
          </SimpleGrid>
        )}
        <ScrollArea type="never">
          <SegmentedControl value={tab} onChange={setTab} data={BOOKING_FILTERS.map((f) => ({ value: f.value, label: f.label }))} aria-label="Filter bookings" />
        </ScrollArea>
        <TextInput
          placeholder="Booking number or guest name"
          aria-label="Search bookings"
          leftSection={<IconSearch size={15} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          maw={320}
        />
        {body}
        <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={query.isFetching} />
      </Stack>
    </>
  );
}
