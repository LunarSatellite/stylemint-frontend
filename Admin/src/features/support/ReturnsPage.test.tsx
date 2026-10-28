import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import type { ReturnItem, ReturnsSummary } from '@/api/support';
import { fmtMoney } from '@/lib/format';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { ReturnsPage } from './ReturnsPage';

/** As Testing Library reads text: whitespace (Intl's no-break space) collapsed to one space. */
const money = (n: number) => fmtMoney(n, 'NPR').replace(/\s+/g, ' ');

function ret(id: string, extra: Partial<ReturnItem> = {}): ReturnItem {
  return {
    id,
    orderId: `o-${id}`,
    orderNumber: `NK-${id}`,
    subOrderId: `so-${id}`,
    vendorAccountId: `v-${id}`,
    customerAccountId: `c-${id}`,
    productTitleSnapshot: 'Cotton kurta',
    variantLabelSnapshot: 'M / Blue',
    thumbnailUrlSnapshot: null,
    quantity: 2,
    reason: 'Stitching came apart at the seam',
    state: 1,
    resolution: 1,
    submittedUtc: '2026-10-26T08:00:00Z',
    resolvedUtc: null,
    rejectionNote: null,
    reasonCategory: 'Defective',
    reasonCategoryLabel: 'Defective',
    reasonCode: 'quality',
    buyerDisplayName: 'Sita Sharma',
    vendorDisplayName: 'Kathmandu Kurtas',
    unitPriceAmount: 1200,
    lineAmount: 2400,
    currency: 'NPR',
    refundAmount: null,
    refundStatus: null,
    refundCompletedUtc: null,
    refundBreakdown: null,
    pickupMode: null,
    pickupStage: null,
    pickupFarePayer: 'Seller',
    receivedUtc: null,
    completedUtc: null,
    restocked: null,
    cancelledUtc: null,
    cancelReason: null,
    cancelNote: null,
    photoUrls: [],
    ...extra,
  };
}

const RETURNED = ret('rr-4', {
  state: 4,
  pickupMode: 'Rider',
  pickupStage: 'ReceivedBySeller',
  receivedUtc: '2026-10-27T10:00:00Z',
  completedUtc: '2026-10-27T11:00:00Z',
  resolvedUtc: '2026-10-27T11:00:00Z',
  refundAmount: 2400,
  refundStatus: 'Completed',
  refundCompletedUtc: '2026-10-27T12:00:00Z',
  refundBreakdown: { lineAmount: 2400, pickupFareDeducted: 0, refundAmount: 2400, currency: 'NPR' },
  restocked: true,
  photoUrls: ['https://cdn.test/return-1.jpg'],
});

const SUMMARY: ReturnsSummary = {
  total: 17,
  refundTotal: 2400,
  refundedTotal: 2400,
  currency: 'NPR',
  states: [
    { state: 1, key: 'requested', label: 'Requested', count: 6, refundTotal: 0 },
    { state: 2, key: 'accepted', label: 'Accepted — waiting for the item', count: 4, refundTotal: 0 },
    { state: 4, key: 'returned', label: 'Returned', count: 3, refundTotal: 2400 },
    { state: 3, key: 'rejected', label: 'Rejected', count: 2, refundTotal: 0 },
    { state: 5, key: 'cancelled', label: 'Cancelled', count: 2, refundTotal: 0 },
  ],
};

const LIST = '/v1/admin/support/returns';
const SUM = '/v1/admin/support/returns/summary';

function serve(items: ReturnItem[] = [ret('rr-1'), RETURNED]) {
  return mockFetch((req) => {
    if (req.path === LIST) return { body: { items, totalCount: items.length, skip: 0, take: 25 } };
    if (req.path === SUM) return { body: SUMMARY };
    if (req.path.endsWith('/evidence')) return { body: { collectedUtc: '', hasEvidence: false, hasDiscrepancy: false, sources: [], facts: [], findings: [] } };
    return undefined;
  });
}

const listCalls = (calls: Captured[]) => calls.filter((c) => c.path === LIST);
const lastList = (calls: Captured[]) => new URL(listCalls(calls).at(-1)!.url, 'http://x').searchParams;

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('returns overview', () => {
  it('opens on All: no state filter is sent and the All tab is selected', async () => {
    signInAs(['SupportAgent']);
    const { calls } = serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns' });

    await screen.findByRole('table', { name: 'Returns' });
    expect(lastList(calls).has('state')).toBe(false);
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows each tab with its count and filters by the chosen state', async () => {
    signInAs(['SupportAgent']);
    const { calls } = serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns' });

    const all = await screen.findByTestId('returns-tab-all');
    await waitFor(() => expect(within(all).getByTestId('tab-count')).toHaveTextContent('17'));
    expect(within(screen.getByTestId('returns-tab-requested')).getByTestId('tab-count')).toHaveTextContent('6');
    expect(within(screen.getByTestId('returns-tab-accepted')).getByTestId('tab-count')).toHaveTextContent('4');
    expect(within(screen.getByTestId('returns-tab-returned')).getByTestId('tab-count')).toHaveTextContent('3');
    expect(within(screen.getByTestId('returns-tab-rejected')).getByTestId('tab-count')).toHaveTextContent('2');
    expect(within(screen.getByTestId('returns-tab-cancelled')).getByTestId('tab-count')).toHaveTextContent('2');
    expect(screen.getByTestId('returns-tab-accepted')).toHaveTextContent('Accepted (waiting for item)');

    await userEvent.click(screen.getByTestId('returns-tab-returned'));
    await waitFor(() => expect(lastList(calls).get('state')).toBe('4'));
  });

  it('keeps an explicit state from the address bar', async () => {
    signInAs(['SupportAgent']);
    const { calls } = serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns?state=2' });

    await screen.findByRole('table', { name: 'Returns' });
    expect(lastList(calls).get('state')).toBe('2');
    expect(screen.getByRole('tab', { name: /^Accepted/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('sends the search to the list and the summary', async () => {
    signInAs(['SupportAgent']);
    const { calls } = serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns' });

    await screen.findByRole('table', { name: 'Returns' });
    await userEvent.type(screen.getByLabelText('Search'), 'NK-rr');
    await waitFor(() => expect(lastList(calls).get('search')).toBe('NK-rr'));
    const summaryCall = calls.filter((c) => c.path === SUM).at(-1)!;
    expect(new URL(summaryCall.url, 'http://x').searchParams.get('search')).toBe('NK-rr');
  });

  it('sends a date range as a half-open submitted range', async () => {
    signInAs(['SupportAgent']);
    const { calls } = serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns?from=2026-10-01&to=2026-10-27' });

    await screen.findByRole('table', { name: 'Returns' });
    const p = lastList(calls);
    expect(new Date(p.get('fromUtc')!).getTime()).toBe(new Date('2026-10-01T00:00:00').getTime());
    expect(new Date(p.get('toUtc')!).getTime()).toBe(new Date('2026-10-28T00:00:00').getTime());
  });

  it('renders the overview columns', async () => {
    signInAs(['SupportAgent']);
    serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns' });

    const table = await screen.findByRole('table', { name: 'Returns' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Item', 'Order', 'Buyer', 'Seller', 'Reason', 'Wants', 'State', 'Pickup', 'Refund', 'Submitted / returned']);

    const [requested, returned] = within(table).getAllByTestId('table-row');
    expect(requested).toHaveTextContent('Cotton kurta');
    expect(requested).toHaveTextContent('M / Blue · × 2');
    expect(requested).toHaveTextContent('NK-rr-1');
    expect(requested).toHaveTextContent('Sita Sharma');
    expect(requested).toHaveTextContent('Kathmandu Kurtas');
    expect(requested).toHaveTextContent('Defective');
    expect(requested).toHaveTextContent('Stitching came apart at the seam');
    expect(requested).toHaveTextContent('Refund');
    expect(requested).toHaveTextContent('Requested');
    expect(requested).toHaveTextContent(money(2400)); // value of the returned items, nothing refunded yet

    expect(returned).toHaveTextContent('Returned');
    expect(returned).toHaveTextContent('Received by seller');
    expect(returned).toHaveTextContent(money(2400));
    expect(returned).toHaveTextContent('Completed');
  });

  it('opens a drawer with the timeline, photos and a link to the rider pickup', async () => {
    signInAs(['SupportAgent']);
    serve();
    renderWithProviders(<ReturnsPage />, { route: '/returns?open=rr-4' });

    const timeline = await screen.findByTestId('return-timeline');
    expect(timeline).toHaveTextContent('Requested');
    expect(timeline).toHaveTextContent('Accepted — waiting for the item');
    expect(timeline).toHaveTextContent('Picked up by rider');
    expect(timeline).toHaveTextContent('Received by seller');
    expect(timeline).toHaveTextContent('Put back in stock');
    expect(timeline).toHaveTextContent('Refunded');
    expect(within(screen.getByTestId('return-photos')).getByRole('img', { name: 'Return photo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in rider pickups/i })).toHaveAttribute('href', '/returns?view=pickups&open=rr-4');
  });

  it('ends a cancelled return on its reason', async () => {
    signInAs(['SupportAgent']);
    serve([ret('rr-5', { state: 5, cancelledUtc: '2026-10-27T09:00:00Z', cancelReason: 'buyer_cancelled', cancelNote: 'Kept it' })]);
    renderWithProviders(<ReturnsPage />, { route: '/returns?open=rr-5' });

    const timeline = await screen.findByTestId('return-timeline');
    expect(timeline).toHaveTextContent('Cancelled');
    expect(timeline).toHaveTextContent('Buyer cancelled — Kept it');
    expect(timeline).not.toHaveTextContent('Refunded');
  });

  it('still lists returns when the summary is not deployed', async () => {
    signInAs(['SupportAgent']);
    mockFetch((req) => (req.path === LIST ? { body: [ret('rr-1')] } : undefined));
    renderWithProviders(<ReturnsPage />, { route: '/returns' });

    const table = await screen.findByRole('table', { name: 'Returns' });
    expect(within(table).getAllByTestId('table-row')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /^All/ })).toBeInTheDocument();
    expect(screen.queryByTestId('tab-count')).not.toBeInTheDocument();
  });
});
