import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../../test/utils';
import { addDays, kathmanduDate } from '../components';
import { profileRoute, signInVendor, stayListing } from '../testkit';
import type { CalendarDay, Departure } from './api';
import { validateDeparture } from './DeparturesPanel';
import { cleanListing, emptyListing, policySentence, validateListing } from './ListingForm';
import ListingPage from './ListingPage';
import ListingsPage from './ListingsPage';
import { monthBounds, nightText, shiftMonth } from './RateCalendar';
import { validateRoomType } from './RoomTypesPanel';

vi.mock('../../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

beforeEach(async () => {
  await signInVendor();
});

function render(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/services/listings" element={<ListingsPage />} />
      <Route path="/services/listings/new" element={<ListingPage />} />
      <Route path="/services/listings/:id" element={<ListingPage />} />
    </Routes>,
    { route },
  );
}

function day(date: string, patch: Partial<CalendarDay> = {}): CalendarDay {
  return { date, price: 4500, baseRate: 4500, isOverride: false, closed: false, totalUnits: 5, booked: 0, held: 0, available: 5, ...patch };
}

describe('listing rules', () => {
  it('validates a stay against the contract limits', () => {
    const w = { ...emptyListing(1), title: 'Hotel Yak', city: 'Kathmandu' };
    expect(validateListing(w, 1)).toEqual({});
    expect(validateListing({ ...w, title: 'Yo' }, 1).title).toBeDefined();
    expect(validateListing({ ...w, paymentModes: [] }, 1).paymentModes).toBeDefined();
    expect(validateListing({ ...w, paymentModes: [2], depositPercent: 100 }, 1).depositPercent).toBeDefined();
    expect(validateListing({ ...w, paymentModes: [2], depositPercent: 30 }, 1).depositPercent).toBeUndefined();
    // The deposit percent only matters when a deposit is offered.
    expect(validateListing({ ...w, paymentModes: [1], depositPercent: 0 }, 1).depositPercent).toBeUndefined();
    expect(validateListing({ ...w, minNights: 5, maxNights: 3 }, 1).maxNights).toBeDefined();
    expect(validateListing({ ...w, checkInTime: '2pm' }, 1).checkInTime).toBeDefined();
    expect(validateListing({ ...w, latitude: 27.7, longitude: null }, 1).pin).toBeDefined();
    expect(validateListing({ ...w, freeCancellationDays: 61 }, 1).freeCancellationDays).toBeDefined();
  });

  it('validates a package: destination, days and itinerary titles', () => {
    const w = { ...emptyListing(2), title: 'Annapurna Base Camp', city: 'Pokhara', destination: 'Annapurna', itinerary: [{ day: 1, title: 'Pokhara → Nayapul', description: '' }] };
    expect(validateListing(w, 2)).toEqual({});
    expect(validateListing({ ...w, destination: '' }, 2).destination).toBeDefined();
    expect(validateListing({ ...w, durationDays: 0 }, 2).durationDays).toBeDefined();
    expect(validateListing({ ...w, itinerary: [{ day: 1, title: '', description: '' }] }, 2).itinerary).toBeDefined();
  });

  it('sends only the fields of the kind, with the deposit cleared when no deposit is offered', () => {
    const stay = cleanListing({ ...emptyListing(1), title: ' Hotel Yak ', city: 'Kathmandu', paymentModes: [3, 1], depositPercent: 30 }, 1, true);
    expect(stay).toMatchObject({ kind: 1, title: 'Hotel Yak', paymentModes: [1, 3], depositPercent: 0, checkInTime: '14:00', description: null });
    expect(stay).not.toHaveProperty('destination');
    const pkg = cleanListing({ ...emptyListing(2), title: 'ABC', city: 'Pokhara', destination: 'Annapurna', itinerary: [{ day: 7, title: ' Day one ', description: '' }] }, 2, false);
    expect(pkg).not.toHaveProperty('kind');
    expect(pkg).not.toHaveProperty('checkInTime');
    expect(pkg.itinerary).toEqual([{ day: 1, title: 'Day one', description: null }]);
  });

  it('describes the cancellation rule the way guests read it', () => {
    expect(policySentence(3, 50, 1)).toBe('Free cancellation until 3 days before check-in. After that 50% of the total is charged.');
    expect(policySentence(1, 100, 2)).toBe('Free cancellation until 1 day before departure. After that 100% of the total is charged.');
    expect(policySentence(0, 30, 1)).toBe('No free cancellation. After that 30% of the total is charged.');
    expect(policySentence(5, 0, 1)).toBe('Guests can cancel for free until the start date.');
  });

  it('checks room types and departures before sending', () => {
    const room = { name: 'Deluxe', description: '', maxAdults: 2, maxGuests: 3, beds: '1 King', sizeSqm: null, photoUrls: [], amenities: [], totalUnits: 5, baseRate: 4500 };
    expect(validateRoomType(room)).toEqual({});
    expect(validateRoomType({ ...room, maxGuests: 1 }).maxGuests).toBeDefined();
    expect(validateRoomType({ ...room, baseRate: 0 }).baseRate).toBeDefined();
    expect(validateRoomType({ ...room, totalUnits: 0 }).totalUnits).toBeDefined();
    const today = kathmanduDate();
    const dep = { date: addDays(today, 10), seatsTotal: 12, adultPrice: 45000, childPrice: null };
    expect(validateDeparture(dep, today)).toBeNull();
    expect(validateDeparture({ ...dep, date: addDays(today, -1) }, today)).toMatch(/past/);
    expect(validateDeparture({ ...dep, seatsTotal: 4 }, today, 7)).toMatch(/7 seats are already booked/);
    expect(validateDeparture({ ...dep, childPrice: 0 }, today)).toMatch(/child price/);
  });

  it('knows the shape of a month', () => {
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31', startWeekday: 4, days: 31 });
    expect(monthBounds('2028-02').days).toBe(29);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(nightText(day('2026-10-21', { booked: 2, held: 1, available: 2 }))).toBe('2 of 5 free · 2 booked · 1 on hold');
    expect(nightText(day('2026-10-21', { closed: true }))).toBe('Closed for sale');
  });
});

describe('listings page', () => {
  it('lists a hotel’s properties with status and room types', async () => {
    const calls = mockApi({ ...profileRoute(1), 'GET /v1/vendor/services/listings': { body: [stayListing(), stayListing({ listingId: 'old', status: 4, title: 'Old annex' })] } });
    render('/services/listings');
    const card = await screen.findByTestId('listing-lst-1');
    expect(card).toHaveTextContent('Hotel Yak & Yeti');
    expect(card).toHaveTextContent('Draft');
    expect(card).toHaveTextContent('1 room type');
    expect(card).toHaveTextContent('from Rs 4,500 / night');
    expect(screen.queryByTestId('listing-old')).toBeNull();
    expect(screen.getByText('1 archived listing is hidden.')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/services/listings')?.search).toContain('kind=1');
  });

  it('says listings are being set up while the endpoint is missing', async () => {
    mockApi({ ...profileRoute(1) });
    render('/services/listings');
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent('Hotel listings is being set up');
  });
});

describe('new listing', () => {
  it('asks for the deposit only when a deposit is offered, and creates a draft stay', async () => {
    const calls = mockApi({ ...profileRoute(1), 'POST /v1/vendor/services/listings': { body: stayListing() }, 'GET /v1/vendor/services/listings/lst-1': { body: stayListing() } });
    render('/services/listings/new');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByTestId('form-errors')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(screen.getByLabelText(/^Property name/), 'Hotel Yak & Yeti');
    await user.type(screen.getByLabelText(/^City/), 'Kathmandu');
    expect(screen.queryByLabelText(/Deposit paid online/)).toBeNull();
    await user.click(screen.getByLabelText('Deposit online, rest at the venue'));
    expect(screen.getByLabelText(/Deposit paid online/)).toHaveValue('30 %');
    expect(screen.getByTestId('policy-preview')).toHaveTextContent('Free cancellation until 3 days before check-in. After that 50% of the total is charged.');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 1, title: 'Hotel Yak & Yeti', city: 'Kathmandu', paymentModes: [1, 2], depositPercent: 30, freeCancellationDays: 3, lateCancellationFeePercent: 50 });
    expect(calls.find((c) => c.method === 'POST')!.headers['Idempotency-Key']).toBeTruthy();
  });
});

describe('rates & availability', () => {
  it('shows booked vs free per night and sets a price for a range of nights', async () => {
    const today = kathmanduDate();
    // Two nights in one month: today + tomorrow, or (on the last day of a month) the first two nights of the next.
    const lastDay = addDays(today, 1).slice(0, 7) !== today.slice(0, 7);
    const [a, b] = lastDay ? [addDays(today, 1), addDays(today, 2)] : [today, addDays(today, 1)];
    const calls = mockApi({
      ...profileRoute(1),
      'GET /v1/vendor/services/listings/lst-1': { body: stayListing() },
      'GET /v1/vendor/services/room-types/rt-1/calendar': { body: [day(a, { booked: 3, available: 2 }), day(b, { price: 5200, isOverride: true })] },
      'PUT /v1/vendor/services/room-types/rt-1/calendar': { body: [] },
    });
    render('/services/listings/lst-1?tab=rates');
    const user = userEvent.setup();
    if (lastDay) await user.click(await screen.findByRole('button', { name: 'Next month' }));
    const first = await screen.findByTestId(`night-${a}`);
    expect(first).toHaveTextContent('2/5 free');
    expect(first).toHaveAccessibleName(/2 of 5 free · 3 booked/);
    expect(screen.getByTestId(`night-${b}`)).toHaveTextContent('Rs 5.2K');

    await user.click(first);
    await user.click(screen.getByTestId(`night-${b}`));
    const editor = await screen.findByTestId('range-editor');
    expect(editor).toHaveTextContent('3 room-nights already booked or on hold');
    await user.type(within(editor).getByLabelText(/Price per night/), '6000');
    await user.click(within(editor).getByRole('button', { name: 'Set price' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ from: a, to: b, price: 6000, clearPrice: false, closed: null }));
  });

  it('stops selling a single night', async () => {
    // Late in the month the next night may be in the next month — use today, which is always shown.
    const today = kathmanduDate();
    const calls = mockApi({
      ...profileRoute(1),
      'GET /v1/vendor/services/listings/lst-1': { body: stayListing() },
      'GET /v1/vendor/services/room-types/rt-1/calendar': { body: [day(today)] },
      'PUT /v1/vendor/services/room-types/rt-1/calendar': { body: [] },
    });
    render('/services/listings/lst-1?tab=rates');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId(`night-${today}`));
    await user.click(within(await screen.findByTestId('range-editor')).getByRole('button', { name: 'Stop selling these nights' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ from: today, to: today, closed: true }));
  });
});

describe('departures', () => {
  const dep = (patch: Partial<Departure> = {}): Departure => ({
    departureId: 'd-1',
    date: addDays(kathmanduDate(), 14),
    endDate: addDays(kathmanduDate(), 20),
    seatsTotal: 12,
    seatsAvailable: 5,
    adultPrice: 45000,
    childPrice: null,
    status: 1,
    seatsBooked: 7,
    bookings: 3,
    createdUtc: '2026-10-01T00:00:00Z',
    ...patch,
  });
  const pkg = stayListing({ listingId: 'pkg-1', kind: 2, title: 'Annapurna Base Camp 7D', destination: 'Annapurna', durationDays: 7, roomTypes: [], itinerary: [{ day: 1, title: 'Pokhara', description: null }] });

  it('lists departures with seats and prices, and cancels one with a reason after confirming', async () => {
    const calls = mockApi({
      ...profileRoute(2),
      'GET /v1/vendor/services/listings/pkg-1': { body: pkg },
      'GET /v1/vendor/services/listings/pkg-1/departures': { body: [dep()] },
      'POST /v1/vendor/services/departures/d-1/cancel': { body: dep({ status: 3 }) },
    });
    render('/services/listings/pkg-1?tab=departures');
    const row = await screen.findByTestId('departure-d-1');
    expect(row).toHaveTextContent('7/12');
    expect(row).toHaveTextContent('Rs 45,000');
    expect(row).toHaveTextContent('Adult price');

    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: /Actions for/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Cancel departure/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('3 bookings (7 travellers) will be cancelled and refunded in full');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Landslide on the trail');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel departure' }));
    const confirm = await screen.findByRole('dialog', { name: 'Cancel this departure?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel departure' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'Landslide on the trail' }));
  });
});
