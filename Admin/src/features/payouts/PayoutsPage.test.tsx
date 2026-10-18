import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt } from '@/auth/stepUp';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { PayoutsPage } from './PayoutsPage';
import { CourierBalanceSection } from './RiderLedger';

function payout(id: string, payeeKind: number, state = 6, extra: Record<string, unknown> = {}) {
  return {
    id,
    payeeProfileId: `profile-${id}`,
    payeeKind,
    mode: 2,
    destination: 4,
    destinationRef: '******7890',
    requestedAmountValue: 12000,
    requestedAmountCurrency: 'NPR',
    feeAmountValue: 240,
    feeAmountCurrency: 'NPR',
    netAmountValue: 11760,
    netAmountCurrency: 'NPR',
    requestedUtc: '2026-10-15T06:00:00Z',
    pendingUntilUtc: '2026-10-18T06:00:00Z',
    state,
    providerPayoutId: null,
    failureCode: null,
    failureMessage: null,
    paidUtc: null,
    ...extra,
  };
}

const page = (items: unknown[]) => ({ items, totalCount: items.length, nextCursor: null, pageSize: 25, hasMore: false });

const BALANCE = {
  pendingEarnings: 420,
  onHoldEarnings: 180,
  availableEarnings: 3150,
  cashToRemit: 2500,
  netPayable: 650,
  lifetimeEarnings: 18200,
  currency: 'NPR',
  settleAfterHours: 24,
  onDemandMinAmount: 10000,
  onDemandMaxAmount: 70000,
  onDemandFeePercent: 2,
  hasDefaultDestination: true,
  inFlightPayout: null,
};

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  registerStepUpPrompt(null);
  vi.unstubAllGlobals();
});

describe('awaiting transfer', () => {
  it('filters by the Courier role and marks a payout paid with the reference and a note', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/payouts/awaiting-transfer') return { body: page([payout('p1', 3)]) };
      if (req.method === 'POST' && req.path === '/v1/admin/payouts/p1/mark-paid') return { status: 204 };
      return undefined;
    });
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=transfer&role=3' });

    const table = await screen.findByRole('table', { name: 'Payouts awaiting transfer' });
    expect(calls.find((c) => c.path === '/v1/admin/payouts/awaiting-transfer')!.url).toContain('role=3');
    const [row] = within(table).getAllByTestId('table-row');
    expect(row).toHaveTextContent('Courier');
    expect(row).toHaveTextContent('Awaiting transfer');

    await userEvent.click(row!);
    await userEvent.click(await screen.findByRole('button', { name: /Mark paid/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as paid' });
    await userEvent.type(within(dialog).getByLabelText(/transfer reference/), 'NIMB-778812');
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Sent from the ops account');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));

    await waitFor(() => expect(calls.some((c) => c.path === '/v1/admin/payouts/p1/mark-paid')).toBe(true));
    const sent = calls.find((c) => c.path === '/v1/admin/payouts/p1/mark-paid')!;
    expect(sent.body).toEqual({ transferReference: 'NIMB-778812', note: 'Sent from the ops account' });
    expect(sent.headers['idempotency-key']).toBeTruthy();
  });

  it('marks a payout failed with a reason', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/payouts/awaiting-transfer') return { body: page([payout('p2', 3)]) };
      if (req.method === 'POST' && req.path === '/v1/admin/payouts/p2/mark-failed') return { status: 204 };
      return undefined;
    });
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=transfer&open=p2' });

    await userEvent.click(await screen.findByRole('button', { name: /Mark failed/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as failed' });
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Account closed at the bank');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark failed' }));

    await waitFor(() => expect(calls.find((c) => c.path === '/v1/admin/payouts/p2/mark-failed')?.body).toEqual({ reason: 'Account closed at the bank' }));
  });

  it('a read-only admin sees the list but no transfer actions', async () => {
    signInAs(['Readonly']);
    mockFetch((req) => (req.path === '/v1/admin/payouts/awaiting-transfer' ? { body: page([payout('p3', 3)]) } : undefined));
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=transfer&open=p3' });
    expect(await screen.findByText('Payee profile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark paid/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show account details/ })).not.toBeInTheDocument();
  });

  it('drops other payees when the server ignores role= and says so', async () => {
    signInAs(['PayoutsOps']);
    mockFetch((req) => (req.path === '/v1/admin/payouts/awaiting-transfer' ? { body: page([payout('c1', 1), payout('r1', 3)]) } : undefined));
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=transfer&role=3' });
    const table = await screen.findByRole('table', { name: 'Payouts awaiting transfer' });
    expect(within(table).getAllByTestId('table-row')).toHaveLength(1);
    expect(screen.getByTestId('role-filter-ignored')).toBeInTheDocument();
  });
});

describe('payout queue', () => {
  it('passes the role and shows the new state', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = mockFetch((req) => (req.path === '/v1/admin/payouts' ? { body: page([payout('q1', 3, 3, { providerPayoutId: 'REF-1', paidUtc: '2026-10-17T06:00:00Z' })]) } : undefined));
    renderWithProviders(<PayoutsPage />, { route: '/payouts?role=3' });
    const table = await screen.findByRole('table', { name: 'Payouts' });
    expect(within(table).getByText('Paid')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/admin/payouts')!.url).toContain('role=3');
  });
});

describe('rider balances', () => {
  it('says the ledger is not deployed instead of "no riders"', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=riders' });
    expect(await screen.findByTestId('state-unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No rider balances')).not.toBeInTheDocument();
  });

  it('lists riders holding cash and records cash handed in', async () => {
    signInAs(['PayoutsOps']);
    const acc = '11111111-aaaa-bbbb-cccc-000000000001';
    const { calls } = mockFetch((req) => {
      if (req.path === '/v1/admin/payouts/couriers') return { body: page([{ accountId: acc, availableEarnings: 3150, pendingEarnings: 420, cashToRemit: 2500, netPayable: 650, currency: 'NPR' }]) };
      if (req.path === `/v1/admin/payouts/couriers/${acc}/balance`) return { body: BALANCE };
      if (req.path === `/v1/admin/payouts/couriers/${acc}/earnings`)
        return {
          body: page([
            {
              entryId: 'e1',
              hopId: 'h1',
              packageId: 'pk',
              subOrderId: null,
              trackingNumber: 'SMD-8F2K1Q',
              amount: 375,
              currency: 'NPR',
              status: 2,
              holdReason: 'Buyer reported an issue',
              completedUtc: '2026-10-18T09:12:00Z',
              settleAfterUtc: '2026-10-19T09:12:00Z',
              settledUtc: null,
              reversedUtc: null,
              cashCollected: 2500,
              fareBreakdown: { ref: null, lines: [{ code: 'fare', label: 'Delivery fare', amount: 375 }] },
            },
          ]),
        };
      if (req.path.endsWith('/ledger') || req.path.endsWith('/payouts')) return { body: page([]) };
      if (req.method === 'POST' && req.path === `/v1/admin/payouts/couriers/${acc}/cash-remittances`) return { body: { ...BALANCE, cashToRemit: 0, netPayable: 3150 } };
      return undefined;
    });
    renderWithProviders(<PayoutsPage />, { route: '/payouts?tab=riders&owes=1' });

    const table = await screen.findByRole('table', { name: 'Rider balances' });
    expect(calls.find((c) => c.path === '/v1/admin/payouts/couriers')!.url).toContain('owesCash=true');
    await userEvent.click(within(table).getAllByTestId('table-row')[0]!);

    expect(await screen.findByText('SMD-8F2K1Q')).toBeInTheDocument();
    expect(screen.getByText('Buyer reported an issue')).toBeInTheDocument();
    expect(screen.getAllByText('Cash to hand in').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Record cash handed in/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Record cash handed in' });
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'Deposit slip 4411');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record cash' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/cash-remittances'))?.body).toEqual({ amount: 2500, reference: 'Deposit slip 4411', note: null }),
    );
  });

  it('the rider drawer section says when the ledger is missing, and shows the balance when present', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    const { unmount } = renderWithProviders(<CourierBalanceSection accountId="acc" />);
    expect(await screen.findByTestId('state-unavailable')).toBeInTheDocument();
    unmount();

    vi.unstubAllGlobals();
    mockFetch((req) => (req.path === '/v1/admin/payouts/couriers/acc/balance' ? { body: BALANCE } : undefined));
    renderWithProviders(<CourierBalanceSection accountId="acc" />);
    expect(await screen.findByText('Net payable')).toBeInTheDocument();
    expect(screen.getByText(/on hold/)).toBeInTheDocument();
  });
});
