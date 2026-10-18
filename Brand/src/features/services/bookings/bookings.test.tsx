import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../../test/utils';
import { kathmanduDate } from '../components';
import { booking, page, profileRoute, signInVendor } from '../testkit';
import { sanitizeBooking, type Booking } from '../listings/api';
import BookingDetailPage, { earningsOf } from './BookingDetailPage';
import BookingsPage, { filterFor } from './BookingsPage';

vi.mock('../../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

const HOTEL = profileRoute(1);
const SUMMARY = { 'GET /v1/vendor/bookings/summary': { body: { upcoming: 4, inHouse: 2, pendingPayment: 1, balanceToCollect: 12600, currency: 'NPR' } } };

beforeEach(async () => {
  await signInVendor();
});

function render(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/services/bookings" element={<BookingsPage />} />
      <Route path="/services/bookings/:id" element={<BookingDetailPage />} />
    </Routes>,
    { route },
  );
}

/** What a careless server might add: the vendor must still never see who the buyer is. */
function leakyBooking(): Booking {
  return {
    ...booking({ specialRequests: 'Call me on 9841234567 or mail sita@example.com' }),
    buyerAccountId: 'buyer-guid-1',
    buyerPhone: '+9779841000000',
    buyerEmail: 'sita@example.com',
  } as unknown as Booking;
}

describe('booking filters', () => {
  it('maps each tab to the server filter', () => {
    expect(filterFor('upcoming', '2026-10-18')).toEqual({ state: 2, from: '2026-10-18' });
    expect(filterFor('in_progress', 'x')).toEqual({ state: 3 });
    expect(filterFor('completed', 'x')).toEqual({ state: 4 });
    expect(filterFor('cancelled', 'x')).toEqual({ state: 5 });
    expect(filterFor('no_show', 'x')).toEqual({ state: 6 });
    expect(filterFor('pending', 'x')).toEqual({ state: 1 });
    expect(filterFor('all', 'x')).toEqual({});
  });
});

describe('buyer privacy', () => {
  it('drops the buyer account and contact fields and masks contact details typed into requests', () => {
    const b = sanitizeBooking(leakyBooking()) as unknown as Record<string, unknown>;
    expect(b).not.toHaveProperty('buyerAccountId');
    expect(b).not.toHaveProperty('buyerPhone');
    expect(b).not.toHaveProperty('buyerEmail');
    expect(b.specialRequests).toBe('Call me on [phone hidden] or mail [email hidden]');
    expect(b.guestName).toBe('Sita Sharma');
    expect(b.number).toBe('BK-7F3A9C21');
  });

  it('never renders buyer contact details on the list or the booking', async () => {
    mockApi({ ...HOTEL, ...SUMMARY, 'GET /v1/vendor/bookings': { body: page([leakyBooking()]) }, 'GET /v1/vendor/bookings/bk-1': { body: leakyBooking() } });
    const list = render('/services/bookings');
    expect(await screen.findByTestId('booking-bk-1')).toHaveTextContent('Sita Sharma');
    expect(document.body).not.toHaveTextContent('9841');
    expect(document.body).not.toHaveTextContent('sita@example.com');
    list.unmount();

    render('/services/bookings/bk-1');
    expect(await screen.findByTestId('booking-guests')).toHaveTextContent('Sita Sharma');
    expect(screen.getByTestId('booking-guests')).toHaveTextContent('[phone hidden]');
    expect(document.body).not.toHaveTextContent('9841');
    expect(document.body).not.toHaveTextContent('sita@example.com');
    expect(document.body).not.toHaveTextContent('buyer-guid-1');
  });
});

describe('bookings list', () => {
  it('shows upcoming bookings by default with the summary, guest, room, dates and balance to collect', async () => {
    const calls = mockApi({ ...HOTEL, ...SUMMARY, 'GET /v1/vendor/bookings': { body: page([booking()]) } });
    render('/services/bookings');
    const row = await screen.findByTestId('booking-bk-1');
    expect(row).toHaveTextContent('BK-7F3A9C21');
    expect(row).toHaveTextContent('Deluxe Double · 2 nights');
    expect(row).toHaveTextContent('2 adults, 1 child');
    expect(row).toHaveTextContent('Confirmed');
    expect(row).toHaveTextContent('Rs 9,000');
    expect(row).toHaveTextContent('Rs 6,300');
    expect(await screen.findByTestId('booking-summary')).toHaveTextContent('Rs 12,600');
    const search = calls.find((c) => c.path === '/v1/vendor/bookings')!.search;
    expect(search).toContain('state=2');
    expect(search).toContain(`from=${kathmanduDate()}`);
    expect(search).toContain('kind=1');
  });

  it('switches to completed and searches by number or guest on the server', async () => {
    const calls = mockApi({ ...HOTEL, ...SUMMARY, 'GET /v1/vendor/bookings': { body: page([]) } });
    render('/services/bookings?filter=completed');
    expect(await screen.findByText('No bookings here')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/bookings')!.search).toContain('state=4');
    await userEvent.setup().type(screen.getByLabelText('Search bookings'), 'Sita');
    await waitFor(() => expect(calls.filter((c) => c.path === '/v1/vendor/bookings').at(-1)!.search).toContain('q=Sita'));
  });

  it('says bookings are being set up while the endpoints are missing', async () => {
    mockApi({ ...HOTEL });
    render('/services/bookings');
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent('Bookings is being set up');
    expect(screen.queryByTestId('booking-summary')).toBeNull();
  });
});

describe('booking detail', () => {
  it('shows payment, an estimated commission before completion, and records the balance received', async () => {
    const b = booking({ canMarkBalanceReceived: true, canComplete: true });
    const calls = mockApi({
      ...HOTEL,
      'GET /v1/vendor/bookings/bk-1': { body: b },
      'POST /v1/vendor/bookings/bk-1/balance-received': { body: booking({ balanceDue: 0, balanceReceivedAmount: 6300 }) },
    });
    render('/services/bookings/bk-1');
    const payment = await screen.findByTestId('booking-payment');
    expect(payment).toHaveTextContent('Paid online');
    expect(payment).toHaveTextContent('Rs 2,700');
    expect(payment).toHaveTextContent('Rs 6,300');
    const earnings = screen.getByTestId('booking-earnings');
    expect(earnings).toHaveTextContent('Commission (10%)');
    expect(earnings).toHaveTextContent('− Rs 900');
    expect(earnings).toHaveTextContent('Rs 8,100');
    expect(earnings).toHaveTextContent('Estimate');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mark balance received' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ amount: 6300 }));
    expect(calls.find((c) => c.method === 'POST')?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('checks a guest in', async () => {
    const calls = mockApi({
      ...HOTEL,
      'GET /v1/vendor/bookings/bk-1': { body: booking({ canCheckIn: true }) },
      'POST /v1/vendor/bookings/bk-1/check-in': { body: booking({ state: 3 }) },
    });
    render('/services/bookings/bk-1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Check in' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/check-in'))).toBe(true));
    expect(await screen.findByText('Checked in')).toBeInTheDocument();
  });

  it('cancels only with a reason and promises the guest a full refund', async () => {
    const calls = mockApi({
      ...HOTEL,
      'GET /v1/vendor/bookings/bk-1': { body: booking() },
      'POST /v1/vendor/bookings/bk-1/cancel': { body: booking({ state: 5, cancelledBy: 2, refundAmount: 2700, refundState: 1, canCancel: false }) },
    });
    render('/services/bookings/bk-1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('full refund of everything paid online (Rs 2,700)');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));
    expect(await within(dialog).findByText(/Give a reason/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await user.type(within(dialog).getByLabelText(/Reason/), 'Overbooked after a burst pipe');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'Overbooked after a burst pipe' }));
  });

  it('shows settled earnings, including the commission owed on a pay-at-venue stay', () => {
    const settled = booking({ state: 4, paymentMode: 3, paidOnline: 0, commissionAmount: 900, vendorNetAmount: -900, settledUtc: '2026-10-24T00:00:00Z' });
    expect(earningsOf(settled)).toEqual({ base: 9000, commission: 900, net: -900, settled: true, estimated: false });
    expect(earningsOf(booking({ state: 5 }))).toMatchObject({ commission: null, net: null, estimated: false });
    expect(earningsOf(booking())).toMatchObject({ commission: 900, net: 8100, estimated: true });
  });

  it('separates "not deployed" from "not yours"', async () => {
    mockApi({ ...HOTEL, 'GET /v1/vendor/bookings/bk-x': { status: 404, body: { errorCode: 'booking.not_found', title: 'Not found' } } });
    const one = render('/services/bookings/bk-x');
    expect(await screen.findByText('Booking not found')).toBeInTheDocument();
    one.unmount();
    mockApi({ ...HOTEL });
    render('/services/bookings/bk-1');
    expect(await screen.findByTestId('state-setting-up')).toBeInTheDocument();
  });
});
