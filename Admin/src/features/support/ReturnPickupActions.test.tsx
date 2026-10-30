import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { can } from '@/auth/roles';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { __resetResolveMissingForTests, ReturnPickupFacts } from './ReturnPickups';
import { ReturnsPage } from './ReturnsPage';

const DETAIL = '/v1/admin/delivery/return-pickups/rr-1';
const RESOLVE = '/v1/admin/delivery/return-pickups/rr-1/resolve';

const PICKUP = {
  id: 'rp-1',
  returnRequestId: 'rr-1',
  orderId: 'o-1',
  subOrderId: 'so-1',
  trackingNumber: 'SM-R-00000042',
  state: 5,
  stage: 'NoRiders',
  mode: 'Rider',
  packageId: 'pk-9',
  requestedUtc: '2026-10-27T09:00:00Z',
  pickedUpUtc: null,
  receivedUtc: null,
  requestExpiresUtc: null,
  rider: null,
  attempts: { failed: 0, max: 3, lastFailureCode: null },
  collectionPhotoUrls: [],
  fare: null,
  allowedActions: ['SearchAgain', 'CancelReturn'],
};

const resolves = (calls: Captured[]) => calls.filter((c) => c.method === 'POST' && c.path === RESOLVE);

beforeEach(() => {
  installSession();
  resetSessionForTests();
  __resetResolveMissingForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('support actions on a stuck return pickup', () => {
  it('is a SupportAgent + SuperAdmin capability', () => {
    expect(can(['SupportAgent'], 'resolveReturnPickups')).toBe(true);
    expect(can(['SuperAdmin'], 'resolveReturnPickups')).toBe(true);
    expect(can(['Readonly'], 'resolveReturnPickups')).toBe(false);
    expect(can(['PayoutsOps'], 'resolveReturnPickups')).toBe(false);
  });

  it('shows Needs action and a button per allowed action; searching again needs a note and refreshes', async () => {
    signInAs(['SupportAgent']);
    let done = false;
    const { calls } = mockFetch((req) => {
      if (req.path === DETAIL) return { body: done ? { ...PICKUP, stage: 'SearchingRider', state: 1, allowedActions: ['CancelReturn'] } : PICKUP };
      if (req.path === RESOLVE) {
        done = true;
        return { body: { ...PICKUP, stage: 'SearchingRider', state: 1, allowedActions: ['CancelReturn'] } };
      }
      return undefined;
    });
    renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);

    const facts = await screen.findByTestId('admin-return-pickup');
    expect(within(facts).getByTestId('needs-action')).toHaveTextContent('Needs action');
    const actions = within(facts).getByTestId('pickup-actions');
    expect(within(actions).getByRole('button', { name: 'Search riders again' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Cancel return' })).toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: 'Mark item received' })).not.toBeInTheDocument();

    await userEvent.click(within(actions).getByRole('button', { name: 'Search riders again' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search riders again' });
    expect(dialog).toHaveTextContent(/fresh rider search/i);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search riders again' }));
    expect(await within(dialog).findByText('Write a note for the audit log')).toBeInTheDocument();
    expect(resolves(calls)).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: /note/i }), '  Seller called, rider app was down  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search riders again' }));

    await waitFor(() => expect(resolves(calls)).toHaveLength(1));
    const post = resolves(calls)[0]!;
    expect(post.body).toEqual({ action: 'SearchAgain', note: 'Seller called, rider app was down' });
    expect(post.headers['idempotency-key']).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search riders again' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('needs-action')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Search riders again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel return' })).toBeInTheDocument();
  });

  it('rejects a note over 500 characters without calling the server', async () => {
    signInAs(['SuperAdmin']);
    const { calls } = mockFetch((req) => (req.path === DETAIL ? { body: { ...PICKUP, stage: 'NeedsSupport', allowedActions: ['MarkReceived'] } } : undefined));
    renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mark item received' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark item received' });
    const box = within(dialog).getByRole('textbox', { name: /note/i });
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(501));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark item received' }));
    expect(await within(dialog).findByText(/under 500 characters/i)).toBeInTheDocument();
    expect(resolves(calls)).toHaveLength(0);
  });

  it('409 return_pickup.action_not_allowed: plain words, refresh, and the same submission keeps its key', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) => {
      if (req.path === DETAIL) return { body: { ...PICKUP, stage: 'AttemptFailed', allowedActions: ['CancelReturn'] } };
      if (req.path === RESOLVE)
        return { status: 409, body: { title: 'Action not allowed', status: 409, errorCode: 'return_pickup.action_not_allowed' } };
      return undefined;
    });
    renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel return' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel return' });
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    await userEvent.type(within(dialog).getByRole('textbox', { name: /note/i }), 'Buyer asked to cancel');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel return' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/no longer possible/i);
    // The details are read again so the operator sees the pickup as it is now.
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.path === DETAIL).length).toBeGreaterThan(1));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel return' }));
    await waitFor(() => expect(resolves(calls)).toHaveLength(2));
    const [first, second] = resolves(calls);
    expect(second!.headers['idempotency-key']).toEqual(first!.headers['idempotency-key']);
    expect(first!.body).toEqual({ action: 'CancelReturn', note: 'Buyer asked to cancel' });
  });

  it('a bare 404 from the resolve route hides the buttons', async () => {
    signInAs(['SupportAgent']);
    const { calls } = mockFetch((req) => (req.path === DETAIL ? { body: PICKUP } : undefined));
    renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Search riders again' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search riders again' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /note/i }), 'Try again');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search riders again' }));

    await waitFor(() => expect(resolves(calls)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('pickup-actions')).not.toBeInTheDocument());
    expect(await screen.findByText(/not on this server yet/i)).toBeInTheDocument();
  });

  it('an older server (no allowedActions) and a role without the capability show no buttons', async () => {
    signInAs(['SupportAgent']);
    const { allowedActions: _omit, ...old } = PICKUP;
    mockFetch((req) => (req.path === DETAIL ? { body: old } : undefined));
    const { unmount } = renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);
    await screen.findByTestId('admin-return-pickup');
    expect(screen.queryByTestId('pickup-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('needs-action')).not.toBeInTheDocument();
    unmount();

    signInAs(['Readonly']);
    mockFetch((req) => (req.path === DETAIL ? { body: PICKUP } : undefined));
    renderWithProviders(<ReturnPickupFacts returnRequestId="rr-1" />);
    await screen.findByTestId('admin-return-pickup');
    expect(screen.getByTestId('needs-action')).toBeInTheDocument();
    expect(screen.queryByTestId('pickup-actions')).not.toBeInTheDocument();
  });

  it('marks stuck pickups "Needs action" in the Rider pickups list', async () => {
    signInAs(['SupportAgent']);
    mockFetch((req) =>
      req.path === '/v1/admin/delivery/return-pickups'
        ? {
            body: {
              items: [
                { ...PICKUP, needsAction: true },
                { ...PICKUP, id: 'rp-2', returnRequestId: 'rr-2', trackingNumber: 'SM-R-00000043', stage: 'Collected', needsAction: false },
              ],
              nextCursor: null,
              hasMore: false,
            },
          }
        : undefined,
    );
    renderWithProviders(<ReturnsPage />, { route: '/returns?view=pickups' });
    const table = await screen.findByRole('table', { name: 'Return pickups' });
    const rows = within(table).getAllByTestId('table-row');
    expect(within(rows[0]!).getByTestId('needs-action')).toBeInTheDocument();
    expect(within(rows[1]!).queryByTestId('needs-action')).not.toBeInTheDocument();
  });
});
