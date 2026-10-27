import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { PAYMENT_CSV_COLUMNS, paymentsCsv, type AdminPaymentRow } from '@/api/payments';
import { fmtMoney } from '@/lib/format';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { ESEWA_TEST_MODE, PaymentsPage } from './PaymentsPage';

/** As Testing Library reads text: whitespace (Intl's no-break space) collapsed to one space. */
const money = (n: number) => fmtMoney(n, 'NPR').replace(/\s+/g, ' ');

const BUYER = '22222222-aaaa-bbbb-cccc-000000000001';

function payment(id: string, extra: Partial<AdminPaymentRow> = {}): AdminPaymentRow {
  return {
    id,
    createdUtc: '2026-10-20T06:00:00Z',
    capturedUtc: '2026-10-20T06:01:00Z',
    method: 1,
    methodName: 'CardVisaMastercard',
    state: 3,
    stateName: 'Captured',
    amount: 2450,
    currency: 'NPR',
    purpose: 'Order',
    orderId: `order-${id}`,
    orderNumber: `SM-${id}`,
    agreementId: null,
    buyerAccountId: BUYER,
    buyerName: 'Asha',
    providerReference: `pi_${id}`,
    failureMessage: null,
    ...extra,
  };
}

const page = (items: unknown[]) => ({ items, page: 1, pageSize: 25, totalCount: items.length });

const SUMMARY = {
  fromUtc: '2026-09-28T00:00:00Z',
  toUtc: '2026-10-27T23:59:59Z',
  currency: 'NPR',
  received: { amount: 15400, count: 4 },
  pending: { amount: 1200, count: 1 },
  failed: { count: 2 },
  refunded: null,
  byMethod: [{ method: 1, methodName: 'CardVisaMastercard', amount: 15400, count: 4 }],
};

function api(items: unknown[], summary: unknown = SUMMARY) {
  return mockFetch((req) => {
    if (req.method === 'GET' && req.path === '/v1/admin/payments') return { body: page(items) };
    if (req.method === 'GET' && req.path === '/v1/admin/payments/summary') return { body: summary };
    return undefined;
  });
}

const listCalls = (calls: Captured[]) => calls.filter((c) => c.path === '/v1/admin/payments');
const paramsOf = (c: Captured) => new URL(c.url, 'http://x').searchParams;

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payments list', () => {
  it('renders rows from the API and asks for the last 30 days, page 1', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([payment('1001'), payment('1002', { method: 4, methodName: 'CashOnDelivery', state: 1, stateName: 'Initiated', amount: 999 })]);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });

    const table = await screen.findByRole('table', { name: 'Payments' });
    const rows = within(table).getAllByTestId('table-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('SM-1001');
    expect(rows[0]).toHaveTextContent('Card (Visa/Mastercard)');
    expect(rows[0]).toHaveTextContent('Captured');
    expect(rows[0]).toHaveTextContent(money(2450));
    expect(rows[1]).toHaveTextContent('Cash on delivery');
    expect(rows[1]).toHaveTextContent('Initiated');

    const q = paramsOf(listCalls(calls)[0]!);
    expect(q.get('page')).toBe('1');
    expect(q.get('pageSize')).toBe('25');
    const from = new Date(q.get('fromUtc')!);
    const to = new Date(q.get('toUtc')!);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(30);
    expect(q.get('state')).toBeNull();
    expect(q.get('q')).toBeNull();
  });

  it('sends the filters from the address bar and the search box', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([payment('1001')]);
    renderWithProviders(<PaymentsPage />, { route: '/payments?state=4&method=3&purpose=EmiInstalment&from=2026-10-01&to=2026-10-10' });

    await screen.findByRole('table', { name: 'Payments' });
    const first = paramsOf(listCalls(calls)[0]!);
    expect(first.get('state')).toBe('4');
    expect(first.get('method')).toBe('3');
    expect(first.get('purpose')).toBe('EmiInstalment');
    expect(new Date(first.get('fromUtc')!).getTime()).toBe(new Date('2026-10-01T00:00:00').getTime());
    expect(new Date(first.get('toUtc')!).getTime()).toBe(new Date('2026-10-10T23:59:59.999').getTime());

    const summary = calls.find((c) => c.path === '/v1/admin/payments/summary')!;
    expect(paramsOf(summary).get('fromUtc')).toBe(first.get('fromUtc'));
    expect(paramsOf(summary).get('toUtc')).toBe(first.get('toUtc'));

    await userEvent.type(screen.getByLabelText('Search'), 'SM-1001');
    await waitFor(() => expect(listCalls(calls).some((c) => paramsOf(c).get('q') === 'SM-1001')).toBe(true));
    const searched = listCalls(calls).find((c) => paramsOf(c).get('q') === 'SM-1001')!;
    expect(paramsOf(searched).get('state')).toBe('4');
  });

  it('shows the summary amounts as tiles and by-method chips', async () => {
    signInAs(['PayoutsOps']);
    api([payment('1001')]);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });

    const tiles = await screen.findByTestId('payments-summary');
    await waitFor(() => expect(within(tiles).getAllByText(money(15400)).length).toBeGreaterThan(0));
    expect(within(tiles).getByText(money(1200))).toBeInTheDocument();
    expect(within(tiles).getByText('4 payments')).toBeInTheDocument();
    expect(within(tiles).getByText('1 payment')).toBeInTheDocument();
    expect(within(tiles).getByText('2')).toBeInTheDocument();
    expect(within(tiles).getByTestId('method-chip')).toHaveTextContent('Card (Visa/Mastercard)');
    expect(screen.queryByTestId('esewa-test-mode')).not.toBeInTheDocument();
  });

  it('says eSewa is in test mode when an eSewa payment is listed', async () => {
    signInAs(['PayoutsOps']);
    api([payment('1001', { method: 3, methodName: 'Esewa', providerReference: 'esewa-uuid-1' })]);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });
    expect(await screen.findByTestId('esewa-test-mode')).toHaveTextContent(ESEWA_TEST_MODE);
  });

  it('says the backend is not deployed on a bare 404 instead of "no payments"', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });
    const block = await screen.findByTestId('state-unavailable');
    expect(block).toHaveTextContent('feat/admin-payments');
    expect(screen.queryByText('No payments in this range')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Payments' })).not.toBeInTheDocument();
  });

  it('opens a row in the detail drawer with every field', async () => {
    signInAs(['PayoutsOps']);
    api([payment('1001', { agreementId: '33333333-aaaa-bbbb-cccc-000000000009', purpose: 'EmiDownPayment' })]);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });

    const table = await screen.findByRole('table', { name: 'Payments' });
    await userEvent.click(within(table).getAllByTestId('table-row')[0]!);
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Payment id')).toBeInTheDocument();
    expect(within(drawer).getByText('1001')).toBeInTheDocument();
    expect(within(drawer).getByText('33333333-aaaa-bbbb-cccc-000000000009')).toBeInTheDocument();
    expect(within(drawer).getByText(BUYER)).toBeInTheDocument();
    expect(within(drawer).getAllByText('EMI down payment').length).toBeGreaterThan(0);
  });

  it('opens the existing order drawer from the order number', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([payment('1001')]);
    renderWithProviders(<PaymentsPage />, { route: '/payments' });

    await userEvent.click(await screen.findByRole('button', { name: 'Open order SM-1001' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/admin/orders/by-number/SM-1001')).toBe(true));
  });

  it('exports the current rows as CSV', async () => {
    signInAs(['PayoutsOps']);
    api([payment('1001')]);
    const createObjectURL = vi.fn(() => 'blob:payments');
    const revokeObjectURL = vi.fn();
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      renderWithProviders(<PaymentsPage />, { route: '/payments' });
      await screen.findByRole('table', { name: 'Payments' });
      await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect((createObjectURL.mock.calls[0] as unknown[])[0]).toBeInstanceOf(Blob);
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});

describe('paymentsCsv', () => {
  it('writes the header and one line per payment with labels, ids and safe quoting', () => {
    const csv = paymentsCsv([
      payment('1001'),
      payment('1002', { method: 3, methodName: 'Esewa', state: 4, stateName: 'Failed', orderNumber: null, orderId: null, buyerName: 'Rai, "Bikash"', failureMessage: '=HYPERLINK("x")' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(PAYMENT_CSV_COLUMNS.join(','));
    expect(PAYMENT_CSV_COLUMNS).toEqual([
      'Created (UTC)',
      'Captured (UTC)',
      'Amount',
      'Currency',
      'Method',
      'Status',
      'Purpose',
      'Order number',
      'Order id',
      'EMI plan id',
      'Provider reference',
      'Buyer account id',
      'Buyer name',
      'Payment id',
      'Failure message',
    ]);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(`2026-10-20T06:00:00Z,2026-10-20T06:01:00Z,2450,NPR,Card (Visa/Mastercard),Captured,Order,SM-1001,order-1001,,pi_1001,${BUYER},Asha,1001,`);
    expect(lines[2]).toContain(',eSewa,Failed,Order,,,,pi_1002,');
    expect(lines[2]).toContain('"Rai, ""Bikash"""');
    expect(lines[2]!.endsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
