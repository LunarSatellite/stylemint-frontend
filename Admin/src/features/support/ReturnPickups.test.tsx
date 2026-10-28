import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { ReturnsPage } from './ReturnsPage';

const RET = {
  id: 'rr-1',
  orderId: 'o-1',
  orderNumber: 'SM-1001',
  subOrderId: 'so-1',
  vendorAccountId: 'v-1',
  customerAccountId: 'c-1',
  productTitleSnapshot: 'Linen shirt',
  variantLabelSnapshot: 'M',
  thumbnailUrlSnapshot: null,
  quantity: 1,
  reason: 'Torn',
  state: 2,
  resolution: 1,
  submittedUtc: '2026-10-27T08:00:00Z',
  resolvedUtc: null,
  rejectionNote: null,
  reasonCategory: 'ChangedMind',
  pickupFarePayer: 'Buyer',
  pickupStage: 'Collected',
};

const PICKUP = {
  id: 'rp-1',
  returnRequestId: 'rr-1',
  orderId: 'o-1',
  subOrderId: 'so-1',
  trackingNumber: 'SM-R-00000042',
  state: 3,
  stage: 'Collected',
  mode: 'Rider',
  packageId: 'pk-9',
  requestedUtc: '2026-10-27T09:00:00Z',
  pickedUpUtc: '2026-10-27T10:00:00Z',
  receivedUtc: null,
  requestExpiresUtc: null,
  rider: { displayName: 'Ramesh K.', avatarUrl: null, rating: 4.8, vehicle: 'Bike' },
  attempts: { failed: 1, max: 3, lastFailureCode: 'BuyerUnreachable' },
  collectionPhotoUrls: ['https://cdn.test/p1.jpg'],
  fare: { payer: 'Buyer', amount: { amount: 150, currency: 'NPR' }, upTo: { amount: 185, currency: 'NPR' }, isFinal: true },
  hops: [{ id: 'h-1', status: 'Failed', failureCode: 'BuyerUnreachable', createdUtc: '2026-10-27T09:05:00Z' }, { id: 'h-2', status: 'PickedUp', createdUtc: '2026-10-27T09:40:00Z' }],
  proofs: [{ id: 'pr-1', purpose: 'ReturnPickup', status: 'Confirmed', createdUtc: '2026-10-27T09:58:00Z', confirmedUtc: '2026-10-27T10:00:00Z' }],
};

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('return pickups (read-only)', () => {
  it('shows the pickup in the return drawer: stage, rider, fare, payer, attempts, photos, hops and proofs', async () => {
    signInAs(['SupportAgent']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/support/returns') return { body: [RET] };
      if (req.path === '/v1/admin/support/returns/rr-1/evidence') return { body: { collectedUtc: '', hasEvidence: false, hasDiscrepancy: false, sources: [], facts: [], findings: [] } };
      if (req.path === '/v1/admin/delivery/return-pickups/rr-1') return { body: PICKUP };
      return undefined;
    });
    renderWithProviders(<ReturnsPage />, { route: '/returns?state=2&open=rr-1' });
    const facts = await screen.findByTestId('admin-return-pickup');
    expect(facts).toHaveTextContent('Collected');
    expect(facts).toHaveTextContent('SM-R-00000042');
    expect(facts).toHaveTextContent('Ramesh K.');
    expect(facts).toHaveTextContent('Buyer (from the refund)');
    expect(facts).toHaveTextContent('1 of 3 · last: Buyer unreachable');
    expect(within(facts).getByRole('img', { name: 'Collection photo' })).toBeInTheDocument();
    expect(within(facts).getByRole('table', { name: 'Hops' })).toHaveTextContent('Failed');
    expect(within(facts).getByRole('table', { name: 'Proofs' })).toHaveTextContent('Buyer hand-over');
    expect(screen.getByText('Changed mind')).toBeInTheDocument();
  });

  it('says the pickup is not available yet when the endpoint is not deployed', async () => {
    signInAs(['SupportAgent']);
    mockFetch((req) => (req.path === '/v1/admin/support/returns' ? { body: [{ ...RET, pickupStage: undefined }] } : undefined));
    renderWithProviders(<ReturnsPage />, { route: '/returns?state=2&open=rr-1' });
    expect(await screen.findByText(/return pickup details isn’t available on this server yet/i)).toBeInTheDocument();
  });

  it('lists pickups filtered by stage and labels unknown stages', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) =>
      req.path === '/v1/admin/delivery/return-pickups'
        ? { body: { items: [PICKUP, { ...PICKUP, id: 'rp-2', returnRequestId: 'rr-2', trackingNumber: 'SM-R-00000043', stage: 'RiderOnTheMoon' }], nextCursor: null, hasMore: false } }
        : undefined,
    );
    renderWithProviders(<ReturnsPage />, { route: '/returns?view=pickups&stage=Collected' });
    const table = await screen.findByRole('table', { name: 'Return pickups' });
    const rows = within(table).getAllByTestId('table-row');
    expect(rows[0]).toHaveTextContent('SM-R-00000042');
    expect(rows[0]).toHaveTextContent('Collected');
    expect(rows[1]).toHaveTextContent('Rider on the moon');
    expect(calls.find((c) => c.path === '/v1/admin/delivery/return-pickups')!.url).toContain('stage=Collected');
  });
});
