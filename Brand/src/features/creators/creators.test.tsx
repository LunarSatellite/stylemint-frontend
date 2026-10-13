import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import ApprovalsPage from './ApprovalsPage';
import { commissionRange, pct, toFraction } from './labels';
import PartnershipsPage from './PartnershipsPage';
import PaymentsPage from './PaymentsPage';
import { dialogWith, page, partnership } from './testkit';

const LIST = 'GET /v1/vendor/partnerships';

describe('commission labels', () => {
  it('shows fractions from the wire as percentages and converts typed percentages back', () => {
    expect(pct(0.15)).toBe('15%');
    expect(pct(0.125)).toBe('12.5%');
    expect(commissionRange(0.1, 0.15)).toBe('10–15%');
    expect(commissionRange(0.12, 0.12)).toBe('12%');
    expect(toFraction(15)).toBe(0.15);
    expect(toFraction(12.5)).toBe(0.125);
  });
});

describe('partnerships', () => {
  it('lists partnerships by state with the commission range', async () => {
    const calls = mockApi({ [LIST]: page([partnership()]) });
    renderWithProviders(<PartnershipsPage />);
    expect(await screen.findByText('Sita Creator')).toBeInTheDocument();
    expect(screen.getByText('10–15%')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/partnerships')?.search).toContain('states=3');
  });

  it('accepts a creator request only after confirming', async () => {
    const request = partnership({ id: 'p-9', state: 1, initiatedByCreator: true, requestMessage: 'I love your kurtas!', respondedUtc: null });
    const calls = mockApi({
      [LIST]: page([request]),
      'POST /v1/vendor/partnerships/p-9/accept-request': { body: { ...request, state: 3 } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    await user.click(await screen.findByRole('radio', { name: 'Requests' }));
    await user.click(await screen.findByText('Sita Creator'));
    expect(await screen.findByText('I love your kurtas!')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept request' }));
    const confirm = await dialogWith(/accept this partnership\?/i);
    expect(within(confirm).getByText(/earn 10–15% on sales/i)).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/accept-request'))).toBe(false);
    await user.click(within(confirm).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/vendor/partnerships/p-9/accept-request')).toBe(true));
  });

  it('declines a creator request after confirming', async () => {
    const request = partnership({ id: 'p-9', state: 1, initiatedByCreator: true });
    const calls = mockApi({
      [LIST]: page([request]),
      'POST /v1/vendor/partnerships/p-9/decline-request': { body: { ...request, state: 2 } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    await user.click(await screen.findByRole('radio', { name: 'Requests' }));
    await user.click(await screen.findByText('Sita Creator'));
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const confirm = await dialogWith(/decline this request\?/i);
    await user.click(within(confirm).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/decline-request'))).toBe(true));
  });

  it('invites a creator with the commission sent as fractions', async () => {
    const calls = mockApi({
      [LIST]: page([]),
      'GET /v1/vendor/partnerships/creators': page([
        { creatorAccountId: 'c-7', displayName: 'Hari Fits', handle: 'harifits', avatarUrl: null, bio: null, followerCount: 12400, niches: ['Streetwear'], hasExistingPartnership: false },
      ]),
      'GET /v1/vendor/briefs': page([]),
      'POST /v1/vendor/partnerships/invite': { body: partnership({ id: 'p-new', state: 1, creatorName: 'Hari Fits' }) },
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    expect(await screen.findByTestId('state-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /invite a creator/i }));
    const modal = await dialogWith('Invite a creator');
    expect(await within(modal).findByText('Hari Fits')).toBeInTheDocument();
    expect(modal).toHaveTextContent('12K followers');
    await user.click(within(modal).getByRole('button', { name: 'Choose' }));

    const min = within(modal).getByRole('textbox', { name: /lowest commission/i });
    const max = within(modal).getByRole('textbox', { name: /highest commission/i });
    await user.clear(min);
    await user.type(min, '8');
    await user.clear(max);
    await user.type(max, '12.5');
    await user.click(within(modal).getByRole('button', { name: /send invitation/i }));

    await waitFor(() => expect(calls.some((c) => c.path === '/v1/vendor/partnerships/invite')).toBe(true));
    const invite = calls.find((c) => c.path === '/v1/vendor/partnerships/invite')!;
    expect(invite.body).toMatchObject({ creatorProfileId: 'c-7', commissionMinPercent: 0.08, commissionMaxPercent: 0.125 });
    expect(invite.headers['Idempotency-Key']).toBeTruthy();
  });

  it('asks the seller to publish program terms when the first invite is refused for lack of them', async () => {
    const calls = mockApi({
      [LIST]: page([]),
      'GET /v1/vendor/partnerships/creators': page([
        { creatorAccountId: 'c-7', displayName: 'Hari Fits', handle: null, avatarUrl: null, bio: null, followerCount: null, niches: [], hasExistingPartnership: false },
      ]),
      'POST /v1/vendor/partnerships/invite': {
        status: 400,
        body: { title: 'Vendor must publish partnership terms before inviting a creator.', status: 400, errorCode: 'rule.violation', field: 'vendorProfileId' },
      },
      'POST /v1/vendor/partnership-terms': { body: { id: 't-1' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    await user.click(await screen.findByRole('button', { name: /invite a creator/i }));
    const modal = await dialogWith('Invite a creator');
    await user.click(await within(modal).findByRole('button', { name: 'Choose' }));
    await user.click(within(modal).getByRole('button', { name: /send invitation/i }));
    expect(await within(modal).findByTestId('needs-terms')).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: /write program terms/i }));
    const terms = await dialogWith(/one line per point/i);
    await user.click(within(terms).getByRole('button', { name: /publish terms/i }));
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/vendor/partnership-terms')).toBe(true));
    const body = calls.find((c) => c.path === '/v1/vendor/partnership-terms')!.body as {
      whoCanJoin: { bullets: string[] };
      reelContentRules: { bullets: { text: string; inlineLinks: unknown[] }[] };
    };
    expect(body.whoCanJoin.bullets.length).toBeGreaterThan(0);
    expect(body.reelContentRules.bullets[0]).toEqual({ text: 'Tag the exact product shown in the reel', inlineLinks: [] });
    await waitFor(() => expect(within(modal).queryByTestId('needs-terms')).not.toBeInTheDocument());
  });

  it('refuses a range where the highest is below the lowest', async () => {
    const calls = mockApi({
      [LIST]: page([]),
      'GET /v1/vendor/partnerships/creators': page([
        { creatorAccountId: 'c-7', displayName: 'Hari Fits', handle: null, avatarUrl: null, bio: null, followerCount: null, niches: [], hasExistingPartnership: false },
      ]),
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    await user.click(await screen.findByRole('button', { name: /invite a creator/i }));
    const modal = await dialogWith('Invite a creator');
    await user.click(await within(modal).findByRole('button', { name: 'Choose' }));
    const min = within(modal).getByRole('textbox', { name: /lowest commission/i });
    await user.clear(min);
    await user.type(min, '30');
    await user.click(within(modal).getByRole('button', { name: /send invitation/i }));
    expect(await within(modal).findByText(/cannot be lower than the lowest/i)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/v1/vendor/partnerships/invite')).toBe(false);
  });

  it('ends a partnership only with a reason', async () => {
    const calls = mockApi({
      [LIST]: page([partnership()]),
      'POST /v1/vendor/partnerships/p-1/end': { body: partnership({ state: 5 }) },
    });
    const user = userEvent.setup();
    renderWithProviders(<PartnershipsPage />);
    await user.click(await screen.findByText('Sita Creator'));
    await user.click(await screen.findByRole('button', { name: 'End partnership' }));
    const dialog = await dialogWith(/ending is permanent/i);
    await user.click(within(dialog).getByRole('button', { name: 'End partnership' }));
    expect(await within(dialog).findByText(/please give a reason/i)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Season over');
    await user.click(within(dialog).getByRole('button', { name: 'End partnership' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/end'))?.body).toEqual({ reason: 'Season over' }));
  });

  it('says "could not load", not "no partnerships", when the list fails', async () => {
    mockApi({ [LIST]: { status: 500, body: { title: 'Database is busy' } } });
    renderWithProviders(<PartnershipsPage />);
    expect(await screen.findByText(/could not load partnerships/i)).toBeInTheDocument();
    expect(screen.getByText('Database is busy')).toBeInTheDocument();
    expect(screen.queryByTestId('state-empty')).not.toBeInTheDocument();
  });
});

const APPROVALS = 'GET /v1/vendor/reel-approvals';
function approval(patch: Record<string, unknown> = {}) {
  return {
    id: 'ra-1',
    reelId: 'reel-1',
    creatorAccountId: 'c-1',
    vendorAccountId: 'v-1',
    partnershipId: 'p-1',
    brandBriefId: 'b-1',
    brandBriefVersion: 1,
    round: 1,
    state: 1,
    creatorNote: 'First cut, music can change',
    submittedUtc: new Date().toISOString(),
    decidedById: null,
    decidedUtc: null,
    rejectionReason: null,
    expiredUtc: null,
    ...patch,
  };
}

describe('content approvals', () => {
  it('approves a reel after confirming', async () => {
    const calls = mockApi({
      [APPROVALS]: { body: [approval()] },
      'GET /v1/public/creators/c-1': { body: { accountId: 'c-1', displayName: 'Sita Creator', handle: 'sita.styles', styleTags: [], socialHandles: {} } },
      'POST /v1/vendor/reel-approvals/ra-1/approve': { body: { id: 'reel-1' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<ApprovalsPage />);
    const card = await screen.findByTestId('approval-card');
    expect(await within(card).findByText('Sita Creator')).toBeInTheDocument();
    expect(within(card).getByText('First cut, music can change')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Approve' }));
    const confirm = await dialogWith(/approve this reel\?/i);
    await user.click(within(confirm).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/vendor/reel-approvals/ra-1/approve')).toBe(true));
  });

  it('asks for changes with a reason', async () => {
    const calls = mockApi({
      [APPROVALS]: { body: [approval()] },
      'POST /v1/vendor/reel-approvals/ra-1/reject': { body: approval({ state: 3 }) },
    });
    const user = userEvent.setup();
    renderWithProviders(<ApprovalsPage />);
    await user.click(await screen.findByRole('button', { name: /ask for changes/i }));
    const dialog = await dialogWith(/the reel will not go live/i);
    await user.type(within(dialog).getByRole('textbox', { name: /what should change/i }), 'Show the price tag clearly');
    await user.click(within(dialog).getByRole('button', { name: /send to creator/i }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/reject'))?.body).toEqual({ reason: 'Show the price tag clearly' }));
  });

  it('shows an empty state when nothing waits, and an error with retry when loading fails', async () => {
    mockApi({ [APPROVALS]: { body: [approval({ state: 2 })] } });
    const first = renderWithProviders(<ApprovalsPage />);
    expect(await screen.findByText(/nothing waiting for approval/i)).toBeInTheDocument();
    first.unmount();

    mockApi({ [APPROVALS]: { status: 503, body: { title: 'Reels service is down' } } });
    renderWithProviders(<ApprovalsPage />);
    expect(await screen.findByText(/could not load reels waiting for approval/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/nothing waiting/i)).not.toBeInTheDocument();
  });
});

describe('payments to creators', () => {
  it('totals commission per creator and lists retainer fees, without any buyer data', async () => {
    mockApi({
      'GET /v1/vendor/creator-performance': {
        body: [
          { creatorAccountId: 'c-1', unitsSold: 12, attributedRevenue: 24000, commissionPaid: 3000, currency: 'NPR', distinctReelCount: 3, creatorHandle: 'sita.styles', creatorDisplayName: 'Sita Creator', creatorAvatarUrl: null },
          { creatorAccountId: 'c-2', unitsSold: 4, attributedRevenue: 8000, commissionPaid: 1200, currency: 'NPR', distinctReelCount: 1, creatorHandle: null, creatorDisplayName: 'Hari Fits', creatorAvatarUrl: null },
        ],
      },
      'GET /v1/vendor/retainers': {
        body: [{ id: 'r-1', creatorAccountId: 'c-1', monthlyAmount: 15000, currency: 'NPR', deliverablesPerMonth: '4 reels', autoRenew: true, renewalNoticeDays: 30, nextBillingUtc: '2026-11-01T00:00:00Z', state: 2, totalPeriodsCompleted: 2, createdUtc: '2026-08-01T00:00:00Z' }],
      },
    });
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText('Rs 4,200')).toBeInTheDocument();
    expect(screen.getByText('Rs 32,000')).toBeInTheDocument();
    expect(screen.getAllByText('Rs 15,000').length).toBeGreaterThan(0);
    expect(screen.getByTestId('payment-table')).toHaveTextContent('Hari Fits');
  });

  it('says it could not load when creator commissions fail', async () => {
    mockApi({ 'GET /v1/vendor/creator-performance': { status: 500, body: { title: 'Boom' } }, 'GET /v1/vendor/retainers': { body: [] } });
    renderWithProviders(<PaymentsPage />);
    expect(await screen.findByText(/could not load creator commissions/i)).toBeInTheDocument();
  });
});
