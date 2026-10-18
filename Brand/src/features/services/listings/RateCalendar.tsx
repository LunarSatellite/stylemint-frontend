import { useMemo, useState } from 'react';
import { ActionIcon, Alert, Badge, Box, Button, Card, Group, NumberInput, Select, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMissingEndpoint, messageOf } from '../../../api/client';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatMoney, formatMoneyCompact } from '../../../lib/format';
import { toastSuccess } from '../../../lib/notify';
import { addDays, formatDay, kathmanduDate, ServiceSettingUp } from '../components';
import { LISTINGS_KEY, listingsApi, RoomTypeStatus, type CalendarDay, type CalendarWrite, type Listing } from './api';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10" → first and last day, and the weekday the month starts on (0 = Sunday). */
export function monthBounds(month: string): { first: string; last: string; startWeekday: number; days: number } {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: first.toISOString().slice(0, 10), last: new Date(Date.UTC(y, m - 1, days)).toISOString().slice(0, 10), startWeekday: first.getUTCDay(), days };
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Booked vs free for one night, in words. */
export function nightText(d: CalendarDay): string {
  if (d.closed) return 'Closed for sale';
  return `${d.available} of ${d.totalUnits} free${d.booked ? ` · ${d.booked} booked` : ''}${d.held ? ` · ${d.held} on hold` : ''}`;
}

/**
 * One room type's month: the nightly price (base or a date override), and per night how many rooms are booked,
 * held by an unpaid checkout and still free. Pick a start and an end night to change the price or stop selling.
 */
export function RateCalendar({ listing, readOnly }: { listing: Listing; readOnly: boolean }) {
  const rooms = (listing.roomTypes ?? []).filter((r) => r.status === RoomTypeStatus.Active);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(rooms[0]?.roomTypeId ?? null);
  const today = kathmanduDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [range, setRange] = useState<{ from: string; to: string | null } | null>(null);
  const bounds = monthBounds(month);
  const from = bounds.first < today ? today : bounds.first;
  const enabled = !!roomTypeId && bounds.last >= today;
  const key = [...LISTINGS_KEY, 'calendar', roomTypeId, from, bounds.last];
  const q = useQuery({ queryKey: key, queryFn: () => listingsApi.calendar(roomTypeId!, from, bounds.last), enabled });
  const byDate = useMemo(() => new Map((q.data ?? []).map((d) => [d.date, d])), [q.data]);

  if (rooms.length === 0)
    return (
      <Card>
        <EmptyBlock title="Add a room type first" body="Rates and availability are set per room type." />
      </Card>
    );

  const room = rooms.find((r) => r.roomTypeId === roomTypeId) ?? rooms[0];
  const pick = (date: string) => {
    if (readOnly || date < today) return;
    if (!range || range.to !== null || date < range.from) setRange({ from: date, to: null });
    else setRange({ from: range.from, to: date });
  };
  const inRange = (date: string) => !!range && date >= range.from && date <= (range.to ?? range.from);
  const maxMonth = addDays(today, 365).slice(0, 7);

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Select
          aria-label="Room type"
          w={260}
          data={rooms.map((r) => ({ value: r.roomTypeId, label: r.name }))}
          value={room.roomTypeId}
          onChange={(v) => {
            setRoomTypeId(v);
            setRange(null);
          }}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
        />
        <Group gap={6}>
          <ActionIcon variant="default" aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, -1))}>
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text fw={650} miw={130} ta="center" data-testid="calendar-month">
            {new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })}
          </Text>
          <ActionIcon variant="default" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Base rate {formatMoney({ amount: room.baseRate, currency: listing.currency || 'NPR' })} / night · {room.totalUnits} {room.totalUnits === 1 ? 'room' : 'rooms'}. Prices in bold are
        date overrides.
      </Text>
      {q.isPending && enabled ? (
        <ListSkeleton rows={5} height={56} />
      ) : q.error ? (
        isMissingEndpoint(q.error) ? <ServiceSettingUp what="Rates and availability" /> : <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Box>
          <SimpleGrid cols={7} spacing={4} mb={4}>
            {WEEK.map((d) => (
              <Text key={d} size="xs" c="dimmed" ta="center" fw={600}>
                {d}
              </Text>
            ))}
          </SimpleGrid>
          <SimpleGrid cols={7} spacing={4} role="grid" aria-label="Nightly rates and availability">
            {Array.from({ length: bounds.startWeekday }, (_, i) => (
              <Box key={`pad-${i}`} />
            ))}
            {Array.from({ length: bounds.days }, (_, i) => {
              const date = addDays(bounds.first, i);
              const d = byDate.get(date);
              const past = date < today;
              const selected = inRange(date);
              return (
                <UnstyledButton
                  key={date}
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={`${formatDay(date)}${d ? `: ${formatMoney({ amount: d.price, currency: listing.currency || 'NPR' })}, ${nightText(d)}` : ''}`}
                  data-testid={`night-${date}`}
                  disabled={past || readOnly}
                  onClick={() => pick(date)}
                  style={{
                    borderRadius: 8,
                    padding: '4px 5px',
                    minHeight: 58,
                    border: `1px solid ${selected ? 'var(--sm-accent)' : 'var(--sm-border)'}`,
                    background: selected ? 'var(--mantine-color-forest-light)' : d?.closed ? 'var(--sm-subtle)' : undefined,
                    opacity: past ? 0.45 : 1,
                    cursor: past || readOnly ? 'default' : 'pointer',
                  }}
                >
                  <Text size="xs" fw={600}>
                    {i + 1}
                  </Text>
                  {d && (
                    <>
                      <Text size="xs" fw={d.isOverride ? 800 : 400} lh={1.2}>
                        {formatMoneyCompact({ amount: d.price, currency: listing.currency || 'NPR' })}
                      </Text>
                      <Text size="10px" c={d.closed ? 'signal' : d.available === 0 ? 'amber' : 'dimmed'} lh={1.2}>
                        {d.closed ? 'closed' : `${d.available}/${d.totalUnits} free`}
                      </Text>
                    </>
                  )}
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
          <Group gap="md" mt="xs">
            <Text size="xs" c="dimmed">
              x/y free = rooms still bookable / rooms of this type that night
            </Text>
          </Group>
        </Box>
      )}
      {range && !readOnly && <RangeEditor key={`${range.from}-${range.to}`} roomTypeId={room.roomTypeId} range={{ from: range.from, to: range.to ?? range.from }} days={byDate} onDone={() => setRange(null)} />}
    </Stack>
  );
}

function RangeEditor({
  roomTypeId,
  range,
  days,
  onDone,
}: {
  roomTypeId: string;
  range: { from: string; to: string };
  days: Map<string, CalendarDay>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [price, setPrice] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const write = useMutation({
    mutationFn: (body: CalendarWrite) => listingsApi.setCalendar(roomTypeId, body),
    onSuccess: (_, body) => {
      toastSuccess(body.closed === true ? 'Those nights are closed for sale.' : body.closed === false ? 'Those nights are open for sale again.' : body.clearPrice ? 'Back to the base rate.' : 'Price set for those nights.');
      void qc.invalidateQueries({ queryKey: [...LISTINGS_KEY, 'calendar', roomTypeId] });
      onDone();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const booked = [...days.values()].filter((d) => d.date >= range.from && d.date <= range.to).reduce((s, d) => s + d.booked + d.held, 0);
  const label = range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`;
  const base = { from: range.from, to: range.to };
  return (
    <Card withBorder data-testid="range-editor">
      <Stack gap="sm">
        <Text fw={650}>{label}</Text>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <Group gap="xs" align="flex-end" wrap="wrap">
          <NumberInput label="Price per night (NPR)" min={1} thousandSeparator="," w={200} value={price} onChange={(v) => setPrice(v === '' ? '' : Number(v))} />
          <Button
            onClick={() => {
              if (!price || price <= 0) return setError('Enter a price above 0.');
              setError(null);
              write.mutate({ ...base, price, clearPrice: false, closed: null });
            }}
            loading={write.isPending}
          >
            Set price
          </Button>
          <Button variant="default" onClick={() => write.mutate({ ...base, clearPrice: true, closed: null })} disabled={write.isPending}>
            Back to base rate
          </Button>
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button variant="light" color="signal" onClick={() => write.mutate({ ...base, closed: true })} disabled={write.isPending}>
            Stop selling these nights
          </Button>
          <Button variant="light" onClick={() => write.mutate({ ...base, closed: false })} disabled={write.isPending}>
            Open for sale
          </Button>
          <Button variant="subtle" color="slate" onClick={onDone}>
            Cancel
          </Button>
        </Group>
        {booked > 0 && (
          <Badge color="amber" variant="light" style={{ alignSelf: 'flex-start' }}>
            {booked} room-nights already booked or on hold — they are kept
          </Badge>
        )}
      </Stack>
    </Card>
  );
}
