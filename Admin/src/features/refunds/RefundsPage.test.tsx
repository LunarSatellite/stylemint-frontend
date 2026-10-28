import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { installSession, resetSessionForTests } from '@/auth/session';
import type { AdminRefund } from '@/api/refunds';
import { fmtMoney } from '@/lib/format';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { RefundsPage } from './RefundsPage';

/** As Testing Library reads text: whitespace (Intl's no-break space) collapsed to one space. */
const money = (n: number) => fmtMoney(n, 'NPR').replace(/\s+/g, ' ');

function refund(id: string, extra: Partial<AdminRefund> = {}): AdminRefund {
  return {
    refundId: id,
    paymentIntentId: `pi-${id}`,
    orderNumber: `NK2026-${id}`,
    subOrderNumber: null,
    reason: 'ReturnCompleted',
    reasonCode: 'RETURN_COMPLETED',
    method: 3,
    methodName: 'Esewa',
    amount: { amount: 1250, currency: 'NPR' },
    state: 'Pending',
    needsAction: true,
    failureMessage: null,
    requestedUtc: '2026-10-27T06:00:00Z',
    completedUtc: null,
    providerReference: `esewa-txn-${id}`,
    providerRefundId: null,
    settledBy: null,
    settledNote: null,
    buyer: { accountId: `buyer-${id}`, displayName: 'Asha Gurung', phone: '+9779841000001' },
    ...extra,
  };
}

const paged = (items: unknown[]) => ({ items, totalCount: items.length, nextCursor: null, hasMore: false });

const SUMMARY = {
  toSettle: { count: 3, amount: { amount: 4200, currency: 'NPR' } },
  settledThisMonth: { count: 7, amount: { amount: 9800, currency: 'NPR' } },
  byMethod: [
    { method: 3, methodName: 'Esewa', count: 2, amount: { amount: 3000, currency: 'NPR' } },
    { method: 4, methodName: 'CashOnDelivery', count: 1, amount: { amount: 1200, currency: 'NPR' } },
  ],
};

type Answer = { status?: number; body?: unknown } | undefined;

function api(items: AdminRefund[], markRefunded: (req: Captured) => Answer = (req) => ({ body: { ...items[0], state: 'Completed', needsAction: false, providerRefundId: `manual:${(req.body as { reference: string }).reference}` } })) {
  return mockFetch((req) => {
    if (req.method === 'GET' && req.path === '/v1/admin/refunds') return { body: paged(items) };
    if (req.method === 'GET' && req.path === '/v1/admin/refunds/summary') return { body: SUMMARY };
    const detail = /^\/v1\/admin\/refunds\/([^/]+)$/.exec(req.path);
    if (req.method === 'GET' && detail) {
      const r = items.find((i) => i.refundId === detail[1]);
      return r ? { body: { ...r, history: [r, refund('old', { state: 'Failed', needsAction: false, failureMessage: 'eSewa has no refund API', requestedUtc: '2026-10-20T06:00:00Z' })] } } : undefined;
    }
    if (req.method === 'POST' && /\/mark-refunded$/.test(req.path)) return markRefunded(req);
    return undefined;
  });
}

const listCalls = (calls: Captured[]) => calls.filter((c) => c.method === 'GET' && c.path === '/v1/admin/refunds');
const summaryCalls = (calls: Captured[]) => calls.filter((c) => c.path === '/v1/admin/refunds/summary');
const posts = (calls: Captured[]) => calls.filter((c) => c.method === 'POST');
const paramsOf = (c: Captured) => new URL(c.url, 'http://x').searchParams;

async function openMarkRefunded(orderNumber: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Mark refunded ${orderNumber}` }));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('refunds desk list', () => {
  it('opens on "To settle" and renders the rows', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([refund('00041'), refund('00042', { method: 4, methodName: 'CashOnDelivery', reason: 'OrderCancelled', state: 'Failed', amount: { amount: 999, currency: 'NPR' } })]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });

    const table = await screen.findByRole('table', { name: 'Refunds' });
    const rows = within(table).getAllByTestId('table-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('NK2026-00041');
    expect(rows[0]).toHaveTextContent('Return');
    expect(rows[0]).toHaveTextContent('eSewa');
    expect(rows[0]).toHaveTextContent(money(1250));
    expect(rows[0]).toHaveTextContent('Asha Gurung');
    expect(rows[0]).toHaveTextContent('Pending');
    expect(rows[1]).toHaveTextContent('Cash on delivery');
    expect(rows[1]).toHaveTextContent('Order cancelled');
    expect(rows[1]).toHaveTextContent('Failed');

    expect(screen.getByRole('tab', { name: 'To settle' })).toHaveAttribute('aria-selected', 'true');
    const q = paramsOf(listCalls(calls)[0]!);
    expect(q.get('view')).toBe('ToSettle');
    expect(q.get('pageSize')).toBe('25');
    expect(q.get('cursor')).toBeNull();
    expect(q.get('method')).toBeNull();
  });

  it('shows the summary cards', async () => {
    signInAs(['PayoutsOps']);
    api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });

    const cards = await screen.findByTestId('refunds-summary');
    await waitFor(() => expect(within(cards).getByText(money(4200))).toBeInTheDocument());
    expect(within(cards).getByText('3 refunds')).toBeInTheDocument();
    expect(within(cards).getByText(money(9800))).toBeInTheDocument();
    const byMethod = within(cards).getAllByTestId('method-card');
    expect(byMethod).toHaveLength(2);
    expect(byMethod[0]).toHaveTextContent('eSewa');
    expect(byMethod[1]).toHaveTextContent('Cash on delivery');
    expect(byMethod[1]).toHaveTextContent('1 refund');
  });

  it('asks for the tab and the filters', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds?method=3&from=2026-10-01&to=2026-10-10' });

    await screen.findByRole('table', { name: 'Refunds' });
    const first = paramsOf(listCalls(calls)[0]!);
    expect(first.get('method')).toBe('3');
    expect(new Date(first.get('fromUtc')!).getTime()).toBe(new Date('2026-10-01T00:00:00').getTime());
    expect(new Date(first.get('toUtc')!).getTime()).toBe(new Date('2026-10-10T23:59:59.999').getTime());

    await userEvent.click(screen.getByRole('tab', { name: 'Completed' }));
    await waitFor(() => expect(listCalls(calls).some((c) => paramsOf(c).get('view') === 'Completed')).toBe(true));

    await userEvent.type(screen.getByLabelText('Search'), 'esewa-txn-9');
    await waitFor(() => expect(listCalls(calls).some((c) => paramsOf(c).get('search') === 'esewa-txn-9')).toBe(true));
    const searched = listCalls(calls).find((c) => paramsOf(c).get('search') === 'esewa-txn-9')!;
    expect(paramsOf(searched).get('view')).toBe('Completed');
  });

  it('says the backend is not deployed on a bare 404', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    expect(await screen.findByTestId('state-unavailable')).toHaveTextContent('feat/refunds-desk');
    expect(screen.queryByRole('table', { name: 'Refunds' })).not.toBeInTheDocument();
  });

  it('shows the history in the detail drawer', async () => {
    signInAs(['PayoutsOps']);
    api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds?open=00041' });
    const history = await screen.findByTestId('refund-history');
    expect(within(history).getAllByRole('row')).toHaveLength(3); // header + 2 attempts
    expect(history).toHaveTextContent('eSewa has no refund API');
    expect(screen.getByTestId('drawer-instruction')).toHaveTextContent('eSewa merchant portal for transaction esewa-txn-00041');
  });
});

describe('mark refunded', () => {
  it('tells the desk what to do for eSewa, sends the body with an Idempotency-Key and refreshes', async () => {
    signInAs(['PayoutsOps']);
    const show = vi.spyOn(notifications, 'show');
    const { calls } = api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    await screen.findByTestId('refunds-summary');
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(1));

    const dialog = await openMarkRefunded('NK2026-00041');
    expect(within(dialog).getByTestId('refund-instruction')).toHaveTextContent(`Refund ${money(1250)} in the eSewa merchant portal for transaction esewa-txn-00041`);

    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'ESW-REF-9');
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'paid from the portal');
    const listsBefore = listCalls(calls).length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));

    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const post = posts(calls)[0]!;
    expect(post.path).toBe('/v1/admin/refunds/00041/mark-refunded');
    expect(post.body).toEqual({ reference: 'ESW-REF-9', note: 'paid from the portal' });
    expect(post.headers['idempotency-key']).toBeTruthy();

    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'forest', title: 'Refund recorded' })));
    await waitFor(() => expect(listCalls(calls).length).toBeGreaterThan(listsBefore));
    await waitFor(() => expect(summaryCalls(calls).length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.queryByTestId('refund-instruction')).not.toBeInTheDocument());
  });

  it('sends a null note when none is given', async () => {
    signInAs(['SuperAdmin']);
    const { calls } = api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00041');
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), '  ESW-1  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]!.body).toEqual({ reference: 'ESW-1', note: null });
  });

  it('tells the desk whom to pay for cash on delivery', async () => {
    signInAs(['PayoutsOps']);
    api([refund('00042', { method: 4, methodName: 'CashOnDelivery', providerReference: null, amount: { amount: 999, currency: 'NPR' } })]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00042');
    expect(within(dialog).getByTestId('refund-instruction')).toHaveTextContent(`Send ${money(999)} to the buyer (Asha Gurung, +9779841000001) by eSewa or bank.`);
  });

  it('needs a reference of at most 100 characters and a note of at most 500', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api([refund('00041')]);
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00041');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    expect(await within(dialog).findByText('Enter the reference')).toBeInTheDocument();

    const ref = within(dialog).getByLabelText(/^Reference/);
    await userEvent.click(ref);
    await userEvent.paste('x'.repeat(101));
    expect(await within(dialog).findByText('Keep it under 100 characters')).toBeInTheDocument();

    await userEvent.clear(ref);
    await userEvent.type(ref, 'ok');
    await userEvent.click(within(dialog).getByLabelText(/^Note/));
    await userEvent.paste('n'.repeat(501));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    expect(await within(dialog).findByText('Keep the note under 500 characters')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
  });

  it('keeps the Idempotency-Key when the same submission is retried', async () => {
    signInAs(['PayoutsOps']);
    let attempt = 0;
    const { calls } = api([refund('00041')], () => (++attempt === 1 ? { status: 503, body: { errorCode: 'system.service_unavailable' } } : { body: { ...refund('00041'), state: 'Completed' } }));
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00041');
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'ESW-REF-9');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    expect(await within(dialog).findByTestId('refund-error')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1]!.headers['idempotency-key']).toBe(posts(calls)[0]!.headers['idempotency-key']);
  });

  it('on 409 REFUND_ALREADY_SETTLED toasts, closes and refreshes', async () => {
    signInAs(['PayoutsOps']);
    const show = vi.spyOn(notifications, 'show');
    const { calls } = api([refund('00041')], () => ({ status: 409, body: { errorCode: 'REFUND_ALREADY_SETTLED', title: 'This refund was already settled.' } }));
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00041');
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'ESW-REF-9');
    const listsBefore = listCalls(calls).length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));

    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Already refunded' })));
    await waitFor(() => expect(listCalls(calls).length).toBeGreaterThan(listsBefore));
    await waitFor(() => expect(screen.queryByTestId('refund-instruction')).not.toBeInTheDocument());
  });

  it('on 422 REFUND_NOT_MANUAL says the provider still has it and stays open', async () => {
    signInAs(['PayoutsOps']);
    api([refund('00041', { method: 1, methodName: 'CardVisaMastercard' })], () => ({ status: 422, body: { errorCode: 'REFUND_NOT_MANUAL', title: 'Not manual.' } }));
    renderWithProviders(<RefundsPage />, { route: '/refunds' });
    const dialog = await openMarkRefunded('NK2026-00041');
    await userEvent.type(within(dialog).getByLabelText(/^Reference/), 'X-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark refunded' }));
    expect(await within(dialog).findByTestId('refund-error')).toHaveTextContent('still with the payment provider');
    expect(screen.getByTestId('refund-instruction')).toBeInTheDocument();
  });

  it('offers no action on completed rows', async () => {
    signInAs(['PayoutsOps']);
    api([refund('00041', { state: 'Completed', needsAction: false, providerRefundId: 'manual:ESW-1' })]);
    renderWithProviders(<RefundsPage />, { route: '/refunds?view=Completed' });
    const table = await screen.findByRole('table', { name: 'Refunds' });
    expect(within(table).getByText('Refunded')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /Mark refunded/ })).not.toBeInTheDocument();
  });
});
