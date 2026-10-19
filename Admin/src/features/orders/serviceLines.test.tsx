import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { channelLabel, isServiceLine } from '@/api/orders';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { bookingGuestNames, OrderDrawer } from './OrderDrawer';

const VENDOR = '0f1e2d3c-0000-4000-8000-000000000777';

const booking = {
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
  specialRequests: null,
  currency: 'NPR',
  totalPrice: 9000,
  paidNowAmount: 2700,
  payAtVenueAmount: 6300,
  paymentMode: 2,
  depositPercent: 30,
  freeUntilDate: '2026-10-30',
  cancellationPolicySummary: null,
  canCancel: false,
};

const line = (patch: Record<string, unknown> = {}) => ({
  id: 'line-1',
  productVariantId: 'var-1',
  quantity: 1,
  unitPriceAmount: 2700,
  unitPriceCurrency: 'NPR',
  productTitleSnapshot: 'Hotel Yak & Yeti',
  variantLabelSnapshot: null,
  optionLabel: 'Deluxe Double · 2 Nov – 4 Nov',
  thumbnailUrlSnapshot: null,
  creatorAccountId: null,
  commissionAmountValue: null,
  commissionAmountCurrency: null,
  originChannel: null,
  lineSubtotalAmount: 2700,
  lineSubtotalCurrency: 'NPR',
  lineKind: 2,
  booking,
  ...patch,
});

const subOrder = (patch: Record<string, unknown> = {}) => ({
  id: 'so-1',
  orderId: 'o-1',
  vendorAccountId: VENDOR,
  state: 3,
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
  subtotalAmount: 2700,
  subtotalCurrency: 'NPR',
  lines: [line()],
  delivery: null,
  ...patch,
});

const order = (patch: Record<string, unknown> = {}) => ({
  id: 'o-1',
  orderNumber: 'SM-2001',
  accountId: 'aaaaaaaa-0000-4000-8000-000000000001',
  state: 2,
  shipTo: {
    receiverName: 'Sita Sharma',
    receiverPhone: '',
    addressLine1: '',
    landmark: null,
    country: 'NP',
    state: '',
    city: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    locationNote: null,
    mapsLink: null,
  },
  paymentMethod: 3,
  paymentIntentId: null,
  shippingTotalAmount: 0,
  shippingTotalCurrency: 'NPR',
  taxTotalAmount: 0,
  taxTotalCurrency: 'NPR',
  taxIncluded: true,
  discountTotalAmount: 0,
  discountTotalCurrency: 'NPR',
  subtotalAmount: 9000,
  subtotalCurrency: 'NPR',
  grandTotalAmount: 2700,
  grandTotalCurrency: 'NPR',
  placedUtc: '2026-10-19T05:00:00Z',
  cancelledUtc: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  archivedUtc: null,
  archivedReason: null,
  archivedById: null,
  subOrders: [subOrder()],
  delivery: null,
  payAtVenueTotalAmount: 6300,
  payAtVenueTotalCurrency: 'NPR',
  hasServiceLines: true,
  ...patch,
});

function renderOrder(body: unknown) {
  mockFetch((req) => (req.path.endsWith('/v1/admin/orders/by-number/SM-2001') ? { body } : undefined));
  return renderWithProviders(<OrderDrawer orderNumber="SM-2001" onClose={vi.fn()} />);
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('order lines — helpers', () => {
  it('labels the channel and recognises service lines (missing lineKind = product)', () => {
    expect(channelLabel('Service')).toBe('Booking (no delivery)');
    expect(channelLabel('StorePickup')).toBe('Store pickup');
    expect(channelLabel('Delivery')).toBe('Delivery');
    expect(isServiceLine({ lineKind: 2, booking: null })).toBe(true);
    expect(isServiceLine({})).toBe(false);
    expect(bookingGuestNames(booking)).toEqual(['Sita Sharma', 'Ram Sharma']);
  });
});

describe('order drawer — booking lines', () => {
  it('shows dates, guest names, booking reference, paid now vs pay at venue and links to the booking', async () => {
    signInAs(['SupportAgent']);
    renderOrder(order());
    const card = await screen.findByTestId('booking-line-line-1');
    expect(card).toHaveTextContent('Hotel Yak & Yeti');
    expect(card).toHaveTextContent('Deluxe Double');
    expect(card).toHaveTextContent('BK-7F3A9C21');
    expect(card).toHaveTextContent('Sita Sharma, Ram Sharma');
    expect(card).toHaveTextContent('2 nights');
    expect(within(card).getByTestId('admin-paid-now')).toHaveTextContent('2,700');
    expect(within(card).getByTestId('admin-pay-at-venue')).toHaveTextContent('6,300');
    expect(within(card).getByRole('link', { name: /open booking/i })).toHaveAttribute('href', '/bookings?open=bk-1');
    // Service parts have no shipping / carrier / tracking rows; the order shows what is paid at the venue.
    expect(screen.getByText('Booking (no delivery)')).toBeInTheDocument();
    expect(screen.queryByText('Shipping fee')).not.toBeInTheDocument();
    expect(screen.queryByText('Tracking')).not.toBeInTheDocument();
    expect(screen.getByText('Pay at venue (not through StyleMint)')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Order lines' })).not.toBeInTheDocument();
  });

  it('hides the booking link from staff who cannot view bookings', async () => {
    signInAs(['KycReviewer']);
    renderOrder(order());
    const card = await screen.findByTestId('booking-line-line-1');
    expect(within(card).queryByRole('link', { name: /open booking/i })).not.toBeInTheDocument();
  });

  it('keeps product parts as before', async () => {
    signInAs(['SupportAgent']);
    renderOrder(
      order({
        hasServiceLines: false,
        payAtVenueTotalAmount: undefined,
        subOrders: [subOrder({ fulfillmentChannel: 'Delivery', lines: [line({ lineKind: undefined, booking: undefined, productTitleSnapshot: 'Pashmina shawl' })] })],
      }),
    );
    expect(await screen.findByRole('table', { name: 'Order lines' })).toHaveTextContent('Pashmina shawl');
    expect(screen.getByText('Shipping fee')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-line-line-1')).not.toBeInTheDocument();
  });
});
