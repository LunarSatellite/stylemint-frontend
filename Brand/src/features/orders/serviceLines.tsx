import { Anchor, Badge, Divider, Group, Stack, Text } from '@mantine/core';
import { IconCalendarEvent, IconExternalLink } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import { formatDay } from '../services/components';
import { bookingStateLabel, ListingKind, paymentModeLabel } from '../services/listings/api';
import type { OrderBooking, SubOrderDetail, SubOrderLine } from './api';

/**
 * Service (hotel stay / travel package) lines on a seller's order — service-cart-contract.md v1 §4.
 * A service sub-order has `fulfillmentChannel: "Service"`, no shipping and no fulfilment actions (the backend
 * answers 409); the booking itself is managed on the booking page. The vendor sees guest / traveller NAMES
 * only — never the buyer's phone, email or address.
 */

/** A missing `lineKind` (older backend) is a product line. */
export const isServiceLine = (l: Pick<SubOrderLine, 'lineKind' | 'booking'>) => l.lineKind === 2 || (l.lineKind == null && !!l.booking);

export const isServiceOrder = (o: Pick<SubOrderDetail, 'fulfillmentChannel' | 'lines'>) =>
  o.fulfillmentChannel === 'Service' || (o.lines.length > 0 && o.lines.every(isServiceLine));

export const bookingPath = (bookingId: string) => `/services/bookings/${encodeURIComponent(bookingId)}`;

export function bookingDatesText(b: Pick<OrderBooking, 'kind' | 'startDate' | 'endDate' | 'nights'>): string {
  if (b.kind === ListingKind.Stay) {
    const n = b.nights ?? null;
    return `${formatDay(b.startDate)} → ${formatDay(b.endDate)}${n != null ? ` · ${n} ${n === 1 ? 'night' : 'nights'}` : ''}`;
  }
  return `Departs ${formatDay(b.startDate)}`;
}

export function partyText(b: Pick<OrderBooking, 'kind' | 'adults' | 'children' | 'rooms'>): string {
  const parts: string[] = [];
  if (b.kind === ListingKind.Stay && b.rooms) parts.push(`${b.rooms} ${b.rooms === 1 ? 'room' : 'rooms'}`);
  parts.push(`${b.adults} ${b.adults === 1 ? 'adult' : 'adults'}`);
  if (b.children) parts.push(`${b.children} ${b.children === 1 ? 'child' : 'children'}`);
  return parts.join(' · ');
}

/** Guest and traveller names only (deduplicated); never contact details. */
export function guestNames(b: Pick<OrderBooking, 'guestName' | 'travellers'>): string[] {
  const names = [b.guestName, ...(b.travellers ?? []).map((t) => t.fullName)].map((n) => (n ?? '').trim()).filter(Boolean);
  return [...new Set(names)];
}

export function BookingStateBadge({ state }: { state: number }) {
  const s = bookingStateLabel[state] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

function Row({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" data-testid={testId}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {value}
      </Text>
    </Group>
  );
}

/** One booking line: what, dates, party, guest names, reference, paid now vs pay at venue, link to the booking. */
export function BookingLine({ line }: { line: SubOrderLine }) {
  const b = line.booking;
  if (!b) {
    // The order DTO says it is a service line but the booking block is not there yet.
    return (
      <Stack gap={2} data-testid={`booking-line-${line.id}`}>
        <Text size="sm" fw={600}>
          {line.productTitleSnapshot}
        </Text>
        {line.optionLabel && (
          <Text size="xs" c="dimmed">
            {line.optionLabel}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          Booking details are not available yet.
        </Text>
      </Stack>
    );
  }
  const m = (amount: number) => formatMoney({ amount, currency: b.currency || line.lineSubtotalCurrency || 'NPR' });
  const names = guestNames(b);
  return (
    <Stack gap={6} data-testid={`booking-line-${line.id}`}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          <IconCalendarEvent size={20} color="var(--sm-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {b.listingTitle || line.productTitleSnapshot}
            </Text>
            {b.itemName && b.itemName !== b.listingTitle && (
              <Text size="xs" c="dimmed">
                {b.itemName}
              </Text>
            )}
          </div>
        </Group>
        <BookingStateBadge state={b.state} />
      </Group>
      <Row label="Dates" value={bookingDatesText(b)} testId="booking-dates" />
      <Row label={b.kind === ListingKind.Stay ? 'Guests' : 'Travellers'} value={partyText(b)} />
      {names.length > 0 && <Row label="Names" value={names.join(', ')} testId="booking-names" />}
      {b.specialRequests && <Row label="Requests" value={`“${b.specialRequests}”`} />}
      <Row
        label="Booking"
        value={
          <Text span ff="monospace" size="sm">
            {b.bookingNumber}
          </Text>
        }
      />
      {b.paymentMode != null && paymentModeLabel[b.paymentMode] && <Row label="Payment" value={paymentModeLabel[b.paymentMode]} />}
      <Row label="Booking total" value={m(b.totalPrice)} />
      <Row label="Paid now (online)" value={m(b.paidNowAmount)} testId="booking-paid-now" />
      <Row label="Pay at venue" value={m(b.payAtVenueAmount)} testId="booking-pay-at-venue" />
      <Anchor component={Link} to={bookingPath(b.bookingId)} size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Open booking <IconExternalLink size={12} />
      </Anchor>
    </Stack>
  );
}

/** All booking lines of an order, with paid-now / pay-at-venue totals. */
export function BookingLines({ lines }: { lines: SubOrderLine[] }) {
  const service = lines.filter(isServiceLine);
  if (service.length === 0) return null;
  const withBooking = service.map((l) => l.booking).filter((b): b is OrderBooking => !!b);
  const currency = withBooking[0]?.currency || service[0].lineSubtotalCurrency || 'NPR';
  const paidNow = withBooking.reduce((s, b) => s + (b.paidNowAmount ?? 0), 0);
  const atVenue = withBooking.reduce((s, b) => s + (b.payAtVenueAmount ?? 0), 0);
  return (
    <Stack gap="sm" data-testid="booking-lines">
      {service.map((l, i) => (
        <Stack key={l.id} gap="sm">
          {i > 0 && <Divider />}
          <BookingLine line={l} />
        </Stack>
      ))}
      {withBooking.length > 1 && (
        <>
          <Divider />
          <Row label="Paid now in total" value={formatMoney({ amount: paidNow, currency })} />
          <Row label="To collect at the venue" value={formatMoney({ amount: atVenue, currency })} />
        </>
      )}
    </Stack>
  );
}
