import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import { parseReelUrl, type Reel } from './api';
import ImportReelPage, { bodyFromPost } from './ImportReelPage';
import ReelDetailPage from './ReelDetailPage';

const REEL_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function reel(extra: Partial<Reel> = {}): Reel {
  return {
    id: REEL_ID,
    sourcePlatform: 1,
    sourceUrl: 'https://www.instagram.com/reel/Cx1/',
    externalId: 'Cx1',
    durationSeconds: 30,
    musicTrackTitle: null,
    musicArtistName: null,
    caption: 'Dashain look',
    thumbnailCdnUrl: null,
    videoCdnUrl: null,
    isAiGenerated: null,
    state: 1,
    publishedAtUtc: null,
    likeCount: 10,
    viewCount: 200,
    saveCount: 3,
    shareCount: 1,
    commentsSnapshot: 0,
    createdUtc: '2026-10-10T10:00:00Z',
    updatedUtc: '2026-10-10T10:00:00Z',
    taggedProducts: [],
    ...extra,
  };
}

const products = [
  { productId: 'p-kurta', name: 'Silk kurta', heroImageUrl: '', price: 4500, currency: 'NPR', brandName: 'Hamro Silk', isOutOfStock: false, isSponsored: false, sponsoredLabel: null },
  { productId: 'p-shoe', name: 'Leather shoe', heroImageUrl: '', price: 6000, currency: 'NPR', brandName: 'Other Brand', isOutOfStock: false, isSponsored: false, sponsoredLabel: null },
];

const commission = {
  items: [
    {
      productId: 'p-kurta',
      status: 'Applies',
      partnershipId: 'ps-1',
      commissionRateFraction: 0.15,
      commissionRateMinFraction: 0.1,
      commissionRateMaxFraction: 0.2,
      unitPrice: { amount: 4500, currency: 'NPR' },
      commissionPerSale: { amount: 675, currency: 'NPR' },
    },
    { productId: 'p-shoe', status: 'NoPartnership', partnershipId: null, commissionRateFraction: null, commissionRateMinFraction: null, commissionRateMaxFraction: null, unitPrice: null, commissionPerSale: null },
  ],
};

function renderDetail(route = `/reels/${REEL_ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/reels/:id" element={<ReelDetailPage />} />
      <Route path="/reels" element={<div>reels list</div>} />
    </Routes>,
    { route },
  );
}

describe('tagging products on a reel', () => {
  beforeEach(() => __resetSessionForTests());

  it('searches, shows which products can be tagged and what they earn, and tags with placement and timing', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel() },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [] },
      'GET /api/v1/customer/search': { body: { query: 'silk', products, reels: [], creators: [], brands: [], nextCursor: null, totalHits: 2, productTotal: 2 } },
      'GET /v1/creator/tag-products/commission': { body: commission },
      [`POST /v1/creator/reels/${REEL_ID}/tagged-products`]: (c) => ({ body: { id: 't1', reelId: REEL_ID, ...(c.body as object) } }),
    });
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /tag a product/i }));
    await user.type(await screen.findByLabelText(/find a product/i), 'silk');

    const results = await screen.findByTestId('product-results');
    expect(await within(results).findByText(/15% commission · Rs 675 per sale/i)).toBeInTheDocument();
    expect(within(results).getByText(/no partnership with this brand yet/i)).toBeInTheDocument();
    expect(within(results).getByRole('button', { name: /tag leather shoe/i })).toBeDisabled();

    const search = calls.find((c) => c.path === '/api/v1/customer/search')!;
    expect(search.search).toContain('type=products');
    const comm = calls.find((c) => c.path === '/v1/creator/tag-products/commission')!;
    expect(comm.search).toBe('?productIds=p-kurta&productIds=p-shoe');

    await user.click(within(results).getByRole('button', { name: /tag silk kurta/i }));
    // Show it only for part of the reel.
    await user.click(await screen.findByLabelText(/for the whole reel/i));
    // Move the tag with the keyboard: 2 steps right (+0.04), 1 up (−0.02).
    const frame = screen.getByTestId('placement-frame');
    frame.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowUp}');
    await user.click(screen.getByRole('button', { name: /^tag product$/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/tagged-products'))).toBe(true));
    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/tagged-products'))!;
    expect(post.body).toEqual({ productId: 'p-kurta', overlayPositionX: 0.54, overlayPositionY: 0.68, appearAtSeconds: 0, disappearAtSeconds: 30 });
    expect(post.headers['Idempotency-Key']).toBeTruthy();
  });

  it('explains a refusal for a brand without an active partnership', async () => {
    const user = userEvent.setup();
    mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel() },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [] },
      'GET /api/v1/customer/search': { body: { products: [products[0]] } },
      // Commission check unavailable: the picker still lets the creator try.
      'GET /v1/creator/tag-products/commission': { status: 503, body: { title: 'Unavailable', status: 503, errorCode: 'system.service_unavailable' } },
      [`POST /v1/creator/reels/${REEL_ID}/tagged-products`]: {
        status: 400,
        body: { title: "No active partnership with this product's vendor; cannot tag product.", status: 400, errorCode: 'rule.violation', field: 'partnershipId' },
      },
    });
    renderDetail();
    await user.click(await screen.findByRole('button', { name: /tag a product/i }));
    await user.type(await screen.findByLabelText(/find a product/i), 'silk');
    await user.click(await screen.findByRole('button', { name: /tag silk kurta/i }));
    await user.click(await screen.findByRole('button', { name: /^tag product$/i }));
    expect(await screen.findByTestId('tag-error')).toHaveTextContent(/need an active partnership with this brand/i);
  });

  it('moves an existing tag with a full placement replacement and removes one after confirming', async () => {
    const user = userEvent.setup();
    const tag = {
      id: 't1',
      reelId: REEL_ID,
      productId: 'p-kurta',
      partnershipIdSnapshot: 'ps-1',
      commissionRateSnapshotPercent: 15,
      productPriceSnapshotAmount: 4500,
      productPriceSnapshotCurrency: 'NPR',
      commissionPerSaleSnapshotAmount: 675,
      commissionPerSaleSnapshotCurrency: 'NPR',
      overlayPositionX: 0.3,
      overlayPositionY: 0.4,
      appearAtSeconds: 2,
      disappearAtSeconds: 9,
      createdUtc: '2026-10-10T10:00:00Z',
      productName: 'Silk kurta',
      productPrimaryImageUrl: null,
      vendorAccountId: 'v1',
      vendorDisplayName: 'Hamro Silk',
    };
    const calls = mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel({ taggedProducts: [tag] }) },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [tag] },
      [`PUT /v1/creator/reels/${REEL_ID}/tagged-products/t1`]: (c) => ({ body: { ...tag, ...(c.body as object) } }),
      [`DELETE /v1/creator/reels/${REEL_ID}/tagged-products/t1`]: { status: 204 },
    });
    renderDetail();
    expect(await screen.findByText('15% · Rs 675 per sale')).toBeInTheDocument();
    expect(screen.getByText('0:02–0:09')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit tag for silk kurta/i }));
    await user.click(await screen.findByLabelText(/for the whole reel/i)); // whole reel → clears both bounds
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ overlayPositionX: 0.3, overlayPositionY: 0.4 });

    await user.click(screen.getByRole('button', { name: /remove tag for silk kurta/i }));
    await user.click(await screen.findByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('sends a campaign reel to the brand for approval when publishing is refused', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      [`GET /v1/creator/reels/${REEL_ID}`]: { body: reel({ taggedProducts: [] }) },
      [`GET /v1/creator/reels/${REEL_ID}/tagged-products`]: { body: [] },
      [`POST /v1/creator/reels/${REEL_ID}/publish`]: {
        status: 400,
        body: { title: 'This reel carries campaign products. Submit it for approval instead.', status: 400, errorCode: 'rule.violation', field: 'reelId' },
      },
      [`POST /v1/creator/reels/${REEL_ID}/submit-for-approval`]: { body: { id: 'round-1', reelId: REEL_ID, round: 1, state: 1 } },
    });
    renderDetail();
    await user.click(await screen.findByRole('button', { name: /^publish$/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/no products are tagged/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));
    await user.type(await within(dialog).findByLabelText(/note to the brand/i), 'Shot at Patan');
    await user.click(within(dialog).getByRole('button', { name: /send for approval/i }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/submit-for-approval'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/publish'))!.body).toEqual({ isAiGenerated: false });
    expect(calls.find((c) => c.path.endsWith('/submit-for-approval'))!.body).toEqual({ note: 'Shot at Patan' });
  });
});

describe('importing a reel', () => {
  beforeEach(() => __resetSessionForTests());

  it('reads platform and id from pasted links', () => {
    expect(parseReelUrl('https://www.instagram.com/reel/C9xYz_1/?igsh=abc')).toMatchObject({ platform: 1, externalId: 'C9xYz_1' });
    expect(parseReelUrl('https://www.tiktok.com/@asha/video/7301234567890')).toMatchObject({ platform: 2, externalId: '7301234567890' });
    expect(parseReelUrl('https://youtube.com/shorts/AbCdEf12345')).toMatchObject({ platform: 3, externalId: 'AbCdEf12345' });
    expect(parseReelUrl('https://youtu.be/AbCdEf12345')).toMatchObject({ platform: 3, externalId: 'AbCdEf12345' });
    expect(parseReelUrl('https://www.facebook.com/reel/123456789')).toMatchObject({ platform: 4, externalId: '123456789' });
    expect(parseReelUrl('https://example.com/reel/1')).toBeNull();
    expect(parseReelUrl('not a link')).toBeNull();
  });

  it('sends the Meta video URL for Instagram but never for TikTok or YouTube', () => {
    const item = {
      externalId: 'x1',
      permalink: 'https://www.tiktok.com/@a/video/1',
      caption: 'hi',
      thumbnailUrl: 'https://cdn/x.jpg',
      videoUrl: 'https://cdn/x.mp4',
      mediaType: 'VIDEO',
      publishedUtc: null,
      durationSeconds: 14.6,
      likeCount: null,
      viewCount: null,
      commentCount: null,
    };
    expect(bodyFromPost('tiktok', item)).not.toHaveProperty('videoCdnUrl');
    expect(bodyFromPost('youtube', item)).not.toHaveProperty('videoCdnUrl');
    expect(bodyFromPost('instagram', item)).toMatchObject({ sourcePlatform: 1, durationSeconds: 15, videoCdnUrl: 'https://cdn/x.mp4' });
  });

  it('imports a pasted link and says so plainly when the post is already on StyleMint', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'POST /v1/creator/reels/import': {
        status: 409,
        body: { title: 'Duplicate', status: 409, errorCode: 'state.duplicate', field: 'external_id' },
      },
    });
    renderWithProviders(<ImportReelPage />, { route: '/reels/import?tab=link' });
    await user.type(await screen.findByLabelText(/link to the reel/i), 'https://www.instagram.com/reel/C9xYz_1/');
    await user.type(screen.getByLabelText(/length/i), '42');
    await user.click(screen.getByRole('button', { name: /import and tag products/i }));
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(/already on StyleMint/i);
    expect(calls.find((c) => c.path === '/v1/creator/reels/import')!.body).toEqual({
      sourcePlatform: 1,
      sourceUrl: 'https://www.instagram.com/reel/C9xYz_1/',
      externalId: 'C9xYz_1',
      durationSeconds: 42,
    });
  });

  it('offers to connect an account when none is connected — and says so differently when the list fails', async () => {
    mockApi({ 'GET /v1/social/accounts': { body: [] } });
    renderWithProviders(<ImportReelPage />, { route: '/reels/import' });
    expect(await screen.findByText(/no social account connected/i)).toBeInTheDocument();
  });

  it('shows an error, not "none", when the accounts cannot be loaded', async () => {
    mockApi({ 'GET /v1/social/accounts': { status: 500, body: { title: 'Boom', status: 500, errorCode: 'system.internal_error' } } });
    renderWithProviders(<ImportReelPage />, { route: '/reels/import' });
    expect(await screen.findByTestId('state-error')).toHaveTextContent(/could not load your social accounts/i);
    expect(screen.queryByText(/no social account connected/i)).toBeNull();
  });
});
