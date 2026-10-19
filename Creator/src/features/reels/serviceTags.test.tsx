import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import { displayPriceLabel, reelsApi, tileFromTaggable, tilePriceLabel, type Reel, type TaggableItem } from './api';
import ReelDetailPage from './ReelDetailPage';

const REEL_ID = 'aaaaaaaa-0000-0000-0000-000000000002';

function reel(extra: Partial<Reel> = {}): Reel {
  return {
    id: REEL_ID,
    sourcePlatform: 1,
    sourceUrl: 'https://www.instagram.com/reel/Cx2/',
    externalId: 'Cx2',
    durationSeconds: 30,
    musicTrackTitle: null,
    musicArtistName: null,
    caption: 'Pokhara weekend',
    thumbnailCdnUrl: null,
    videoCdnUrl: null,
    isAiGenerated: null,
    state: 1,
    publishedAtUtc: null,
    likeCount: 0,
    viewCount: 0,
    saveCount: 0,
    shareCount: 0,
    commentsSnapshot: 0,
    createdUtc: '2026-10-19T10:00:00Z',
    updatedUtc: '2026-10-19T10:00:00Z',
    taggedProducts: [],
    ...extra,
  };
}

function item(patch: Partial<TaggableItem> = {}): TaggableItem {
  return {
    productId: 'lst-hotel',
    name: 'Lakeside Retreat',
    primaryImageUrl: null,
    vendorAccountId: 'v-hotel',
    vendorDisplayName: 'Lakeside Hotels',
    isService: true,
    serviceType: 1,
    serviceListingId: 'lst-hotel',
    displayPrice: { amount: 4500, currency: 'NPR', unit: 'night', isFrom: true, label: 'from Rs 4,500/night' },
    addableToCart: true,
    defaultVariantId: 'var-hotel',
    createdUtc: '2026-10-19T00:00:00Z',
    ...patch,
  };
}

const items = [
  item(),
  item({
    productId: 'pkg-abc',
    name: 'Annapurna Base Camp',
    serviceType: 2,
    serviceListingId: 'pkg-abc',
    displayPrice: { amount: 45000, currency: 'NPR', unit: 'person', isFrom: false, label: 'Rs 45,000 per person' },
  }),
  item({
    productId: 'p-kurta',
    name: 'Silk kurta',
    isService: false,
    serviceType: null,
    serviceListingId: null,
    displayPrice: { amount: 4500, currency: 'NPR', unit: null, isFrom: false, label: 'Rs 4,500' },
  }),
];

const applies = (productId: string) => ({
  productId,
  status: 'Applies',
  partnershipId: 'ps-1',
  commissionRateFraction: 0.1,
  commissionRateMinFraction: 0.1,
  commissionRateMaxFraction: 0.1,
  unitPrice: { amount: 4500, currency: 'NPR' },
  commissionPerSale: { amount: 450, currency: 'NPR' },
});

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/reels/:id" element={<ReelDetailPage />} />
    </Routes>,
    { route: `/reels/${REEL_ID}` },
  );
}

describe('service price labels', () => {
  it('prefers the server label and falls back per unit', () => {
    expect(displayPriceLabel({ amount: 4500, currency: 'NPR', unit: 'night', isFrom: true, label: null }, 1, null)).toBe('from Rs 4,500/night');
    expect(displayPriceLabel({ amount: 45000, currency: 'NPR', unit: 'person', isFrom: false, label: null }, 2, null)).toBe('Rs 45,000 per person');
    expect(displayPriceLabel({ amount: null, currency: 'NPR', unit: 'person', isFrom: false, label: null }, 2, null)).toBe('Dates coming soon');
    expect(displayPriceLabel({ amount: null, currency: 'NPR', unit: null, isFrom: false, label: null }, 3, null)).toBe('Enquiry only');
    // An older tag without displayPrice keeps the snapshot price.
    expect(displayPriceLabel(null, null, { amount: 1250, currency: 'NPR' })).toBe('Rs 1,250');
    expect(tilePriceLabel(tileFromTaggable(item()))).toBe('from Rs 4,500/night');
  });
});

describe('tag picker includes service items', () => {
  beforeEach(() => __resetSessionForTests());

  it('searches the tag picker (products + services) and shows each service’s price label', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel() },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [] },
      'GET /v1/tag-picker/items': { body: { items, totalCount: 3, nextCursor: null, previousCursor: null, pageSize: 20, hasMore: false } },
      'GET /v1/creator/tag-products/commission': { body: { items: items.map((i) => applies(i.productId)) } },
      [`POST /v1/creator/reels/${REEL_ID}/tagged-products`]: (c) => ({ body: { id: 't1', reelId: REEL_ID, ...(c.body as object) } }),
    });
    renderDetail();
    await user.click(await screen.findByRole('button', { name: /tag a product/i }));
    await user.type(await screen.findByLabelText(/find a product or service/i), 'pokhara');

    const hotel = await screen.findByTestId('pick-lst-hotel');
    expect(within(hotel).getByTestId('price-label')).toHaveTextContent('from Rs 4,500/night');
    expect(within(hotel).getByTestId('service-badge')).toHaveTextContent('Hotel stay');
    const trek = screen.getByTestId('pick-pkg-abc');
    expect(within(trek).getByTestId('price-label')).toHaveTextContent('Rs 45,000 per person');
    expect(within(trek).getByTestId('service-badge')).toHaveTextContent('Travel package');
    expect(within(screen.getByTestId('pick-p-kurta')).queryByTestId('service-badge')).not.toBeInTheDocument();

    const picker = calls.find((c) => c.path === '/v1/tag-picker/items')!;
    expect(picker.search).toContain('q=pokhara');
    expect(picker.search).toContain('scope=all');
    expect(picker.search).not.toContain('kind=');
    expect(calls.some((c) => c.path === '/api/v1/customer/search')).toBe(false);

    // A service item is tagged with its productId, exactly like a product.
    await waitFor(() => expect(within(hotel).getByRole('button', { name: /tag lakeside retreat/i })).toBeEnabled());
    await user.click(within(hotel).getByRole('button', { name: /tag lakeside retreat/i }));
    await user.click(await screen.findByRole('button', { name: /^tag product$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/tagged-products'))).toBe(true));
    expect((calls.find((c) => c.method === 'POST')!.body as { productId: string }).productId).toBe('lst-hotel');
  });

  it('falls back to the product search while the tag picker is not deployed', async () => {
    const calls = mockApi({
      'GET /api/v1/customer/search': {
        body: { products: [{ productId: 'p-kurta', name: 'Silk kurta', heroImageUrl: '', price: 4500, currency: 'NPR', brandName: 'Hamro Silk', isOutOfStock: false, isSponsored: false, sponsoredLabel: null }] },
      },
    });
    const res = await reelsApi.searchProducts('silk');
    expect(res.map((p) => p.productId)).toEqual(['p-kurta']);
    expect(calls.map((c) => c.path)).toEqual(['/v1/tag-picker/items', '/api/v1/customer/search']);
  });

  it('asks for products only when services are excluded (collections)', async () => {
    const calls = mockApi({ 'GET /v1/tag-picker/items': { body: { items: [], totalCount: 0, nextCursor: null, previousCursor: null, pageSize: 20, hasMore: false } } });
    await reelsApi.searchProducts('silk', { includeServices: false });
    expect(calls[0].search).toContain('kind=product');
  });

  it('shows a tagged service with its current price label and booking commission', async () => {
    const tag = {
      id: 't9',
      reelId: REEL_ID,
      productId: 'lst-hotel',
      partnershipIdSnapshot: 'ps-1',
      commissionRateSnapshotPercent: 10,
      productPriceSnapshotAmount: 4000,
      productPriceSnapshotCurrency: 'NPR',
      commissionPerSaleSnapshotAmount: 400,
      commissionPerSaleSnapshotCurrency: 'NPR',
      overlayPositionX: 0.5,
      overlayPositionY: 0.7,
      appearAtSeconds: null,
      disappearAtSeconds: null,
      createdUtc: '2026-10-19T10:00:00Z',
      productName: 'Lakeside Retreat',
      productPrimaryImageUrl: null,
      vendorAccountId: 'v-hotel',
      vendorDisplayName: 'Lakeside Hotels',
      isService: true,
      serviceType: 1,
      serviceListingId: 'lst-hotel',
      displayPrice: { amount: 4500, currency: 'NPR', unit: 'night', isFrom: true, label: 'from Rs 4,500/night' },
      addableToCart: true,
    };
    mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel({ taggedProducts: [tag] }) },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [tag] },
    });
    renderDetail();
    expect(await screen.findByTestId('tag-price')).toHaveTextContent('from Rs 4,500/night');
    expect(screen.getByTestId('service-badge')).toHaveTextContent('Hotel stay');
    expect(screen.getByText('10% · Rs 400 per booking')).toBeInTheDocument();
  });
});
