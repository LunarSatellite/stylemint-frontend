import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { DashboardPage } from './dashboard/DashboardPage';
import { ProductsPage } from './products/ProductsPage';
import { VendorsPage } from './vendors/VendorsPage';

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => vi.unstubAllGlobals());

/** Endpoints from feat/admin-api-gaps answer a bare 404 until deployed: the pages must say so, not show "nothing". */
describe('before the admin API gaps are deployed', () => {
  it('Vendors falls back to onboarding applications', async () => {
    signInAs(['KycReviewer']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/kyc/vendor/queue')
        return { body: { items: [{ id: 'app1', accountId: 'acc1', state: 4, brandName: 'Xplore Nepal', legalBusinessName: 'Xplore Pvt Ltd', countryCode: 'NP', businessType: 3, city: 'Kathmandu' }], totalCount: 1, nextCursor: null, pageSize: 25, hasMore: false } };
      return undefined;
    });
    renderWithProviders(<VendorsPage />, { route: '/vendors' });
    expect(await screen.findByText('Xplore Nepal')).toBeInTheDocument();
    expect(screen.getByText(/until the vendor directory is deployed/)).toBeInTheDocument();
  });

  it('Products says the list is not available instead of showing an empty catalogue', async () => {
    signInAs(['ContentMod']);
    mockFetch(() => undefined);
    renderWithProviders(<ProductsPage />, { route: '/products' });
    expect(await screen.findByTestId('state-unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No products yet')).not.toBeInTheDocument();
  });

  it('the dashboard counts queues itself when the summary is missing', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) => {
      if (req.path === '/v1/admin/support/tickets') return { body: { items: [], totalCount: 7, pageNumber: 1, pageSize: 1, totalPages: 7 } };
      if (req.path === '/v1/admin/dashboard/summary') return { status: 404 };
      return { body: { items: [], totalCount: 0, pageNumber: 1, pageSize: 1 } };
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/Sales figures aren’t on this server yet/)).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/v1/admin/support/tickets')).toBe(true);
  });

  it('the dashboard uses the summary when the server has it', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) =>
      req.path === '/v1/admin/dashboard/summary'
        ? {
            body: {
              generatedUtc: new Date().toISOString(),
              cacheSeconds: 60,
              timeZone: 'Asia/Kathmandu',
              windows: { today: { fromUtc: '', orders: 4, gmv: { amount: 9800, currency: 'NPR' }, newCustomers: 6, newVendors: 1 }, last7d: null, last30d: null },
              queues: { kycPending: null, couriersAwaitingReview: 0, moderationOpen: 0, openReturns: 2, openTickets: 5, stuckDeliveries: null, payoutsPending: null },
            },
          }
        : { body: { items: [], totalCount: 0 } },
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/NPR\s?9,800/)).toBeInTheDocument();
    expect(await screen.findByText('5')).toBeInTheDocument();
    // Open tickets came from the summary: no separate count request.
    expect(calls.some((c) => c.path === '/v1/admin/support/tickets')).toBe(false);
  });
});
