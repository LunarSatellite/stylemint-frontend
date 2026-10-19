import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import { signInVendor } from '../services/testkit';
import { availableActions, SubOrderState, type OrderBooking, type SubOrderDetail, type SubOrderLine, type SubOrderListItem } from './api';
import { ChannelBadge, OrderCard } from './components';
import OrderDetailPage from './OrderDetailPage';
import { bookingDatesText, guestNames, isServiceLine, isServiceOrder, partyText } from './serviceLines';

const booking = (patch: Partial<OrderBooking> = {}): OrderBooking => ({
  bookingId: 'bk-1',
  bookingNumber: 'BK-7F3A9C21',
  state: 2,
  kind: 1,
  listingId: 'lst-1',
  listingTitle: 'Hotel Yak & Yeti',
  itemName: 'Deluxe Double',
  roomTypeId: 'rt-1',
  departureId: null,
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  nights: 2,
  rooms: 1,
  adults: 2,
  children: 0,
  guestName: 'Sita Sharma',
  travellers: [
    { fullName: 'Sita Sharma', type: 1, age: null },
    { fullName: 'Ram Sharma', type: 1, age: null },
  ],
  specialRequests: 'Late arrival',
  currency: 'NPR',
  totalPrice: 9000,
  paidNowAmount: 2700,
  payAtVenueAmount: 6300,
  paymentMode: 2,
  depositPercent: 30,
  freeUntilDate: '2026-10-30',
  cancellationPolicySummary: 'Free cancellation until 30 Oct 2026.',
  canCancel: false,
  ...patch,
});

const serviceLine = (patch: Partial<SubOrderLine> = {}): SubOrderLine => ({
  id: 'line-1',
  productVariantId: 'var-1',
  quantity: 1,
  unitPriceAmount: 2700,
  unitPriceCurrency: 'NPR',
  productTitleSnapshot: 'Hotel Yak & Yeti',
  variantLabelSnapshot: null,
  optionLabel: 'Deluxe Double · 2 Nov – 4 Nov',
  thumbnailUrlSnapshot: null,
  lineSubtotalAmount: 2700,
  lineSubtotalCurrency: 'NPR',
  lineKind: 2,
  booking: booking(),
  ...patch,
});

const detail = (patch: Partial<SubOrderDetail> = {}): SubOrderDetail => ({
  id: 'so-9',
  orderId: 'o-9',
  orderNumber: 'SM-2001',
  state: SubOrderState.AwaitingFulfillment,
  placedUtc: '2026-10-19T05:00:00Z',
  shipTo: {
    receiverName: 'Sita Sharma',
    receiverPhone: '+9779812345678',
    addressLine1: 'Jhamsikhel',
    landmark: null,
    country: 'NP',
    state: 'Bagmati',
    city: 'Lalitpur',
    zipCode: '44600',
    latitude: null,
    longitude: null,
    locationNote: null,
    mapsLink: null,
  },
  shippingFeeAmount: 0,
  shippingFeeCurrency: 'NPR',
  carrier: null,
  trackingNumber: null,
  acceptedUtc: null,
  packedUtc: null,
  handedOverUtc: null,
  shippedUtc: null,
  inTransitUtc: null,
  outForDeliveryUtc: null,
  deliveredUtc: null,
  fulfillmentChannel: 'Service',
  collectedUtc: null,
  cancelledUtc: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  lineSubtotalAmount: 2700,
  lineSubtotalCurrency: 'NPR',
  subtotalAmount: 2700,
  subtotalCurrency: 'NPR',
  itemCount: 1,
  lines: [serviceLine()],
  delivery: null,
  paymentMethod: 3,
  ...patch,
});

function renderDetail(order: SubOrderDetail) {
  mockApi({ [`GET /v1/vendor/sub-orders/${order.id}`]: { body: order } });
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Routes>,
    { route: `/orders/${order.id}` },
  );
}

describe('service lines — helpers', () => {
  it('a Service sub-order has no fulfilment actions', () => {
    expect(availableActions(SubOrderState.AwaitingFulfillment, 'Service')).toEqual([]);
    expect(availableActions(SubOrderState.Paid, 'Service')).toEqual([]);
    // Products are unchanged.
    expect(availableActions(SubOrderState.AwaitingFulfillment, 'Delivery')).toEqual(['accept', 'reject']);
  });

  it('treats a missing lineKind as a product line (older backend)', () => {
    const product = serviceLine({ lineKind: undefined, booking: undefined });
    expect(isServiceLine(product)).toBe(false);
    expect(isServiceLine(serviceLine())).toBe(true);
    expect(isServiceOrder({ fulfillmentChannel: 'Delivery', lines: [product] })).toBe(false);
    expect(isServiceOrder({ fulfillmentChannel: 'Service', lines: [] })).toBe(true);
  });

  it('describes dates, party and names', () => {
    expect(bookingDatesText(booking())).toMatch(/2 Nov 2026.*4 Nov 2026.*2 nights/);
    expect(bookingDatesText(booking({ kind: 2, endDate: null, nights: null }))).toMatch(/^Departs .*2 Nov 2026/);
    expect(partyText(booking({ children: 1 }))).toBe('1 room · 2 adults · 1 child');
    expect(partyText(booking({ kind: 2, rooms: null, adults: 1 }))).toBe('1 adult');
    // Deduplicated: the guest is also the first traveller.
    expect(guestNames(booking())).toEqual(['Sita Sharma', 'Ram Sharma']);
  });
});

describe('service order — detail page', () => {
  beforeEach(async () => {
    await signInVendor();
  });

  it('shows the booking line: dates, names, reference, paid now vs pay at venue and a link to the booking', async () => {
    renderDetail(detail());
    const lines = await screen.findByTestId('booking-lines');
    expect(within(lines).getByText('Hotel Yak & Yeti')).toBeInTheDocument();
    expect(within(lines).getByText('Deluxe Double')).toBeInTheDocument();
    expect(within(lines).getByTestId('booking-dates')).toHaveTextContent(/2 Nov 2026.*4 Nov 2026/);
    expect(within(lines).getByTestId('booking-names')).toHaveTextContent('Sita Sharma, Ram Sharma');
    expect(within(lines).getByText('BK-7F3A9C21')).toBeInTheDocument();
    expect(within(lines).getByTestId('booking-paid-now')).toHaveTextContent('2,700');
    expect(within(lines).getByTestId('booking-pay-at-venue')).toHaveTextContent('6,300');
    expect(within(lines).getByRole('link', { name: /open booking/i })).toHaveAttribute('href', '/services/bookings/bk-1');
    expect(screen.getByTestId('service-paid-now')).toHaveTextContent('2,700');
  });

  it('offers no delivery or rider actions and never shows the buyer’s phone or address', async () => {
    renderDetail(detail());
    await screen.findByTestId('booking-lines');
    expect(screen.queryByRole('button', { name: /accept order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/deliver to/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/shipping/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rider collects/i)).not.toBeInTheDocument();
    expect(screen.queryByText('+9779812345678')).not.toBeInTheDocument();
    expect(screen.queryByText(/Jhamsikhel/)).not.toBeInTheDocument();
    expect(screen.getByTestId('service-guests')).toHaveTextContent('Ram Sharma');
    expect(screen.getByText(/nothing to pack or ship/i)).toBeInTheDocument();
  });

  it('still renders when the booking block is missing', async () => {
    renderDetail(detail({ lines: [serviceLine({ booking: null })] }));
    expect(await screen.findByText(/booking details are not available yet/i)).toBeInTheDocument();
  });

  it('keeps product orders unchanged', async () => {
    const product = serviceLine({ id: 'p-1', lineKind: 1, booking: null, productTitleSnapshot: 'Pashmina shawl' });
    renderDetail(detail({ id: 'so-10', fulfillmentChannel: 'Delivery', lines: [product] }));
    expect(await screen.findByText('Pashmina shawl')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-lines')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept order/i })).toBeInTheDocument();
    expect(screen.getByText(/deliver to/i)).toBeInTheDocument();
  });
});

describe('service order — list', () => {
  it('marks a booking in the list and on the phone card', () => {
    const item: SubOrderListItem = {
      id: 'so-9',
      orderId: 'o-9',
      orderNumber: 'SM-2001',
      receiverName: '',
      state: SubOrderState.AwaitingFulfillment,
      shippingFeeAmount: 0,
      shippingFeeCurrency: 'NPR',
      subtotalAmount: 2700,
      subtotalCurrency: 'NPR',
      itemCount: 1,
      carrier: null,
      trackingNumber: null,
      placedUtc: '2026-10-19T05:00:00Z',
      shippedUtc: null,
      deliveredUtc: null,
      fulfillmentChannel: 'Service',
      collectedUtc: null,
    };
    renderWithProviders(
      <>
        <ChannelBadge channel="Delivery" />
        <OrderCard order={item} />
      </>,
    );
    // Only the Service order gets the badge; an empty receiver name reads "Booking" too.
    expect(screen.getAllByTestId('service-badge')).toHaveLength(1);
    expect(screen.getAllByText('Booking').length).toBeGreaterThanOrEqual(2);
  });
});
