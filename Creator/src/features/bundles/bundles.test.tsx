import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { __resetSessionForTests, establish } from '../../auth/session';
import { ACCOUNT_ID, authResponse, mockApi, renderWithProviders } from '../../test/utils';
import { bundlePermissions, creatorEarning, normalizeBundle, resumeBlocker, shareUrl, submitBlocker } from './api';
import BundleDetailPage from './BundleDetailPage';
import BundlesPage from './BundlesPage';

vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

const PEAK = 'vendor-peak';
const HIMAL = 'vendor-himal';

const page = <T,>(items: T[]) => ({ items, totalCount: items.length, nextCursor: null, previousCursor: null, pageSize: 20, hasMore: false });

function item(patch: Record<string, unknown> = {}) {
  return {
    id: 'it-1',
    productId: 'p-1',
    vendorAccountId: HIMAL,
    title: 'Trail shoes',
    thumbnailUrl: null,
    quantity: 1,
    listUnitPrice: 8000,
    bundleUnitPrice: 7200,
    commissionRatePercent: 10,
    available: true,
    ...patch,
  };
}

function wire(patch: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    title: 'Trekking kit',
    ownerKind: 'Creator',
    ownerAccountId: ACCOUNT_ID,
    discountPercent: 10,
    state: 'PendingAcceptance',
    termsVersion: 1,
    myRole: 'Owner',
    myShopState: null,
    shops: [
      { vendorAccountId: HIMAL, name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 1 },
      { vendorAccountId: PEAK, name: 'Peak Gear', state: 'Pending', acceptedTermsVersion: null },
    ],
    items: [item(), item({ id: 'it-2', productId: 'p-2', vendorAccountId: PEAK, title: 'Down jacket', listUnitPrice: 12000, bundleUnitPrice: 10800, commissionRatePercent: 8 })],
    totals: { listTotal: 20000, bundleTotal: 18000, saving: 2000, currency: 'NPR' },
    ...patch,
  };
}

beforeEach(async () => {
  __resetSessionForTests();
  await establish(authResponse(['Creator']), { remember: false, checkPassword: false });
});

function renderBundles(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/bundles" element={<BundlesPage />} />
      <Route path="/bundles/:id" element={<BundleDetailPage />} />
    </Routes>,
    { route },
  );
}

const writes = <T extends { method: string }>(calls: T[]) => calls.filter((c) => c.method !== 'GET');

describe('creator bundle rules', () => {
  it('adds up the commission per bundle and builds the share link', () => {
    expect(creatorEarning(normalizeBundle(wire()).items)).toBe(720 + 864);
    expect(creatorEarning([])).toBeNull();
    expect(shareUrl('b-1', 'https://stylemint.test')).toBe('https://stylemint.test/shop/b/b-1');
  });

  it('never offers a creator invites or shop answers, and gates sending and resuming', () => {
    const p = bundlePermissions(normalizeBundle(wire()), ACCOUNT_ID);
    expect(p).toMatchObject({ canInvite: false, canAccept: false, canDecline: false, canWithdraw: false, canEdit: true, canSubmit: false, canShare: false });
    expect(submitBlocker(normalizeBundle(wire({ state: 'Draft', items: [item()] })))).toMatch(/at least 2/);
    expect(resumeBlocker(normalizeBundle(wire({ state: 'Paused', pausedReason: 'ShopWithdrew' })))).toMatch(/Every shop must accept/);
  });
});

describe('creator bundles', () => {
  it('lists my bundles with state badges and filters on the server', async () => {
    const calls = mockApi({
      'GET /v1/bundles/mine': { body: page([{ id: 'b-1', title: 'Trekking kit', state: 'Live', ownerKind: 'Creator', discountPercent: 10, myRole: 'Owner', itemCount: 2, shopCount: 2 }]) },
    });
    renderBundles('/bundles?state=Live');
    const card = await screen.findByTestId('bundle-b-1');
    expect(within(card).getByTestId('bundle-state')).toHaveTextContent('Live');
    const search = calls.find((c) => c.path === '/v1/bundles/mine')!.search;
    expect(search).toContain('as=owner');
    expect(search).toContain('state=Live');
  });

  it('says bundles are being set up on a bare 404', async () => {
    mockApi({});
    renderBundles('/bundles');
    expect(await screen.findByTestId('state-setting-up')).toBeInTheDocument();
    expect(screen.queryByText('No bundles yet')).toBeNull();
  });

  it('creates a bundle from partner products only', async () => {
    const created = wire({ id: 'b-new', state: 'Draft' });
    const calls = mockApi({
      'GET /v1/bundles/mine': { body: page([]) },
      'GET /v1/tag-picker/items': {
        body: page([
          { productId: 'p-1', name: 'Trail shoes', primaryImageUrl: null, vendorAccountId: HIMAL, vendorDisplayName: 'Himal Outdoors', isService: false, displayPrice: { amount: 8000, currency: 'NPR' } },
          { productId: 'p-9', name: 'Random hat', primaryImageUrl: null, vendorAccountId: 'v-x', vendorDisplayName: 'Hat Shop', isService: false, displayPrice: { amount: 900, currency: 'NPR' } },
        ]),
      },
      'GET /v1/creator/tag-products/commission': {
        body: {
          items: [
            { productId: 'p-1', status: 'Applies', commissionRateFraction: 0.1 },
            { productId: 'p-9', status: 'NoPartnership', commissionRateFraction: null },
          ],
        },
      },
      'POST /v1/bundles': { body: created },
      'GET /v1/bundles/b-new': { body: created },
    });
    renderBundles('/bundles');
    await userEvent.click((await screen.findAllByRole('button', { name: /New bundle/ }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New bundle' });
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Trekking kit');
    expect(await within(dialog).findByRole('checkbox', { name: 'Random hat (No active partnership)' })).toBeDisabled();
    expect(within(dialog).getByText(/you earn 10%/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Trail shoes' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(writes(calls)[0]?.body).toEqual({ title: 'Trekking kit', description: null, coverImageUrl: null, discountPercent: 10, items: [{ productId: 'p-1', quantity: 1 }] }),
    );
    expect(await screen.findByText(/Only you can see this draft/)).toBeInTheDocument();
  });

  it('shows shop acceptance, commission per item and my earning', async () => {
    mockApi({ 'GET /v1/bundles/b-1': { body: wire() } });
    renderBundles('/bundles/b-1');
    expect(await screen.findByText(/1 of 2 shops have accepted terms version 1/)).toBeInTheDocument();
    expect(screen.getByTestId(`shop-${HIMAL}`)).toHaveTextContent('Accepted');
    expect(screen.getByTestId(`shop-${PEAK}`)).toHaveTextContent('Waiting to accept');
    expect(screen.getByTestId('item-it-2')).toHaveTextContent('Your commission 8%');
    expect(screen.getByTestId('creator-earning')).toHaveTextContent('Rs 1,584');
    expect(screen.queryByRole('button', { name: /Invite/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy share link/ })).toBeNull();
  });

  it('copies the share link of a live bundle and archives it after confirming', async () => {
    const show = vi.spyOn(notifications, 'show');
    const live = wire({ state: 'Live', shops: wire().shops.map((s) => ({ ...s, state: 'Accepted', acceptedTermsVersion: 1 })) });
    const calls = mockApi({ 'GET /v1/bundles/b-1': { body: live }, 'POST /v1/bundles/b-1/archive': { body: { ...live, state: 'Archived' } } });
    renderBundles('/bundles/b-1');
    await userEvent.click(await screen.findByRole('button', { name: /Copy share link/ }));
    // Copied — or, where the clipboard is blocked, shown in the toast. Either way it is the web shop's /shop/b/{id}.
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/\/shop\/b\/b-1/) })));
    show.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: /^Archive$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive bundle' }));
    await waitFor(() => expect(writes(calls).map((c) => c.path)).toEqual(['/v1/bundles/b-1/archive']));
    expect(await screen.findByText(/Archived: buyers no longer see it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull();
  });
});
