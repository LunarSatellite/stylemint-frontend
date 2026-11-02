import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bundleUnitPrice } from '../api/catalog';
import { guestCart } from '../shop/guestCart';
import { cartLine, cartView, mockApi, renderApp, resetShop, routerPath, signIn, TAG_ID } from '../test/utils';

const BUNDLE_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const ITEM_A = 'eeeeeeee-0000-4000-8000-0000000000a1';
const ITEM_B = 'eeeeeeee-0000-4000-8000-0000000000b1';
const VA_M = 'eeeeeeee-0000-4000-8000-0000000000a2';
const VA_L = 'eeeeeeee-0000-4000-8000-0000000000a3';
const VB = 'eeeeeeee-0000-4000-8000-0000000000b2';

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    id: BUNDLE_ID,
    title: 'Trekking kit',
    description: 'Everything for Poon Hill.',
    coverImageUrl: null,
    discountPercent: 10,
    termsVersion: 3,
    isPurchasable: true,
    unavailableReason: null,
    curator: { kind: 'Creator', accountId: 'c', name: 'Maya' },
    items: [
      {
        id: ITEM_A,
        productId: 'aaaaaaaa-0000-4000-8000-0000000000a0',
        quantity: 1,
        note: null,
        listUnitPrice: 12000,
        bundleUnitPrice: 10800,
        product: { id: 'pa', name: 'Down jacket', thumbnailUrl: null, vendorDisplayName: 'Peak Gear' },
        variants: [
          { id: VA_M, label: 'M', price: 12000, inStock: true },
          { id: VA_L, label: 'L', price: 12500, inStock: true },
        ],
      },
      {
        id: ITEM_B,
        productId: 'aaaaaaaa-0000-4000-8000-0000000000b0',
        quantity: 2,
        note: null,
        listUnitPrice: 4000,
        bundleUnitPrice: 3600,
        product: { id: 'pb', name: 'Wool socks', thumbnailUrl: null, vendorDisplayName: 'Himal Knits' },
        variants: [{ id: VB, label: null, price: 4000, inStock: true }],
      },
    ],
    totals: { listTotal: 20000, bundleTotal: 18000, saving: 2000, currency: 'NPR' },
    ...overrides,
  };
}

describe('bundle page', () => {
  beforeEach(() => resetShop('signedOut'));

  it('rounds the bundle price like the server (B7)', () => {
    expect(bundleUnitPrice(12000, 10)).toBe(10800);
    expect(bundleUnitPrice(99.95, 15)).toBe(84.96);
    expect(bundleUnitPrice(4000, 0)).toBe(4000);
  });

  it('adds the bundle with the chosen variants, terms version and reel tag (signed in)', async () => {
    signIn();
    const calls = mockApi({
      [`GET /v1/public/bundles/${BUNDLE_ID}`]: { body: bundle() },
      'POST /v1/cart/bundles': {
        body: cartView([cartLine({ lineId: 'x1', bundleGroupId: 'g1', bundleId: BUNDLE_ID, productTitleSnapshot: 'Down jacket' })], {
          bundles: [{ groupId: 'g1', bundleId: BUNDLE_ID, title: 'Trekking kit', quantity: 1, listTotal: 20500, total: 18450, saving: 2050, isPurchasable: true, unavailableReason: null }],
        }),
      },
      'GET /v1/cart': {
        body: cartView([cartLine({ lineId: 'x1', bundleGroupId: 'g1', bundleId: BUNDLE_ID, productTitleSnapshot: 'Down jacket' })], {
          bundles: [{ groupId: 'g1', bundleId: BUNDLE_ID, title: 'Trekking kit', quantity: 1, listTotal: 20500, total: 18450, saving: 2050, isPurchasable: true, unavailableReason: null }],
        }),
      },
    });
    const user = userEvent.setup();
    renderApp(`/b/${BUNDLE_ID}?t=${TAG_ID}&ref=MAYA`);
    expect(await screen.findByRole('heading', { name: 'Trekking kit' })).toBeInTheDocument();
    // 12000×0.9 + 2×3600 = 18000
    expect(screen.getAllByText('NPR 18,000').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'L' }));
    // 12500×0.9 + 7200 = 18450
    expect(screen.getAllByText('NPR 18,450').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Add bundle to cart' }));

    await waitFor(() => expect(calls.some((c) => c.path === '/v1/cart/bundles')).toBe(true));
    const add = calls.find((c) => c.path === '/v1/cart/bundles')!;
    expect(add.body).toEqual({
      bundleId: BUNDLE_ID,
      termsVersion: 3,
      quantity: 1,
      taggedBundleId: TAG_ID,
      affiliateCode: 'MAYA',
      variants: [
        { bundleItemId: ITEM_A, productVariantId: VA_L },
        { bundleItemId: ITEM_B, productVariantId: VB },
      ],
    });
    expect(add.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Bundle Trekking kit' })).toBeInTheDocument();
    expect(routerPath()).toBe('/cart');
  });

  it('keeps a guest’s bundle in the local cart', async () => {
    mockApi({ [`GET /v1/public/bundles/${BUNDLE_ID}`]: { body: bundle() } });
    const user = userEvent.setup();
    renderApp(`/b/${BUNDLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Add bundle to cart' }));
    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
    const items = guestCart.items();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'bundle', body: { bundleId: BUNDLE_ID, termsVersion: 3, variants: [{ bundleItemId: ITEM_A, productVariantId: VA_M }, { bundleItemId: ITEM_B, productVariantId: VB }] } });
    expect(await screen.findByRole('region', { name: 'Bundle Trekking kit' })).toBeInTheDocument();
  });

  it('refreshes and explains when the terms changed (409 bundle_terms_changed)', async () => {
    signIn();
    let version = 3;
    mockApi({
      [`GET /v1/public/bundles/${BUNDLE_ID}`]: () => ({ body: bundle({ termsVersion: version }) }),
      'POST /v1/cart/bundles': () => {
        version = 4;
        return { status: 409, body: { title: 'The bundle changed.', status: 409, errorCode: 'bundle_terms_changed' } };
      },
    });
    const user = userEvent.setup();
    renderApp(`/b/${BUNDLE_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Add bundle to cart' }));
    expect(await screen.findByText(/This bundle just changed/)).toBeInTheDocument();
    expect(routerPath()).toBe(`/b/${BUNDLE_ID}`);
  });

  it('shows not-available when the bundles endpoint is not deployed (bare 404)', async () => {
    mockApi({});
    renderApp(`/b/${BUNDLE_ID}`);
    expect(await screen.findByText('This bundle isn’t available')).toBeInTheDocument();
  });

  it('disables the button for a paused bundle', async () => {
    mockApi({ [`GET /v1/public/bundles/${BUNDLE_ID}`]: { body: bundle({ isPurchasable: false, unavailableReason: 'paused' }) } });
    renderApp(`/b/${BUNDLE_ID}`);
    expect(await screen.findByText('This bundle is paused right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add bundle to cart' })).toBeDisabled();
  });
});
