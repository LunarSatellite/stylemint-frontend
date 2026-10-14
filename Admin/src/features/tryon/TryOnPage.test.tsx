import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt } from '@/auth/stepUp';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { TryOnPage } from './TryOnPage';

const SETTINGS = { enabled: true, freeForEveryone: false, freeTrialDays: 3, disclaimer: 'Colours may vary.', updatedUtc: '2026-10-01T08:00:00Z' };
const PLAN = { id: 'p1', name: 'Monthly', description: 'Thirty days', priceAmount: 299, currency: 'NPR', durationDays: 30, isActive: true, sortOrder: 0, isArchived: false, createdUtc: '2026-10-01T08:00:00Z' };
const SUB = {
  id: 's1',
  accountId: '3f2b1c4d-0000-4000-8000-000000000009',
  accountDisplayName: 'Mina Shopper',
  planId: 'p1',
  planName: 'Monthly',
  source: 3,
  state: 2,
  startsUtc: '2026-10-01T08:00:00Z',
  expiresUtc: '2026-10-31T08:00:00Z',
  priceAmount: 299,
  currency: 'NPR',
  paymentIntentId: null,
  note: null,
  createdUtc: '2026-10-01T08:00:00Z',
};

type Answer = ReturnType<Parameters<typeof mockFetch>[0]>;

function serve(extra: (req: Captured) => Answer = () => undefined) {
  return mockFetch((req) => {
    const own = extra(req);
    if (own) return own;
    if (req.method === 'GET' && req.path === '/v1/admin/try-on/settings') return { body: SETTINGS };
    if (req.method === 'GET' && req.path === '/v1/admin/try-on/plans') return { body: [PLAN] };
    if (req.method === 'GET' && req.path === '/v1/admin/try-on/subscriptions') return { body: { items: [SUB], totalCount: 1, nextCursor: null, previousCursor: null, pageSize: 25, hasMore: false } };
    return undefined;
  });
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
  signInAs(['SuperAdmin']);
});
afterEach(() => {
  registerStepUpPrompt(null);
  vi.unstubAllGlobals();
});

describe('try-on settings', () => {
  it('saves a changed trial length straight away', async () => {
    const { calls } = serve((req) => (req.method === 'PUT' ? { body: { ...SETTINGS, ...(req.body as object) } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on' });
    const days = await screen.findByLabelText(/Free trial/);
    await userEvent.clear(days);
    await userEvent.type(days, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/v1/admin/try-on/settings');
    expect(put.body).toEqual({ enabled: true, freeForEveryone: false, freeTrialDays: 7, disclaimer: 'Colours may vary.' });
  });

  it('asks before turning the service off, and sends nothing until confirmed', async () => {
    const { calls } = serve((req) => (req.method === 'PUT' ? { body: { ...SETTINGS, enabled: false } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on' });
    await userEvent.click(await screen.findByRole('switch', { name: /Try-on is available/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Every shopper loses try-on');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn try-on off' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ enabled: false }));
  });

  it('shows could-not-load with a retry, not an empty form', async () => {
    let fail = true;
    serve((req) => (req.path === '/v1/admin/try-on/settings' && fail ? { status: 500, body: { errorCode: 'server.error', message: 'Boom' } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on' });
    expect(await screen.findByTestId('state-error')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Save settings' })).toBeInTheDocument();
  });
});

describe('try-on plans', () => {
  it('creates a plan with the price in NPR', async () => {
    const { calls } = serve((req) => (req.method === 'POST' && req.path === '/v1/admin/try-on/plans' ? { body: { ...PLAN, id: 'p2' } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=plans' });
    expect(await screen.findByText('Monthly')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'Quarterly');
    await userEvent.type(within(dialog).getByLabelText(/Price/), '749');
    const duration = within(dialog).getByLabelText(/Duration/);
    await userEvent.clear(duration);
    await userEvent.type(duration, '90');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ name: 'Quarterly', description: null, priceAmount: 749, currency: 'NPR', durationDays: 90, isActive: true, sortOrder: 0 });
  });
});

describe('try-on subscribers', () => {
  it('grants access to an account for a number of days', async () => {
    const { calls } = serve((req) => (req.method === 'POST' && req.path === '/v1/admin/try-on/grants' ? { body: { ...SUB, id: 's2', source: 4 } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=subscribers' });
    await userEvent.click(await screen.findByRole('button', { name: 'Grant access' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Account id/), SUB.accountId);
    await userEvent.type(within(dialog).getByLabelText(/Note/), 'Influencer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant access' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ accountId: SUB.accountId, days: 30, note: 'Influencer' });
  });

  it('revokes with a reason', async () => {
    const { calls } = serve((req) => (req.method === 'POST' && req.path.endsWith('/revoke') ? { body: { ...SUB, state: 5 } } : undefined));
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=subscribers' });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Mina Shopper' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke access' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Shared account');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke access' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/v1/admin/try-on/subscriptions/s1/revoke');
    expect(post.body).toEqual({ reason: 'Shared account' });
  });

  it('a read-only operator sees subscribers without the write buttons', async () => {
    signInAs(['Readonly']);
    serve();
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=subscribers' });
    expect(await screen.findByText('Mina Shopper')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });
});

describe('try-on usage', () => {
  it('shows the KPIs for the period', async () => {
    const { calls } = serve((req) =>
      req.path === '/v1/admin/try-on/usage'
        ? {
            body: {
              fromUtc: '2026-09-15T00:00:00Z',
              toUtc: '2026-10-14T23:59:59Z',
              sessions: 1234,
              uniqueUsers: 321,
              activeSubscribers: 45,
              revenueAmount: 13455,
              currency: 'NPR',
              byDay: [{ date: '2026-10-13', sessions: 40, newSubscriptions: 2 }],
              topProducts: [{ productId: 'pr1', name: 'Linen kurta', sessions: 88 }],
            },
          }
        : undefined,
    );
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=usage' });
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Linen kurta')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/admin/try-on/usage')!.url).toContain('fromUtc=');
  });

  it('a missing endpoint says it is not available rather than showing zeros', async () => {
    serve();
    renderWithProviders(<TryOnPage />, { route: '/try-on?tab=usage' });
    expect(await screen.findByTestId('state-unavailable')).toBeInTheDocument();
  });
});
