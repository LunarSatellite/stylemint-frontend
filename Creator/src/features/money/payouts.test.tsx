import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import EarningsPage from './EarningsPage';
import PayoutsPage from './PayoutsPage';

const balance = { availableValue: 25_000, pendingValue: 3_000, lifetimeValue: 80_000, currency: 'NPR' };
const destination = {
  id: 'd1',
  kind: 4,
  label: 'My eSewa',
  accountIdentifierMasked: '********78',
  branchOrIfsc: null,
  isDefault: true,
  verified: false,
  createdUtc: '2026-10-01T00:00:00Z',
};
const page = <T,>(items: T[]) => ({ items, totalCount: items.length, nextCursor: null, previousCursor: null, pageSize: 25, hasMore: false });

describe('payouts', () => {
  beforeEach(() => __resetSessionForTests());

  it('requests a payout to the default account with the creator role and shows the fee', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      'GET /v1/earnings/balance': { body: balance },
      'GET /v1/payout-destinations': { body: [destination] },
      'GET /v1/payouts': { body: page([]) },
      'POST /v1/payouts/on-demand': { body: { id: 'p1' } },
    });
    renderWithProviders(<PayoutsPage />);
    expect(await screen.findByText('Rs 25,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /request payout/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Rs 500.00')).toBeInTheDocument(); // 2% of 25,000
    await user.click(within(dialog).getByRole('button', { name: /request payout/i }));
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/payouts/on-demand')).toBe(true));
    expect(calls.find((c) => c.path === '/v1/payouts/on-demand')!.body).toEqual({ role: 1, destinationId: 'd1', requestedAmount: 25_000 });
    expect(calls.find((c) => c.path === '/v1/earnings/balance')!.search).toBe('?role=1');
  });

  it('explains a payout already on its way', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /v1/earnings/balance': { body: balance },
      'GET /v1/payout-destinations': { body: [destination] },
      'GET /v1/payouts': { body: page([]) },
      'POST /v1/payouts/on-demand': { status: 400, body: { title: 'Rule', status: 400, errorCode: 'rule.violation', field: 'PAYOUT_IN_FLIGHT' } },
    });
    renderWithProviders(<PayoutsPage />);
    await user.click(await screen.findByRole('button', { name: /request payout/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /request payout/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already have a payout on its way/i);
  });

  it('blocks a payout below the minimum, shows only creator payouts and masks the account number', async () => {
    mockApi({
      'GET /v1/earnings/balance': { body: { ...balance, availableValue: 4_000 } },
      'GET /v1/payout-destinations': { body: [destination] },
      'GET /v1/payouts': {
        body: page([
          { id: 'p1', payeeKind: 1, mode: 2, destination: 4, destinationRef: '9812345678', requestedAmountValue: 10000, requestedAmountCurrency: 'NPR', feeAmountValue: 200, netAmountValue: 9800, netAmountCurrency: 'NPR', requestedUtc: '2026-10-01T00:00:00Z', pendingUntilUtc: '2026-10-04T00:00:00Z', state: 3, failureMessage: null, paidUtc: '2026-10-04T00:00:00Z' },
          { id: 'p2', payeeKind: 2, mode: 2, destination: 1, destinationRef: '111', requestedAmountValue: 50000, requestedAmountCurrency: 'NPR', feeAmountValue: 0, netAmountValue: 50000, netAmountCurrency: 'NPR', requestedUtc: '2026-10-01T00:00:00Z', pendingUntilUtc: '2026-10-04T00:00:00Z', state: 3, failureMessage: null, paidUtc: null },
        ]),
      },
    });
    renderWithProviders(<PayoutsPage />);
    expect(await screen.findByText(/once you have Rs 10,000 available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request payout/i })).toBeDisabled();
    expect(await screen.findByText(/\*\*\*\*5678/)).toBeInTheDocument();
    expect(screen.queryByText(/9812345678/)).toBeNull();
    expect(screen.queryByText('Rs 50,000.00')).toBeNull(); // the vendor payout is not a creator payout
  });

  it('shows an error, never "no payouts", when the list cannot load', async () => {
    mockApi({
      'GET /v1/earnings/balance': { body: balance },
      'GET /v1/payout-destinations': { body: [destination] },
      'GET /v1/payouts': { status: 503, body: { title: 'Unavailable', status: 503, errorCode: 'system.service_unavailable' } },
    });
    renderWithProviders(<PayoutsPage />);
    expect(await screen.findByText(/could not load payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/no payouts yet/i)).toBeNull();
  });
});

describe('earnings', () => {
  beforeEach(() => __resetSessionForTests());

  it('shows the empty state when there are no entries, and drops buyer contact details from tips', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /v1/earnings/balance': { body: balance },
      'GET /v1/earnings/summary': { body: { thisMonthSalesCount: 0, thisMonthEarningsAmount: 0, avgEarningsPerSaleAmount: 0, thisMonthReelCount: 0, highestReelEarningsAmount: 0, currency: 'NPR' } },
      'GET /v1/earnings/entries': { body: page([]) },
      'GET /v1/tips/balance': { body: { availableBalance: { amount: 97, currency: 'NPR' }, totalReceived: { amount: 97, currency: 'NPR' }, totalSent: { amount: 0, currency: 'NPR' }, pendingBalance: { amount: 0, currency: 'NPR' } } },
      'GET /v1/tips/history': {
        body: page([{ id: 't1', senderId: 's', senderName: 'Sita call 9812345678', senderEmail: 'sita@gmail.com', senderAvatarUrl: null, receiverId: 'r', receiverName: 'Me', receiverAvatarUrl: null, amount: { amount: 100, currency: 'NPR' }, reelId: null, createdAt: '2026-10-10T00:00:00Z' }]),
      },
    });
    renderWithProviders(<EarningsPage />, { route: '/earnings' });
    expect(await screen.findByText(/no earnings yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /tips/i }));
    const tips = await screen.findByTestId('tips-list');
    expect(tips).toHaveTextContent('Sita call [phone hidden]');
    expect(tips).not.toHaveTextContent('sita@gmail.com');
  });
});
