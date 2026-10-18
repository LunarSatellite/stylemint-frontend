import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import BankLeadsPage from './bank/LeadsPage';
import { ServiceCategory, takesBookings, toServiceCategory } from './category';
import ListingsPage from './listings/ListingsPage';
import BookingsPage from './bookings/BookingsPage';
import { serviceNavFor, serviceTabsFor } from './nav';
import { page, PROFILE_PATH, profileRoute, signInVendor } from './testkit';

vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

beforeEach(async () => {
  await signInVendor();
});

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/bank/leads" element={<BankLeadsPage />} />
      <Route path="/services/listings" element={<ListingsPage />} />
      <Route path="/services/bookings" element={<BookingsPage />} />
    </Routes>,
    { route: path },
  );
}

describe('service category', () => {
  it('reads the profile field; anything unknown or missing is a product seller', () => {
    expect(toServiceCategory(undefined)).toBe(0);
    expect(toServiceCategory(null)).toBe(0);
    expect(toServiceCategory(7)).toBe(0);
    expect(toServiceCategory(3)).toBe(ServiceCategory.Bank);
    expect(takesBookings(1)).toBe(true);
    expect(takesBookings(2)).toBe(true);
    expect(takesBookings(3)).toBe(false);
    expect(takesBookings(0)).toBe(false);
  });

  it('gives product sellers no service menu or tabs — their Seller Center is unchanged', () => {
    expect(serviceNavFor(0)).toBeNull();
    expect(serviceTabsFor(0)).toBeNull();
  });

  it('gives each service category its own menu', () => {
    expect(serviceNavFor(1)?.items.map((i) => i.to)).toEqual(['/services/bookings', '/services/listings']);
    expect(serviceNavFor(2)?.section).toBe('Travel');
    expect(serviceNavFor(3)?.items.map((i) => i.to)).toEqual(['/bank/leads', '/bank/appointments', '/bank/products', '/bank/branches']);
    expect(serviceTabsFor(3)?.map((t) => t.label)).toEqual(['Leads', 'Products']);
  });
});

describe('area gating', () => {
  it('a product seller (older server, no field) opening the bank inbox sees an explanation and no leads are fetched', async () => {
    const calls = mockApi({ ...profileRoute(undefined) });
    renderAt('/bank/leads');
    expect(await screen.findByTestId('state-wrong-category')).toHaveTextContent('for bank vendors');
    expect(calls.some((c) => c.path.startsWith('/v1/vendor/bank'))).toBe(false);
  });

  it('a vendor without a profile yet (404) is treated as a product seller', async () => {
    const calls = mockApi({});
    renderAt('/services/bookings');
    expect(await screen.findByTestId('state-wrong-category')).toHaveTextContent('hotel and travel agency vendors');
    expect(calls.some((c) => c.path === PROFILE_PATH)).toBe(true);
    expect(calls.some((c) => c.path.startsWith('/v1/vendor/bookings'))).toBe(false);
  });

  it('a hotel cannot open the bank inbox, and a bank cannot open listings', async () => {
    mockApi({ ...profileRoute(ServiceCategory.Hotel) });
    const first = renderAt('/bank/leads');
    expect(await screen.findByTestId('state-wrong-category')).toHaveTextContent('set up as a hotel');
    first.unmount();

    mockApi({ ...profileRoute(ServiceCategory.Bank) });
    renderAt('/services/listings');
    expect(await screen.findByTestId('state-wrong-category')).toHaveTextContent('set up as a bank');
  });

  it('a bank opens its inbox', async () => {
    const calls = mockApi({ ...profileRoute(ServiceCategory.Bank), 'GET /v1/vendor/bank/leads': { body: page([]) }, 'GET /v1/vendor/bank/branches': { body: [] } });
    renderAt('/bank/leads');
    expect(await screen.findByText('No new leads')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/vendor/bank/leads')).toBe(true));
    expect(screen.queryByTestId('state-wrong-category')).toBeNull();
  });

  it('a travel agency sees packages, not properties', async () => {
    const calls = mockApi({ ...profileRoute(ServiceCategory.TravelAgency), 'GET /v1/vendor/services/listings': { body: [] } });
    renderAt('/services/listings');
    expect(await screen.findByText('No packages yet')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/services/listings')?.search).toContain('kind=2');
  });
});
