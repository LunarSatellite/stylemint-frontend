import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { installSession, resetSessionForTests } from '@/auth/session';
import { parseRate, toTree, withInheritance, type CommissionCategoryRow } from '@/api/commission';
import { fmtMoney } from '@/lib/format';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { CommissionPage, EMI_NOTE, EXPLAINER } from './CommissionPage';

/** As Testing Library reads text: whitespace (Intl's no-break space) collapsed to one space. */
const money = (n: number) => fmtMoney(n, 'NPR').replace(/\s+/g, ' ');

const WOMEN = 'c0000000-0000-4000-8000-000000000001';
const DRESSES = 'c0000000-0000-4000-8000-000000000002';
const MEN = 'c0000000-0000-4000-8000-000000000003';
const ADMIN = 'a0000000-0000-4000-8000-0000000000aa';

function rows(): CommissionCategoryRow[] {
  return [
    { categoryId: MEN, name: 'Men', parentId: null, path: 'Men', ratePercent: null, effectiveRatePercent: 0, inheritedFrom: null, updatedUtc: null, updatedBy: null },
    { categoryId: DRESSES, name: 'Dresses', parentId: WOMEN, path: 'Women › Dresses', ratePercent: null, effectiveRatePercent: 10, inheritedFrom: 'Women', updatedUtc: null, updatedBy: null },
    { categoryId: WOMEN, name: 'Women', parentId: null, path: 'Women', ratePercent: 10, effectiveRatePercent: 10, inheritedFrom: null, updatedUtc: '2026-10-20T06:00:00Z', updatedBy: ADMIN, updatedByName: 'Asha Operator' },
  ];
}

const SUMMARY = {
  currency: 'NPR',
  earned: { amount: 4200, count: 7 },
  pending: { amount: 800 },
  reversed: { amount: 150 },
  byCategory: [
    { categoryId: MEN, name: 'Men', amount: 600 },
    { categoryId: WOMEN, name: 'Women', amount: 3600 },
  ],
};

const CATEGORIES = '/v1/admin/commission/categories';

/** A server that remembers a saved rate (so the refetch after a save agrees with the optimistic row). */
function api(opts: { putStatus?: number; summary?: unknown } = {}) {
  const state = rows();
  return mockFetch((req) => {
    if (req.method === 'GET' && req.path === CATEGORIES) return { body: withInheritance({ defaultRatePercent: 0, categories: state }) };
    if (req.method === 'GET' && req.path === '/v1/admin/commission/summary') return opts.summary === undefined ? { body: SUMMARY } : opts.summary === null ? undefined : { body: opts.summary };
    if (req.method === 'GET' && req.path === `${CATEGORIES}/${WOMEN}/history`)
      return { body: [{ ratePercent: 10, changedUtc: '2026-10-20T06:00:00Z', changedBy: ADMIN, changedByName: 'Asha Operator' }, { ratePercent: 8, changedUtc: '2026-10-01T06:00:00Z', changedBy: ADMIN, changedByName: 'Asha Operator' }] };
    if (req.method === 'PUT' && req.path.startsWith(`${CATEGORIES}/`)) {
      if (opts.putStatus) return { status: opts.putStatus, body: { title: 'Rate out of range', status: opts.putStatus, errorCode: 'commission.invalid' } };
      const id = req.path.slice(CATEGORIES.length + 1);
      const row = state.find((r) => r.categoryId === id);
      if (row) row.ratePercent = (req.body as { ratePercent: number | null }).ratePercent;
      return { body: {} };
    }
    return undefined;
  });
}

const puts = (calls: Captured[]) => calls.filter((c) => c.method === 'PUT');
const paramsOf = (c: Captured) => new URL(c.url, 'http://x').searchParams;
const row = (id: string) => screen.getByTestId(`commission-row-${id}`);

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('commission page', () => {
  it('explains the commission and the EMI rule at the top', async () => {
    signInAs(['PayoutsOps']);
    api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });
    await screen.findByRole('table', { name: 'Commission by category' });
    expect(screen.getByText(new RegExp(EXPLAINER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(EMI_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('renders the tree with rates, effective rates and inheritance', async () => {
    signInAs(['PayoutsOps']);
    api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    const table = await screen.findByRole('table', { name: 'Commission by category' });
    const trs = within(table).getAllByTestId(/^commission-row-/);
    // Tree order: Men, Women, then Women's child.
    expect(trs.map((tr) => tr.getAttribute('data-testid'))).toEqual([`commission-row-${MEN}`, `commission-row-${WOMEN}`, `commission-row-${DRESSES}`]);

    expect(within(row(WOMEN)).getByLabelText('Rate for Women (%)')).toHaveValue('10');
    expect(within(row(WOMEN)).getByTestId('effective-rate')).toHaveTextContent('10%');
    expect(within(row(WOMEN)).queryByTestId('inherited-from')).not.toBeInTheDocument();
    expect(within(row(WOMEN)).getByText('Asha Operator')).toBeInTheDocument();

    expect(within(row(DRESSES)).getByLabelText('Rate for Dresses (%)')).toHaveValue('');
    expect(within(row(DRESSES)).getByTestId('effective-rate')).toHaveTextContent('10%');
    expect(within(row(DRESSES)).getByTestId('inherited-from')).toHaveTextContent('inherited from Women');

    expect(within(row(MEN)).getByTestId('effective-rate')).toHaveTextContent('0%');
    expect(within(row(MEN)).getByTestId('inherited-from')).toHaveTextContent('default');
    expect(within(row(MEN)).getByText('Never')).toBeInTheDocument();
  });

  it('saves one row with a PUT of { ratePercent } and an Idempotency-Key, and shows it at once', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    const input = await screen.findByLabelText('Rate for Dresses (%)');
    await userEvent.type(input, '12.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save rate for Dresses' }));

    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const put = puts(calls)[0]!;
    expect(put.path).toBe(`${CATEGORIES}/${DRESSES}`);
    expect(put.body).toEqual({ ratePercent: 12.5 });
    expect(put.headers['idempotency-key']).toBeTruthy();

    await waitFor(() => expect(within(row(DRESSES)).getByTestId('effective-rate')).toHaveTextContent('12.5%'));
    expect(within(row(DRESSES)).queryByTestId('inherited-from')).not.toBeInTheDocument();
  });

  it('clears a rate with ratePercent null', async () => {
    signInAs(['SuperAdmin']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    await userEvent.click(await screen.findByRole('button', { name: 'Clear rate for Women' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]!.path).toBe(`${CATEGORIES}/${WOMEN}`);
    expect(puts(calls)[0]!.body).toEqual({ ratePercent: null });
  });

  it('blocks a rate outside 0–50', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    const input = await screen.findByLabelText('Rate for Dresses (%)');
    await userEvent.type(input, '60');
    expect(await within(row(DRESSES)).findByText('0–50, two decimals')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save rate for Dresses' });
    expect(save).toBeDisabled();
    await userEvent.type(input, '{Enter}');
    expect(puts(calls)).toHaveLength(0);
  });

  it('rolls the row back and says why when the server refuses', async () => {
    signInAs(['PayoutsOps']);
    const show = vi.spyOn(notifications, 'show');
    const { calls } = api({ putStatus: 400 });
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    const input = await screen.findByLabelText('Rate for Women (%)');
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Save rate for Women' }));

    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    // Toasts are not rendered in the test harness; check what the page asked the toast to say.
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'signal', title: 'Could not save Women' })));
    await waitFor(() => expect(within(row(WOMEN)).getByTestId('effective-rate')).toHaveTextContent('10%'));
    expect(within(row(WOMEN)).getByLabelText('Rate for Women (%)')).toHaveValue('10');
    expect(within(row(DRESSES)).getByTestId('effective-rate')).toHaveTextContent('10%');
  });

  it('shows a read-only admin the rates without inputs or save buttons', async () => {
    signInAs(['Readonly']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    await screen.findByRole('table', { name: 'Commission by category' });
    expect(screen.queryByLabelText('Rate for Women (%)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save rate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Clear rate/ })).not.toBeInTheDocument();
    expect(within(row(WOMEN)).getAllByText('10%').length).toBeGreaterThan(0);
    expect(within(row(DRESSES)).getByText('Not set')).toBeInTheDocument();
    expect(puts(calls)).toHaveLength(0);
  });

  it('filters the categories by name', async () => {
    signInAs(['PayoutsOps']);
    api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    await screen.findByRole('table', { name: 'Commission by category' });
    await userEvent.type(screen.getByLabelText('Search categories'), 'dress');
    await waitFor(() => expect(screen.queryByTestId(`commission-row-${MEN}`)).not.toBeInTheDocument());
    expect(screen.getByTestId(`commission-row-${DRESSES}`)).toHaveTextContent('Women › Dresses');
    expect(screen.queryByTestId(`commission-row-${WOMEN}`)).not.toBeInTheDocument();
  });

  it('shows the summary tiles for the last 30 days with the top categories', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    const tiles = await screen.findByTestId('commission-summary');
    await waitFor(() => expect(within(tiles).getByText(money(4200))).toBeInTheDocument());
    expect(within(tiles).getByText(money(800))).toBeInTheDocument();
    expect(within(tiles).getByText(money(150))).toBeInTheDocument();
    expect(within(tiles).getByText('7 entries settled')).toBeInTheDocument();
    const top = within(tiles).getAllByTestId('top-category');
    expect(top[0]).toHaveTextContent('Women');
    expect(top[1]).toHaveTextContent('Men');

    const summary = calls.find((c) => c.path === '/v1/admin/commission/summary')!;
    const from = new Date(paramsOf(summary).get('fromUtc')!);
    const to = new Date(paramsOf(summary).get('toUtc')!);
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(30);
  });

  it('asks the summary for the range in the address bar', async () => {
    signInAs(['PayoutsOps']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission?from=2026-10-01&to=2026-10-10' });
    await screen.findByTestId('commission-summary');
    const summary = calls.find((c) => c.path === '/v1/admin/commission/summary')!;
    expect(new Date(paramsOf(summary).get('fromUtc')!).getTime()).toBe(new Date('2026-10-01T00:00:00').getTime());
    expect(new Date(paramsOf(summary).get('toUtc')!).getTime()).toBe(new Date('2026-10-10T23:59:59.999').getTime());
  });

  it('opens the history of a category', async () => {
    signInAs(['Readonly']);
    const { calls } = api();
    renderWithProviders(<CommissionPage />, { route: '/commission' });

    await userEvent.click(await screen.findByRole('button', { name: 'History of Women' }));
    const drawer = await screen.findByRole('dialog');
    const table = await within(drawer).findByRole('table', { name: 'Rate history' });
    expect(within(table).getByText('8%')).toBeInTheDocument();
    expect(calls.some((c) => c.path === `${CATEGORIES}/${WOMEN}/history`)).toBe(true);
  });

  it('says the backend is not deployed on a bare 404 instead of "no categories"', async () => {
    signInAs(['PayoutsOps']);
    mockFetch(() => undefined);
    renderWithProviders(<CommissionPage />, { route: '/commission' });
    const block = await screen.findByTestId('state-unavailable');
    expect(block).toHaveTextContent('feat/platform-commission');
    expect(screen.queryByText('No categories')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Commission by category' })).not.toBeInTheDocument();
  });
});

describe('commission helpers', () => {
  it('accepts 0–50 with at most two decimals', () => {
    expect(parseRate('0')).toBe(0);
    expect(parseRate('12.5')).toBe(12.5);
    expect(parseRate('50')).toBe(50);
    expect(parseRate('12.25')).toBe(12.25);
    expect(parseRate('50.01')).toBeNull();
    expect(parseRate('-1')).toBeNull();
    expect(parseRate('12.345')).toBeNull();
    expect(parseRate('')).toBeNull();
    expect(parseRate('abc')).toBeNull();
  });

  it('orders the tree and recomputes inheritance from the rates', () => {
    const tree = toTree(rows());
    expect(tree.map((r) => [r.name, r.depth])).toEqual([
      ['Men', 0],
      ['Women', 0],
      ['Dresses', 1],
    ]);
    const cleared = withInheritance({ defaultRatePercent: 0, categories: rows().map((r) => (r.categoryId === WOMEN ? { ...r, ratePercent: null } : r)) });
    expect(cleared.categories.find((r) => r.categoryId === DRESSES)).toMatchObject({ effectiveRatePercent: 0, inheritedFrom: null });
    const raised = withInheritance({ defaultRatePercent: 0, categories: rows().map((r) => (r.categoryId === WOMEN ? { ...r, ratePercent: 15 } : r)) });
    expect(raised.categories.find((r) => r.categoryId === DRESSES)).toMatchObject({ effectiveRatePercent: 15, inheritedFrom: 'Women' });
  });
});
