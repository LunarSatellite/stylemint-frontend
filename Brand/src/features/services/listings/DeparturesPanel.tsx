import { useState, type ReactNode } from 'react';
import { Alert, Badge, Button, Card, Group, Menu, Modal, NumberInput, SimpleGrid, Stack, Table, Text, TextInput, Textarea, ActionIcon } from '@mantine/core';
import { IconDots, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMissingEndpoint, messageOf } from '../../../api/client';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatMoney } from '../../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { useIsPhone } from '../../../lib/useIsPhone';
import { formatDay, kathmanduDate, ServiceSettingUp } from '../components';
import { DepartureStatus, departureStatusLabel, LISTINGS_KEY, listingsApi, type Departure, type DepartureWrite, type Listing } from './api';

/** DepartureWrite limits (service-bookings-contract v1 §3). */
export function validateDeparture(w: DepartureWrite, today: string, seatsBooked = 0): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) return 'Pick the departure date.';
  if (w.date < today) return 'The departure date cannot be in the past.';
  if (!Number.isInteger(w.seatsTotal) || w.seatsTotal < 1 || w.seatsTotal > 500) return 'Seats: 1–500.';
  if (w.seatsTotal < seatsBooked) return `${seatsBooked} seats are already booked — seats cannot go below that.`;
  if (!(w.adultPrice > 0)) return 'Enter the adult price.';
  if (w.childPrice !== null && !(w.childPrice > 0)) return 'The child price must be above 0, or leave it empty (children pay the adult price).';
  return null;
}

function DepartureBadge({ status }: { status: number }) {
  const s = departureStatusLabel[status] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge size="sm" variant="light" color={s.color}>
      {s.label}
    </Badge>
  );
}

export function DeparturesPanel({ listing, readOnly }: { listing: Listing; readOnly: boolean }) {
  const isPhone = useIsPhone();
  const qc = useQueryClient();
  const today = kathmanduDate();
  const key = [...LISTINGS_KEY, 'departures', listing.listingId];
  const q = useQuery({ queryKey: key, queryFn: () => listingsApi.departures(listing.listingId, today) });
  const [editing, setEditing] = useState<Departure | 'new' | null>(null);
  const [cancelling, setCancelling] = useState<Departure | null>(null);
  const m = (amount: number | null) => (amount === null ? '—' : formatMoney({ amount, currency: listing.currency || 'NPR' }));
  const refresh = () => void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
  const close = useMutation({ mutationFn: (id: string) => listingsApi.closeDeparture(id), onSuccess: () => {
      toastSuccess('Closed for new bookings.');
      refresh();
    }, onError: (e) => toastError(e) });
  const reopen = useMutation({ mutationFn: (id: string) => listingsApi.reopenDeparture(id), onSuccess: () => {
      toastSuccess('Open for bookings again.');
      refresh();
    }, onError: (e) => toastError(e) });

  const actions = (d: Departure): ReactNode =>
    readOnly || d.status === DepartureStatus.Cancelled ? null : (
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="slate" aria-label={`Actions for ${formatDay(d.date)}`}>
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setEditing(d)}>Edit seats & prices</Menu.Item>
          {d.status === DepartureStatus.Open && <Menu.Item onClick={() => close.mutate(d.departureId)}>Stop new bookings</Menu.Item>}
          {d.status === DepartureStatus.Closed && <Menu.Item onClick={() => reopen.mutate(d.departureId)}>Reopen for bookings</Menu.Item>}
          <Menu.Item color="signal" onClick={() => setCancelling(d)}>
            Cancel departure…
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );

  let body: ReactNode;
  if (q.isPending) body = <ListSkeleton rows={3} />;
  else if (q.error && isMissingEndpoint(q.error)) body = <ServiceSettingUp what="Departures" />;
  else if (q.error) body = <ErrorBlock error={q.error} title="Could not load departures" onRetry={() => void q.refetch()} />;
  else if ((q.data ?? []).length === 0)
    body = (
      <Card>
        <EmptyBlock title="No departures yet" body="Add the dates this package runs, with seats and prices. Guests can only book a date you open." />
      </Card>
    );
  else if (isPhone)
    body = (
      <Stack gap="sm">
        {(q.data ?? []).map((d) => (
          <Card key={d.departureId} withBorder data-testid={`departure-${d.departureId}`}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Text fw={650}>{formatDay(d.date)}</Text>
                <Text size="sm" c="dimmed">
                  {d.seatsBooked}/{d.seatsTotal} booked · {d.seatsAvailable} left
                </Text>
                <Text size="sm">
                  Adult {m(d.adultPrice)} · Child {d.childPrice === null ? 'adult price' : m(d.childPrice)}
                </Text>
              </div>
              <Group gap={4} wrap="nowrap">
                <DepartureBadge status={d.status} />
                {actions(d)}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    );
  else
    body = (
      <Card padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Departs</Table.Th>
                <Table.Th>Returns</Table.Th>
                <Table.Th ta="right">Seats</Table.Th>
                <Table.Th ta="right">Left</Table.Th>
                <Table.Th ta="right">Adult</Table.Th>
                <Table.Th ta="right">Child</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(q.data ?? []).map((d) => (
                <Table.Tr key={d.departureId} data-testid={`departure-${d.departureId}`}>
                  <Table.Td>{formatDay(d.date)}</Table.Td>
                  <Table.Td>{formatDay(d.endDate)}</Table.Td>
                  <Table.Td ta="right">
                    {d.seatsBooked}/{d.seatsTotal}
                  </Table.Td>
                  <Table.Td ta="right">{d.seatsAvailable}</Table.Td>
                  <Table.Td ta="right">{m(d.adultPrice)}</Table.Td>
                  <Table.Td ta="right">{d.childPrice === null ? 'Adult price' : m(d.childPrice)}</Table.Td>
                  <Table.Td>
                    <DepartureBadge status={d.status} />
                  </Table.Td>
                  <Table.Td>{actions(d)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    );

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" c="dimmed">
          Each departure is one date with its own seats and per-person prices. Children pay the adult price unless you set a child price.
        </Text>
        {!readOnly && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            Add departure
          </Button>
        )}
      </Group>
      {body}
      {editing && <DepartureEditor listing={listing} departure={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {cancelling && <CancelDeparture departure={cancelling} onClose={() => setCancelling(null)} />}
    </Stack>
  );
}

function DepartureEditor({ listing, departure, onClose }: { listing: Listing; departure: Departure | null; onClose: () => void }) {
  const qc = useQueryClient();
  const today = kathmanduDate();
  const [w, setW] = useState<DepartureWrite>(() =>
    departure ? { date: departure.date, seatsTotal: departure.seatsTotal, adultPrice: departure.adultPrice, childPrice: departure.childPrice } : { date: '', seatsTotal: listing.maxGroupSize ?? 12, adultPrice: 0, childPrice: null },
  );
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => (departure ? listingsApi.updateDeparture(departure.departureId, w) : listingsApi.addDeparture(listing.listingId, w)),
    onSuccess: () => {
      toastSuccess(departure ? 'Departure saved.' : 'Departure added.');
      void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    const problem = validateDeparture(w, today, departure?.seatsBooked ?? 0);
    setError(problem);
    if (!problem) save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title={departure ? `Edit ${formatDay(departure.date)}` : 'Add a departure'}>
      <Stack gap="sm">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <TextInput type="date" label="Departure date" min={today} value={w.date} onChange={(e) => setW({ ...w, date: e.currentTarget.value })} />
        <SimpleGrid cols={3} spacing="sm">
          <NumberInput label="Seats" min={Math.max(1, departure?.seatsBooked ?? 1)} max={500} value={w.seatsTotal} onChange={(v) => setW({ ...w, seatsTotal: Number(v) || 0 })} />
          <NumberInput label="Adult price" min={1} thousandSeparator="," value={w.adultPrice || ''} onChange={(v) => setW({ ...w, adultPrice: Number(v) || 0 })} />
          <NumberInput label="Child price" placeholder="Adult price" min={1} thousandSeparator="," value={w.childPrice ?? ''} onChange={(v) => setW({ ...w, childPrice: v === '' ? null : Number(v) })} />
        </SimpleGrid>
        {departure && departure.seatsBooked > 0 && (
          <Text size="xs" c="dimmed">
            {departure.seatsBooked} seats are booked. Price changes apply to new bookings only.
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {departure ? 'Save departure' : 'Add departure'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CancelDeparture({ departure, onClose }: { departure: Departure; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () => listingsApi.cancelDeparture(departure.departureId, reason.trim()),
    onSuccess: () => {
      toastSuccess('Departure cancelled. Every booking on it was cancelled and refunded in full.');
      void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      void qc.invalidateQueries({ queryKey: ['service-bookings'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened onClose={onClose} title={`Cancel the ${formatDay(departure.date)} departure`}>
      <Stack gap="sm">
        <Alert color="signal" variant="light">
          {departure.bookings > 0
            ? `${departure.bookings} ${departure.bookings === 1 ? 'booking' : 'bookings'} (${departure.seatsBooked} travellers) will be cancelled and refunded in full. The travellers are told your reason.`
            : 'No one has booked this date yet.'}
        </Alert>
        {error && (
          <Text size="sm" c="signal">
            {error}
          </Text>
        )}
        <Textarea label="Reason" required autosize minRows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Keep it
          </Button>
          <Button
            color="signal"
            loading={cancel.isPending}
            onClick={async () => {
              if (!reason.trim()) return setError('Give a reason — travellers see it.');
              if (await confirmAction({ title: 'Cancel this departure?', body: 'This cannot be undone.', confirmLabel: 'Cancel departure', danger: true })) cancel.mutate();
            }}
          >
            Cancel departure
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
