import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isGuid, validPercent } from '@/api/services';
import { can } from '@/auth/roles';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt } from '@/auth/stepUp';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { BookingsPage } from './BookingsPage';

const VENDOR = '0f1e2d3c-0000-4000-8000-000000000777';

function booking(patch: Record<string, unknown> = {}) {
  return {
    id: 'bk-1',
    number: 'BK-7F3A9C21',
    kind: 1,
    state: 2,
    listingId: 'lst-1',
    listingTitle: 'Hotel Yak & Yeti',
    roomTypeName: 'Deluxe Double',
    departureId: null,
    vendor: { vendorAccountId: VENDOR, name: 'Yak & Yeti Pvt Ltd', logoUrl: null },
    startDate: '2026-10-21',
    endDate: '2026-10-23',
    nights: 2,
    rooms: 1,
    adults: 2,
    children: 0,
    guestName: 'Sita Sharma',
    travellers: [],
    specialRequests: null,
    currency: 'NPR',
    lines: [],
    totalPrice: 9000,
    paymentMode: 2,
    depositPercent: 30,
    paidOnline: 2700,
    balanceDue: 6300,
    balanceReceivedAmount: null,
    cancellationPolicy: { summary: 'Free cancellation until 18 Oct 2026.' },
    cancelledBy: null,
    cancelReason: null,
    cancellationFee: null,
    refundAmount: null,
    refundState: 0,
    commissionPercent: 10,
    commissionAmount: null,
    vendorNetAmount: null,
    settledUtc: null,
    buyerAccountId: 'aaaaaaaa-0000-4000-8000-000000000001',
    createdUtc: '2026-10-15T04:00:00Z',
    confirmedUtc: '2026-10-15T04:05:00Z',
    completedUtc: null,
    cancelledUtc: null,
    ...patch,
  };
}

const page = (items: unknown[]) => ({ items, totalCount: items.length, nextCursor: null, previousCursor: null, pageSize: 25, hasMore: false });

const SETTINGS = {
  defaultPercent: 10,
  categories: [
    { category: 1, percent: 10, isDefault: true },
    { category: 2, percent: 12, isDefault: false },
  ],
  vendors: [{ vendorAccountId: VENDOR, vendorName: 'Yak & Yeti Pvt Ltd', percent: 8, note: 'Launch partner', updatedUtc: '2026-10-10T00:00:00Z' }],
};

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  registerStepUpPrompt(null);
  vi.unstubAllGlobals();
});

describe('roles', () => {
  it('lets support and read-only staff look, and only payouts ops / super admins change bookings', () => {
    expect(can(['SupportAgent'], 'viewBookings')).toBe(true);
    expect(can(['Readonly'], 'viewBookings')).toBe(true);
    expect(can(['KycReviewer'], 'viewBookings')).toBe(false);
    expect(can(['PayoutsOps'], 'manageBookings')).toBe(true);
    expect(can(['SupportAgent'], 'manageBookings')).toBe(false);
    expect(can(['SuperAdmin'], 'manageBookings')).toBe(true);
  });

  it('validates commission percents and vendor ids', () => {
    expect(validPercent('12')).toBe(12);
    expect(validPercent('0')).toBe(0);
    expect(validPercent('50.5')).toBeNull();
    expect(validPercent('')).toBeNull();
    expect(validPercent('abc')).toBeNull();
    expect(isGuid(VENDOR)).toBe(true);
    expect(isGuid('yak')).toBe(false);
  });
});

describe('bookings overview', () => {
  it('searches by number or guest and filters by status and vendor on the server', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) => (req.path === '/v1/admin/bookings' ? { body: page([booking()]) } : undefined));
    renderWithProviders(<BookingsPage />, { route: `/bookings?q=BK-7F3A&state=2&vendor=${VENDOR}` });
    const table = await screen.findByRole('table', { name: 'Service bookings' });
    const [row] = within(table).getAllByTestId('table-row');
    expect(row).toHaveTextContent('BK-7F3A9C21');
    expect(row).toHaveTextContent('Sita Sharma');
    expect(row).toHaveTextContent('Confirmed');
    const url = calls.find((c) => c.path === '/v1/admin/bookings')!.url;
    expect(url).toContain('q=BK-7F3A');
    expect(url).toContain('state=2');
    expect(url).toContain(`vendorAccountId=${VENDOR}`);
  });

  it('says the module is not deployed instead of showing no bookings', async () => {
    signInAs(['SupportAgent']);
    mockFetch(() => undefined);
    renderWithProviders(<BookingsPage />, { route: '/bookings' });
    expect(await screen.findByTestId('state-unavailable')).toHaveTextContent('Service bookings');
    expect(screen.queryByText('No bookings yet')).toBeNull();
  });

  it('cancels a booking with a reason, fee waived by default', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/bookings') return { body: page([booking()]) };
      if (req.method === 'GET' && req.path === '/v1/admin/bookings/bk-1') return { body: booking() };
      if (req.method === 'POST' && req.path === '/v1/admin/bookings/bk-1/cancel') return { body: booking({ state: 5 }) };
      return undefined;
    });
    renderWithProviders(<BookingsPage />, { route: '/bookings?open=bk-1' });
    expect(await screen.findByText('Buyer account')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Cancel…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel booking BK-7F3A9C21' });
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Duplicate booking');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'Duplicate booking', waiveFee: true }));
    expect(calls.find((c) => c.method === 'POST')!.headers['idempotency-key']).toBeTruthy();
  });

  it('offers a refund retry only for a failed refund, and nothing to a read-only admin', async () => {
    signInAs(['PayoutsOps']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/bookings') return { body: page([]) };
      if (req.path === '/v1/admin/bookings/bk-1') return { body: booking({ state: 5, refundState: 3, refundAmount: 2700, cancelledBy: 2 }) };
      return undefined;
    });
    const first = renderWithProviders(<BookingsPage />, { route: '/bookings?open=bk-1' });
    expect(await screen.findByRole('button', { name: /Retry refund/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel…/ })).toBeNull();
    first.unmount();

    resetSessionForTests();
    signInAs(['Readonly']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/bookings') return { body: page([]) };
      if (req.path === '/v1/admin/bookings/bk-1') return { body: booking() };
      return undefined;
    });
    renderWithProviders(<BookingsPage />, { route: '/bookings?open=bk-1' });
    expect(await screen.findByText(/can look at bookings but not change them/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel…/ })).toBeNull();
  });
});

describe('commission settings', () => {
  it('shows the category rates and vendor overrides and changes a category', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/bookings/commission') return { body: SETTINGS };
      if (req.method === 'PUT' && req.path === '/v1/admin/bookings/commission/categories/1') return { body: { ...SETTINGS, categories: [{ category: 1, percent: 12, isDefault: false }, SETTINGS.categories[1]] } };
      return undefined;
    });
    renderWithProviders(<BookingsPage />, { route: '/bookings?tab=commission' });
    const hotel = await screen.findByTestId('commission-category-1');
    expect(hotel).toHaveTextContent('Hotel');
    expect(hotel).toHaveTextContent('10%');
    expect(hotel).toHaveTextContent('default');
    expect(screen.getByTestId('commission-category-2')).toHaveTextContent('12%');
    expect(screen.getByTestId(`commission-vendor-${VENDOR}`)).toHaveTextContent('8%');

    await userEvent.click(within(hotel).getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hotel commission' });
    const input = within(dialog).getByLabelText(/Commission/);
    await userEvent.clear(input);
    await userEvent.type(input, '12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save percent' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ percent: 12 }));
    await waitFor(() => expect(screen.getByTestId('commission-category-1')).toHaveTextContent('12%'));
  });

  it('refuses an override for something that is not a vendor id, then saves a real one', async () => {
    signInAs(['SuperAdmin']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET') return { body: { ...SETTINGS, vendors: [] } };
      if (req.method === 'PUT') return { body: SETTINGS };
      return undefined;
    });
    renderWithProviders(<BookingsPage />, { route: '/bookings?tab=commission' });
    expect(await screen.findByText('No overrides')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add override' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a vendor override' });
    await userEvent.type(within(dialog).getByLabelText(/Vendor account ID/), 'yak and yeti');
    await userEvent.type(within(dialog).getByLabelText(/Commission/), '8');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save override' }));
    expect(await within(dialog).findByText(/not a vendor account ID/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    await userEvent.clear(within(dialog).getByLabelText(/Vendor account ID/));
    await userEvent.type(within(dialog).getByLabelText(/Vendor account ID/), VENDOR);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save override' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.path).toBe(`/v1/admin/bookings/commission/vendors/${VENDOR}`));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ percent: 8, note: null });
  });

  it('a read-only admin sees the rates but cannot change them', async () => {
    signInAs(['Readonly']);
    mockFetch((req) => (req.path === '/v1/admin/bookings/commission' ? { body: SETTINGS } : undefined));
    renderWithProviders(<BookingsPage />, { route: '/bookings?tab=commission' });
    expect(await screen.findByTestId('commission-category-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add override' })).toBeNull();
  });

  it('says the settings are not available before the deploy', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    renderWithProviders(<BookingsPage />, { route: '/bookings?tab=commission' });
    expect(await screen.findByTestId('state-unavailable')).toHaveTextContent('Booking commission settings');
  });
});
