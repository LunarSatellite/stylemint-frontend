import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { ApiError } from '../../api/client';
import { ACCOUNT_ID, mockApi, renderWithProviders } from '../../test/utils';
import { page, signInVendor } from '../services/testkit';
import {
  bundleErrorMessage,
  bundlePermissions,
  discountedPrice,
  normalizeBundle,
  previewTotals,
  resumeBlocker,
  shopFunding,
  submitBlocker,
  termsChangeWarning,
  unitDiscount,
  validateBundleText,
} from './api';
import BundleDetailPage from './BundleDetailPage';
import BundlesPage from './BundlesPage';

vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

const ME = ACCOUNT_ID;
const PEAK = 'vendor-peak';

function item(patch: Record<string, unknown> = {}) {
  return {
    id: 'it-1',
    productId: 'p-1',
    vendorAccountId: ME,
    title: 'Trail shoes',
    thumbnailUrl: null,
    quantity: 1,
    listUnitPrice: 8000,
    bundleUnitPrice: 7200,
    commissionRatePercent: null,
    shopFunds: 800,
    available: true,
    ...patch,
  };
}

function wire(patch: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    title: 'Trekking kit',
    description: null,
    coverImageUrl: null,
    ownerKind: 'Vendor',
    ownerAccountId: ME,
    ownerName: 'Himal Outdoors',
    discountPercent: 10,
    state: 'Draft',
    termsVersion: 1,
    pausedReason: null,
    myRole: 'Owner',
    myShopState: 'Accepted',
    shops: [{ vendorAccountId: ME, name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 1 }],
    items: [item()],
    totals: { listTotal: 8000, bundleTotal: 7200, saving: 800, currency: 'NPR' },
    ...patch,
  };
}

const TWO_SHOPS = {
  shops: [
    { vendorAccountId: ME, name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 2 },
    { vendorAccountId: PEAK, name: 'Peak Gear', state: 'Pending', acceptedTermsVersion: null },
  ],
  items: [item(), item({ id: 'it-2', productId: 'p-2', vendorAccountId: PEAK, title: 'Down jacket', listUnitPrice: 12000, bundleUnitPrice: 10800, shopFunds: 1200 })],
  totals: { listTotal: 20000, bundleTotal: 18000, saving: 2000, currency: 'NPR' },
  termsVersion: 2,
};

/** The same two-shop bundle as Peak Gear sees it (a shop that has not accepted yet). */
const asPeak = (patch: Record<string, unknown> = {}) =>
  wire({
    ...TWO_SHOPS,
    ownerAccountId: 'vendor-himal',
    state: 'PendingAcceptance',
    myRole: 'Shop',
    myShopState: 'Pending',
    shops: [
      { vendorAccountId: 'vendor-himal', name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 2 },
      { vendorAccountId: ME, name: 'Peak Gear', state: 'Pending', acceptedTermsVersion: null },
    ],
    items: [
      item({ vendorAccountId: 'vendor-himal' }),
      item({ id: 'it-2', productId: 'p-2', vendorAccountId: ME, title: 'Down jacket', listUnitPrice: 12000, bundleUnitPrice: 10800, shopFunds: 1200 }),
    ],
    ...patch,
  });

beforeEach(async () => {
  await signInVendor();
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

describe('bundle rules', () => {
  it('rounds the discount like the server and previews totals', () => {
    expect(unitDiscount(999, 15)).toBe(149.85);
    expect(unitDiscount(0.05, 10)).toBe(0.01); // 0.005 rounds away from zero
    expect(discountedPrice(12000, 10)).toBe(10800);
    expect(previewTotals([{ price: 12000, quantity: 1 }, { price: 8000, quantity: 2 }], 10)).toEqual({ listTotal: 28000, bundleTotal: 25200, saving: 2800 });
  });

  it('accepts enum names or numbers on the wire', () => {
    const b = normalizeBundle(wire({ state: 2, ownerKind: 2, myRole: 2, myShopState: 2, pausedReason: 4 }));
    expect(b).toMatchObject({ state: 'PendingAcceptance', ownerKind: 'Creator', myRole: 'Shop', myShopState: 'Pending', pausedReason: 'AdminTakedown' });
    expect(normalizeBundle(wire({ state: 'live' })).state).toBe('Live');
    expect(normalizeBundle(wire({ state: 42 })).state).toBe('Unknown');
  });

  it('validates the title, cover link and discount', () => {
    const ok = { title: 'Kit', description: '', coverImageUrl: '', discountPercent: 10 };
    expect(validateBundleText(ok)).toBeNull();
    expect(validateBundleText({ ...ok, title: ' ' })).toMatch(/title/);
    expect(validateBundleText({ ...ok, title: 'x'.repeat(81) })).toMatch(/80/);
    expect(validateBundleText({ ...ok, coverImageUrl: 'http://x.test/a.jpg' })).toMatch(/https/);
    expect(validateBundleText({ ...ok, discountPercent: 51 })).toMatch(/between 0 and 50/);
    expect(validateBundleText({ ...ok, discountPercent: 0 })).toBeNull();
    expect(validateBundleText({ ...ok, discountPercent: 10.123 })).toMatch(/2 decimals/);
  });

  it('gates sending and resuming', () => {
    const one = normalizeBundle(wire());
    expect(submitBlocker(one)).toMatch(/at least 2 items/);
    expect(submitBlocker(normalizeBundle(wire(TWO_SHOPS)))).toBeNull();
    expect(resumeBlocker(normalizeBundle(wire({ ...TWO_SHOPS, state: 'Paused', pausedReason: 'ShopWithdrew' })))).toMatch(/Every shop must accept/);
    expect(resumeBlocker(normalizeBundle(wire({ state: 'Paused', pausedReason: 'AdminTakedown' })))).toMatch(/only StyleMint/);
    expect(resumeBlocker(normalizeBundle(wire({ state: 'Paused', pausedReason: 'OwnerPaused' })))).toBeNull();
  });

  it('gives owner and shop their own actions', () => {
    const owner = bundlePermissions(normalizeBundle(wire({ ...TWO_SHOPS, state: 'Live' })), ME);
    expect(owner).toMatchObject({ canEdit: true, canInvite: true, canPause: true, canSubmit: false, canDecline: false, canWithdraw: false, canShare: true });
    const shop = bundlePermissions(normalizeBundle(asPeak()), ME);
    expect(shop).toMatchObject({ owner: false, canAccept: true, canDecline: true, canWithdraw: false, canEdit: false, canInvite: false, canShare: false });
    const b = normalizeBundle(asPeak());
    expect(shop.canEditItem(b.items[1]!)).toBe(true);
    expect(shop.canEditItem(b.items[0]!)).toBe(false);
    expect(bundlePermissions(normalizeBundle(asPeak({ myShopState: 'Accepted' })), ME)).toMatchObject({ canAccept: false, canWithdraw: true });
    expect(bundlePermissions(normalizeBundle(wire({ state: 'Archived' })), ME)).toMatchObject({ canEdit: false, canArchive: false, canAddItems: false });
  });

  it('warns that an items / discount change asks every other shop again', () => {
    expect(termsChangeWarning(normalizeBundle(wire()), ME)).toBeNull();
    expect(termsChangeWarning(normalizeBundle(wire({ ...TWO_SHOPS, state: 'Live' })), ME)).toMatch(/version 2 → 3\). The other shop must accept again. It goes off sale/);
  });

  it('adds up what one shop funds and maps error codes', () => {
    expect(shopFunding(normalizeBundle(asPeak()).items, ME)).toBe(1200);
    expect(shopFunding(normalizeBundle(asPeak({ items: [item({ vendorAccountId: ME, shopFunds: null, quantity: 2 })] })).items, ME)).toBe(1600);
    expect(bundleErrorMessage(new ApiError(409, 'Conflict', 'bundle_terms_changed', null))).toMatch(/terms changed/);
    expect(bundleErrorMessage(new ApiError(400, 'Bad', 'bundle.item_not_own', null))).toMatch(/your own products/);
    expect(bundleErrorMessage(new ApiError(400, 'Something specific', 'other.code', null))).toBe('Something specific');
  });
});

describe('bundles list', () => {
  it('shows each bundle with a clear state badge and my shop state', async () => {
    const calls = mockApi({
      'GET /v1/bundles/mine': {
        body: page([
          { id: 'b-1', title: 'Trekking kit', state: 'Live', ownerKind: 'Vendor', discountPercent: 10, myRole: 'Owner', itemCount: 3, shopCount: 2, isPurchasable: false },
          { id: 'b-2', title: 'Draft kit', state: 1, ownerKind: 3, discountPercent: 5, myRole: 1, itemCount: 1 },
        ]),
      },
    });
    renderBundles('/bundles');
    const live = await screen.findByTestId('bundle-b-1');
    expect(within(live).getByTestId('bundle-state')).toHaveTextContent('Live');
    expect(live).toHaveTextContent('Item out of stock');
    expect(within(screen.getByTestId('bundle-b-2')).getByTestId('bundle-state')).toHaveTextContent('Draft');
    expect(calls.find((c) => c.path === '/v1/bundles/mine')!.search).toContain('as=owner');
  });

  it('lists invitations as a shop and flags those waiting for me', async () => {
    const calls = mockApi({
      'GET /v1/bundles/mine': {
        body: page([{ id: 'b-3', title: 'Creator kit', state: 'PendingAcceptance', ownerKind: 'Creator', ownerName: 'Asha Treks', discountPercent: 10, myRole: 'Shop', myShopState: 'Pending' }]),
      },
    });
    renderBundles('/bundles?as=shop&state=PendingAcceptance');
    const card = await screen.findByTestId('bundle-b-3');
    expect(card).toHaveTextContent('Waiting for shops');
    expect(card).toHaveTextContent('Waiting to accept');
    expect(card).toHaveTextContent('by Asha Treks');
    expect(screen.getByText(/1 bundle is waiting for you/)).toBeInTheDocument();
    const search = calls.find((c) => c.path === '/v1/bundles/mine')!.search;
    expect(search).toContain('as=shop');
    expect(search).toContain('state=PendingAcceptance');
  });

  it('says bundles are being set up on a bare 404, never "no bundles"', async () => {
    mockApi({});
    renderBundles('/bundles');
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent('Bundles are being set up');
    expect(screen.queryByText('No bundles yet')).toBeNull();
    expect(screen.queryByRole('button', { name: /New bundle/ })).toBeNull();
  });

  it('creates a bundle from my own products', async () => {
    const created = wire({ id: 'b-new' });
    const calls = mockApi({
      'GET /v1/bundles/mine': { body: page([]) },
      'GET /v1/vendor/products': {
        body: page([
          {
            id: 'p-1',
            name: 'Trail shoes',
            state: 2,
            isInStock: true,
            defaultVariantId: 'v-1',
            variants: [{ id: 'v-1', isDefault: true, priceAmount: 8000 }],
            images: [],
          },
          { id: 'p-2', name: 'Trekking poles', state: 2, isInStock: true, defaultVariantId: 'v-2', variants: [{ id: 'v-2', isDefault: true, priceAmount: 2000 }], images: [] },
        ]),
      },
      'POST /v1/bundles': { body: created },
      'GET /v1/bundles/b-new': { body: created },
    });
    renderBundles('/bundles');
    await userEvent.click((await screen.findAllByRole('button', { name: /New bundle/ }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New bundle' });
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Trekking kit');
    const save = within(dialog).getByRole('button', { name: 'Save draft' });
    expect(save).toBeDisabled();
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Trail shoes' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Trekking poles' }));
    const qty = within(dialog).getByLabelText('Quantity of Trekking poles');
    await userEvent.type(qty, '2', { initialSelectionStart: 0, initialSelectionEnd: 1 });
    expect(within(dialog).getByTestId('create-preview')).toHaveTextContent('Rs 12,000 separately → Rs 10,800 as a bundle');
    await userEvent.click(save);
    await waitFor(() =>
      expect(writes(calls)[0]?.body).toEqual({
        title: 'Trekking kit',
        description: null,
        coverImageUrl: null,
        discountPercent: 10,
        items: [
          { productId: 'p-1', quantity: 1 },
          { productId: 'p-2', quantity: 2 },
        ],
      }),
    );
    expect(writes(calls)[0]!.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByText(/Only you can see this draft/)).toBeInTheDocument();
  });
});

describe('bundle detail — owner', () => {
  it('blocks sending a draft with one item and explains why', async () => {
    mockApi({ 'GET /v1/bundles/b-1': { body: wire() } });
    renderBundles('/bundles/b-1');
    expect(await screen.findByTestId('submit-blocker')).toHaveTextContent('Add at least 2 items (1 so far)');
    expect(screen.getByRole('button', { name: /Send for acceptance/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Copy share link/ })).toBeNull();
  });

  it('sends a ready draft to the shops after confirming', async () => {
    const calls = mockApi({
      'GET /v1/bundles/b-1': { body: wire(TWO_SHOPS) },
      'POST /v1/bundles/b-1/submit': { body: wire({ ...TWO_SHOPS, state: 'PendingAcceptance' }) },
    });
    renderBundles('/bundles/b-1');
    await userEvent.click(await screen.findByRole('button', { name: /Send for acceptance/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/The other shop is asked to accept the 10% discount/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send for acceptance' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ method: 'POST', path: '/v1/bundles/b-1/submit' })]));
    expect(await screen.findByText(/1 of 2 shops have accepted terms version 2/)).toBeInTheDocument();
    expect(screen.getByTestId('bundle-state')).toHaveTextContent('Waiting for shops');
  });

  it('invites a shop found by name, with a note', async () => {
    const calls = mockApi({
      'GET /v1/bundles/b-1': { body: wire() },
      'GET /v1/vendor/journeys/vendors': {
        body: [
          { vendorAccountId: ME, businessName: 'Himal Outdoors', logoUrl: null, city: null, isVerified: true },
          { vendorAccountId: PEAK, businessName: 'Peak Gear', logoUrl: null, city: 'Pokhara', isVerified: false },
        ],
      },
      'POST /v1/bundles/b-1/invites': { body: wire({ shops: [...wire().shops, { vendorAccountId: PEAK, name: 'Peak Gear', state: 'Invited', acceptedTermsVersion: null }] }) },
    });
    renderBundles('/bundles/b-1');
    await userEvent.click(await screen.findByRole('button', { name: /Invite a shop/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a shop' });
    await userEvent.type(within(dialog).getByLabelText('Shop name'), 'Pe');
    expect(await within(dialog).findByRole('listitem', { name: 'Himal Outdoors (already in this bundle)' }, { timeout: 2000 })).toBeDisabled();
    // The bundle vendor search is tried first; its bare 404 falls back to the journeys directory.
    expect(calls.some((c) => c.path === '/v1/bundles/vendors')).toBe(true);
    await userEvent.click(within(dialog).getByRole('listitem', { name: 'Peak Gear' }));
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Add your jacket?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/bundles/b-1/invites', body: { vendorAccountId: PEAK, note: 'Add your jacket?' } })]));
    expect(await screen.findByTestId(`shop-${PEAK}`)).toHaveTextContent('Invited');
  });

  it('pauses a live bundle and shows the out-of-stock item', async () => {
    const live = wire({ ...TWO_SHOPS, state: 'Live', shops: TWO_SHOPS.shops.map((s) => ({ ...s, state: 'Accepted', acceptedTermsVersion: 2 })), items: [TWO_SHOPS.items[0], { ...TWO_SHOPS.items[1], available: false }] });
    const calls = mockApi({
      'GET /v1/bundles/b-1': { body: live },
      'POST /v1/bundles/b-1/pause': { body: { ...live, state: 'Paused', pausedReason: 'OwnerPaused' } },
    });
    renderBundles('/bundles/b-1');
    expect(await screen.findByTestId('availability')).toHaveTextContent('Out of stock: Down jacket');
    expect(screen.getByRole('button', { name: /Copy share link/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Pause$/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pause bundle' }));
    await waitFor(() => expect(writes(calls).map((c) => c.path)).toEqual(['/v1/bundles/b-1/pause']));
    expect(await screen.findByRole('button', { name: /Resume/ })).toBeEnabled();
    expect(screen.getByTestId('bundle-state')).toHaveTextContent('Paused');
  });
});

describe('bundle detail — invited shop', () => {
  it('shows what the shop funds and accepts the current terms version', async () => {
    const calls = mockApi({
      'GET /v1/bundles/b-1': { body: asPeak() },
      'POST /v1/bundles/b-1/accept': { body: asPeak({ state: 'Live', myShopState: 'Accepted' }) },
    });
    renderBundles('/bundles/b-1');
    expect(await screen.findByTestId('funding')).toHaveTextContent('You fund Rs 1,200 of the discount on your items');
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archive/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Accept terms v2' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('platform commission is charged on the discounted price');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept terms' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/bundles/b-1/accept', body: { termsVersion: 2 } })]));
    expect(await screen.findByRole('button', { name: /Withdraw/ })).toBeInTheDocument();
  });

  it('re-reads the bundle when the terms changed meanwhile', async () => {
    const show = vi.spyOn(notifications, 'show');
    let reads = 0;
    mockApi({
      'GET /v1/bundles/b-1': () => {
        reads += 1;
        return { body: reads === 1 ? asPeak() : asPeak({ termsVersion: 3 }) };
      },
      'POST /v1/bundles/b-1/accept': { status: 409, body: { title: 'Conflict', status: 409, errorCode: 'bundle_terms_changed' } },
    });
    renderBundles('/bundles/b-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Accept terms v2' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept terms' }));
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/terms changed/) })));
    expect(await screen.findByRole('button', { name: 'Accept terms v3' })).toBeInTheDocument();
    show.mockRestore();
  });

  it('declines with a reason', async () => {
    const calls = mockApi({
      'GET /v1/bundles/b-1': { body: asPeak() },
      'POST /v1/bundles/b-1/decline': { body: asPeak({ myShopState: 'Declined' }) },
    });
    renderBundles('/bundles/b-1');
    await userEvent.click(await screen.findByRole('button', { name: /^Decline$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Decline the bundle?' });
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Discount too high');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/bundles/b-1/decline', body: { reason: 'Discount too high' } })]));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Accept terms/ })).toBeNull());
  });

  it('asks an invited shop of a vendor bundle to add its own products first', async () => {
    mockApi({
      'GET /v1/bundles/b-1': {
        body: asPeak({
          myShopState: 'Invited',
          items: [item({ vendorAccountId: 'vendor-himal' })],
          shops: [
            { vendorAccountId: 'vendor-himal', name: 'Himal Outdoors', state: 'Accepted', acceptedTermsVersion: 2 },
            { vendorAccountId: ME, name: 'Peak Gear', state: 'Invited', acceptedTermsVersion: null, inviteNote: 'Add your jacket?' },
          ],
        }),
      },
    });
    renderBundles('/bundles/b-1');
    expect(await screen.findByText('Himal Outdoors invited you to this bundle')).toBeInTheDocument();
    expect(screen.getByText('“Add your jacket?”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept terms/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Add my products/ }).length).toBeGreaterThan(0);
  });

  it('says "Bundle not found" for a bundle the shop is no longer in', async () => {
    mockApi({ 'GET /v1/bundles/b-9': { status: 404, body: { title: 'Not found', status: 404, errorCode: 'bundle_not_found' } } });
    renderBundles('/bundles/b-9');
    expect(await screen.findByText('Bundle not found')).toBeInTheDocument();
  });
});
