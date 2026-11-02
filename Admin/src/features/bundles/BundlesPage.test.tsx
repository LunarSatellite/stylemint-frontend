import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminBundleActions, normalizeBundle, validTakedownNote } from '@/api/bundles';
import { can } from '@/auth/roles';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt } from '@/auth/stepUp';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { BundlesPage } from './BundlesPage';

const HIMAL = '0f1e2d3c-0000-4000-8000-000000000001';
const PEAK = '0f1e2d3c-0000-4000-8000-000000000002';

function bundle(patch: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    title: 'Trekking kit',
    ownerKind: 'Creator',
    ownerAccountId: 'creator-1',
    ownerName: 'Asha Treks',
    discountPercent: 10,
    state: 'Live',
    termsVersion: 2,
    pausedReason: null,
    shops: [
      { vendorAccountId: HIMAL, name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 2 },
      { vendorAccountId: PEAK, name: 'Peak Gear', state: 'Accepted', acceptedTermsVersion: 2 },
    ],
    items: [
      { id: 'it-1', productId: 'p-1', vendorAccountId: HIMAL, title: 'Trail shoes', quantity: 1, listUnitPrice: 8000, bundleUnitPrice: 7200, commissionRatePercent: 10, available: true },
      { id: 'it-2', productId: 'p-2', vendorAccountId: PEAK, title: 'Down jacket', quantity: 1, listUnitPrice: 12000, bundleUnitPrice: 10800, commissionRatePercent: 8, available: false },
    ],
    totals: { listTotal: 20000, bundleTotal: 18000, saving: 2000, currency: 'NPR' },
    ...patch,
  };
}

const page = (items: unknown[]) => ({ items, totalCount: items.length, nextCursor: null, pageSize: 25, hasMore: false });

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  registerStepUpPrompt(null);
  vi.unstubAllGlobals();
});

describe('bundle roles and rules', () => {
  it('lets catalog, support and read-only staff look; only moderators and super admins change', () => {
    expect(can(['Readonly'], 'viewBundles')).toBe(true);
    expect(can(['SupportAgent'], 'viewBundles')).toBe(true);
    expect(can(['PayoutsOps'], 'viewBundles')).toBe(false);
    expect(can(['ContentMod'], 'manageBundles')).toBe(true);
    expect(can(['SupportAgent'], 'manageBundles')).toBe(false);
  });

  it('offers take down on any live bundle, edits only on StyleMint ones, and resume after a takedown', () => {
    const live = adminBundleActions(normalizeBundle(bundle()), true);
    expect(live).toMatchObject({ canTakedown: true, canEdit: false, canPause: false, canArchive: true, canResume: false });
    const down = adminBundleActions(normalizeBundle(bundle({ state: 'Paused', pausedReason: 'AdminTakedown' })), true);
    expect(down).toMatchObject({ canTakedown: false, canResume: true });
    const platform = adminBundleActions(normalizeBundle(bundle({ ownerKind: 'Platform', state: 'Draft' })), true);
    expect(platform).toMatchObject({ canEdit: true, canSubmit: true });
    expect(adminBundleActions(normalizeBundle(bundle()), false)).toMatchObject({ canTakedown: false, canArchive: false });
    expect(validTakedownNote('ab')).toBe(false);
    expect(validTakedownNote('  Fake brand  ')).toBe(true);
  });
});

describe('bundles list', () => {
  it('searches and filters on the server and shows owner, discount and status', async () => {
    signInAs(['ContentMod']);
    const { calls } = mockFetch((req) =>
      req.path === '/v1/admin/bundles'
        ? {
            body: page([
              { id: 'b-1', title: 'Trekking kit', ownerKind: 'Creator', ownerName: 'Asha Treks', discountPercent: 10, state: 'Live', itemCount: 2, shopCount: 2, isPurchasable: false },
              { id: 'b-2', title: 'Wedding look', ownerKind: 1, discountPercent: 5, state: 4, itemCount: 3, shopCount: 3 },
            ]),
          }
        : undefined,
    );
    renderWithProviders(<BundlesPage />, { route: '/bundles?q=kit&state=Live&owner=Creator' });
    const table = await screen.findByRole('table', { name: 'Bundles' });
    const rows = within(table).getAllByTestId('table-row');
    expect(rows[0]).toHaveTextContent('Trekking kit');
    expect(rows[0]).toHaveTextContent('Asha Treks');
    expect(rows[0]).toHaveTextContent('10%');
    expect(rows[0]).toHaveTextContent('Live');
    expect(rows[0]).toHaveTextContent('Out of stock');
    expect(rows[1]).toHaveTextContent('StyleMint');
    expect(rows[1]).toHaveTextContent('Paused');
    const url = calls.find((c) => c.path === '/v1/admin/bundles')!.url;
    expect(url).toContain('q=kit');
    expect(url).toContain('state=Live');
    expect(url).toContain('ownerKind=Creator');
  });

  it('says bundles are not deployed instead of showing none', async () => {
    signInAs(['ContentMod']);
    mockFetch(() => undefined);
    renderWithProviders(<BundlesPage />, { route: '/bundles' });
    expect(await screen.findByTestId('state-unavailable')).toHaveTextContent('Bundles');
    expect(screen.queryByText('No bundles yet')).toBeNull();
  });
});

describe('bundle drawer', () => {
  it('shows shops, items and the out-of-stock item; read-only staff cannot change it', async () => {
    signInAs(['Readonly']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/bundles') return { body: page([]) };
      if (req.path === '/v1/admin/bundles/b-1') return { body: bundle() };
      return undefined;
    });
    renderWithProviders(<BundlesPage />, { route: '/bundles?open=b-1' });
    expect(await screen.findByTestId('availability')).toHaveTextContent('Out of stock: Down jacket');
    expect(screen.getByTestId(`shop-${PEAK}`)).toHaveTextContent('Accepted');
    expect(screen.getByTestId('item-it-1')).toHaveTextContent('Creator 10%');
    expect(screen.queryByRole('button', { name: /Take down/ })).toBeNull();
    expect(screen.getByText(/can look at bundles but not change them/)).toBeInTheDocument();
  });

  it('takes a bundle down with a required note', async () => {
    signInAs(['ContentMod']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/bundles') return { body: page([]) };
      if (req.method === 'GET' && req.path === '/v1/admin/bundles/b-1') return { body: bundle() };
      if (req.method === 'POST' && req.path === '/v1/admin/bundles/b-1/takedown') return { body: bundle({ state: 'Paused', pausedReason: 'AdminTakedown', pausedNote: 'Counterfeit jacket' }) };
      return undefined;
    });
    renderWithProviders(<BundlesPage />, { route: '/bundles?open=b-1' });
    await userEvent.click(await screen.findByRole('button', { name: /Take down…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Take down “Trekking kit”' });
    expect(dialog).toHaveTextContent(/Only an admin can put it back on sale/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take down' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Counterfeit jacket');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Take down' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ note: 'Counterfeit jacket' }));
    expect(calls.find((c) => c.method === 'POST')!.headers['idempotency-key']).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Resume…/ })).toBeInTheDocument();
    expect(screen.getByText(/Taken down by StyleMint/)).toBeInTheDocument();
  });

  it('archives after stating it cannot be undone', async () => {
    signInAs(['SuperAdmin']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/bundles') return { body: page([]) };
      if (req.method === 'GET' && req.path === '/v1/admin/bundles/b-1') return { body: bundle() };
      if (req.method === 'POST' && req.path === '/v1/admin/bundles/b-1/archive') return { body: bundle({ state: 'Archived' }) };
      return undefined;
    });
    renderWithProviders(<BundlesPage />, { route: '/bundles?open=b-1' });
    await userEvent.click(await screen.findByRole('button', { name: /Archive…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive “Trekking kit”' });
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(['/v1/admin/bundles/b-1/archive']));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Take down…/ })).toBeNull());
  });

  it('creates a StyleMint bundle from any active product', async () => {
    signInAs(['ContentMod']);
    const created = bundle({ id: 'b-new', ownerKind: 'Platform', state: 'Draft', items: [], shops: [] });
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/bundles') return { body: page([]) };
      if (req.method === 'GET' && req.path === '/v1/admin/products')
        return { body: { items: [{ id: 'p-1', name: 'Trail shoes', vendorAccountId: HIMAL, vendorName: 'Himal Outdoors', status: 'Active', price: { min: 8000, max: 8000, currency: 'NPR' } }], totalCount: 1, pageNumber: 1, pageSize: 20, totalPages: 1 } };
      if (req.method === 'POST' && req.path === '/v1/admin/bundles') return { body: created };
      if (req.method === 'GET' && req.path === '/v1/admin/bundles/b-new') return { body: created };
      return undefined;
    });
    renderWithProviders(<BundlesPage />, { route: '/bundles' });
    await userEvent.click(await screen.findByRole('button', { name: /New StyleMint bundle/ }));
    const dialog = await screen.findByRole('dialog', { name: 'New StyleMint bundle' });
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Festival edit');
    await userEvent.type(within(dialog).getByLabelText('Find a product'), 'Trail');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Add Trail shoes' }, { timeout: 2000 }));
    expect(within(dialog).getByTestId('create-preview')).toHaveTextContent(/7,200/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Festival edit', description: null, coverImageUrl: null, discountPercent: 10, items: [{ productId: 'p-1', quantity: 1 }] }),
    );
    expect(calls.find((c) => c.path === '/v1/admin/products')!.url).toContain('status=active');
  });
});
