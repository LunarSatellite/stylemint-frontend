import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { mockApi, renderWithProviders } from '../../test/utils';
import { page, signInVendor } from '../services/testkit';
import {
  journeyErrorMessage,
  journeyPermissions,
  journeyTitle,
  moveStep,
  placeStep,
  sameOrder,
  validateJourneyText,
  type JourneyReelOption,
  type JourneyStep,
  type VendorJourney,
} from './api';
import JourneyDetailPage from './JourneyDetailPage';
import JourneysPage from './JourneysPage';

vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

const ME = 'vendor-me';
const HOTEL = 'vendor-hotel';
const PARA = 'vendor-para';

function step(patch: Partial<JourneyStep> = {}): JourneyStep {
  return {
    id: 'st-1',
    index: 0,
    state: 2,
    vendorAccountId: ME,
    vendorName: 'Greenline Tours',
    vendorLogoUrl: null,
    reelId: 'reel-a',
    thumbnailUrl: 'https://cdn.test/a.jpg',
    caption: 'Our deluxe bus',
    isVisible: true,
    hiddenReason: 0,
    inviteNote: null,
    invitedUtc: null,
    acceptedUtc: '2026-10-23T08:00:00Z',
    ...patch,
  };
}

const STEPS: JourneyStep[] = [
  step(),
  step({ id: 'st-2', index: 1, vendorAccountId: HOTEL, vendorName: 'Hotel Barahi', reelId: 'reel-h', thumbnailUrl: null, caption: 'Lakeside rooms' }),
  step({
    id: 'st-3',
    index: 2,
    state: 1,
    vendorAccountId: PARA,
    vendorName: 'Sunrise Paragliding',
    reelId: null,
    thumbnailUrl: null,
    caption: null,
    isVisible: false,
    hiddenReason: 1,
    inviteNote: 'Fly with us?',
    invitedUtc: '2026-10-23T08:05:00Z',
    acceptedUtc: null,
  }),
];

function journey(patch: Partial<VendorJourney> = {}): VendorJourney {
  return {
    id: 'j-1',
    title: 'Kathmandu → Pokhara weekend',
    city: 'Pokhara',
    state: 1,
    ownerVendorAccountId: ME,
    ownerName: 'Greenline Tours',
    ownerLogoUrl: null,
    myRole: 1,
    myStepId: 'st-1',
    isLive: true,
    visibleStepCount: 2,
    maxSteps: 8,
    endedUtc: null,
    endedBy: null,
    endReason: null,
    createdUtc: '2026-10-23T08:00:00Z',
    updatedUtc: '2026-10-23T09:00:00Z',
    steps: STEPS,
    ...patch,
  };
}

/** The same journey seen by the hotel (a member). */
const asMember = () => journey({ myRole: 2, myStepId: 'st-2' });
/** The same journey seen by the paragliding company (invited, not yet accepted). */
const asInvitee = () => journey({ myRole: 3, myStepId: 'st-3' });

function reel(patch: Partial<JourneyReelOption> = {}): JourneyReelOption {
  return { reelId: 'reel-x', thumbnailUrl: 'https://cdn.test/x.jpg', caption: 'Sunset flight', publishedAtUtc: '2026-10-20T00:00:00Z', journeyCount: 0, canUse: true, reason: null, ...patch };
}

const REELS = [reel(), reel({ reelId: 'reel-full', caption: 'Busy reel', journeyCount: 3, canUse: false, reason: 'journey.reel_limit' })];

beforeEach(async () => {
  await signInVendor();
});

function renderJourneys(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/journeys" element={<JourneysPage />} />
      <Route path="/journeys/:id" element={<JourneyDetailPage />} />
    </Routes>,
    { route },
  );
}

const writes = <T extends { method: string }>(calls: T[]) => calls.filter((c) => c.method !== 'GET');

describe('journey helpers', () => {
  it('moves a step up or down and keeps the ends in place', () => {
    expect(moveStep(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveStep(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveStep(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveStep(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveStep(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b']);
  });

  it('places a dragged step at the drop position', () => {
    expect(placeStep(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(placeStep(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(placeStep(['a', 'b', 'c'], 'b', 9)).toEqual(['a', 'c', 'b']);
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('names an untitled journey after its owner and limits title and city to 80 characters', () => {
    expect(journeyTitle({ title: null, ownerName: 'Greenline Tours' })).toBe('Greenline Tours journey');
    expect(journeyTitle({ title: '  ', ownerName: 'Greenline Tours' })).toBe('Greenline Tours journey');
    expect(journeyTitle({ title: 'Pokhara weekend', ownerName: 'X' })).toBe('Pokhara weekend');
    expect(validateJourneyText('a'.repeat(80), 'b'.repeat(80))).toBeNull();
    expect(validateJourneyText('a'.repeat(81), '')).toMatch(/title/);
    expect(validateJourneyText('', 'b'.repeat(81))).toMatch(/city/);
  });

  it('gives the owner, a member and an invitee only their own actions', () => {
    const owner = journeyPermissions(journey());
    expect(owner).toMatchObject({ canEdit: true, canInvite: true, canReorder: true, canEnd: true, canLeave: false, canRespond: false, canReplaceReel: true });
    expect(owner.canRemove(STEPS[0]!)).toBe(false);
    expect(owner.canRemove(STEPS[1]!)).toBe(true);
    expect(owner.canRemove(STEPS[2]!)).toBe(true);

    const member = journeyPermissions(asMember());
    expect(member).toMatchObject({ canEdit: false, canInvite: false, canReorder: false, canEnd: false, canLeave: true, canRespond: false, canReplaceReel: true });
    expect(member.canRemove(STEPS[2]!)).toBe(false);

    const invitee = journeyPermissions(asInvitee());
    expect(invitee).toMatchObject({ canLeave: false, canRespond: true, canReplaceReel: false });

    const ended = journeyPermissions(journey({ state: 2 }));
    expect(ended).toMatchObject({ canEdit: false, canInvite: false, canReorder: false, canEnd: false, canReplaceReel: false });
    expect(ended.canRemove(STEPS[1]!)).toBe(false);

    expect(journeyPermissions(journey({ maxSteps: 3 })).canInvite).toBe(false);
  });

  it('explains journey error codes in plain words and falls back to the server message', () => {
    expect(journeyErrorMessage(new ApiError(409, 'Conflict', 'journey.reel_limit', null))).toMatch(/already in 3 journeys/);
    expect(journeyErrorMessage(new ApiError(409, 'Conflict', 'state.concurrency_conflict', null))).toMatch(/Reload/);
    expect(journeyErrorMessage(new ApiError(400, 'Something specific', 'journey.unknown_code', null))).toBe('Something specific');
  });
});

describe('journeys list', () => {
  it('lists owned, joined and invited journeys with a preview, and flags pending invitations', async () => {
    mockApi({
      'GET /v1/vendor/journeys': {
        body: page([journey(), { ...asInvitee(), id: 'j-2', title: null, ownerName: 'Pokhara Boats', isLive: false, visibleStepCount: 1 }]),
      },
    });
    renderJourneys('/journeys');
    const owned = await screen.findByTestId('journey-j-1');
    expect(owned).toHaveTextContent('Kathmandu → Pokhara weekend');
    expect(owned).toHaveTextContent('Owner');
    expect(owned).toHaveTextContent('Live in the feed');
    expect(within(owned).getByTestId('preview-step-1')).toHaveTextContent('Greenline Tours');
    expect(within(owned).getByTestId('preview-step-2')).toHaveTextContent('Hotel Barahi');
    const invited = screen.getByTestId('journey-j-2');
    expect(invited).toHaveTextContent('Pokhara Boats journey');
    expect(invited).toHaveTextContent('Invited');
    expect(invited).toHaveTextContent('Not live yet');
    expect(screen.getByText(/1 business has invited you/)).toBeInTheDocument();
  });

  it('filters by role on the server', async () => {
    const calls = mockApi({ 'GET /v1/vendor/journeys': { body: page([]) } });
    renderJourneys('/journeys?role=3');
    expect(await screen.findByText('No invitations')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/vendor/journeys')!.search).toContain('role=3');
  });

  it('says journeys are being set up while the endpoint is missing, never "no journeys"', async () => {
    mockApi({});
    renderJourneys('/journeys');
    expect(await screen.findByTestId('state-setting-up')).toHaveTextContent('Journeys are being set up');
    expect(screen.queryByText('No journeys yet')).toBeNull();
    expect(screen.queryByRole('button', { name: /New journey/ })).toBeNull();
  });

  it('shows an error with retry when the list fails', async () => {
    mockApi({ 'GET /v1/vendor/journeys': { status: 500, body: { title: 'Boom', status: 500 } } });
    renderJourneys('/journeys');
    expect(await screen.findByTestId('state-error')).toHaveTextContent('Could not load your journeys');
  });

  it('creates a journey with one of my published reels as step 1', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys': { body: page([]) },
      'GET /v1/vendor/journeys/my-reels': { body: REELS },
      'POST /v1/vendor/journeys': { body: journey({ id: 'j-new', steps: [STEPS[0]!], isLive: false, visibleStepCount: 1 }) },
      'GET /v1/vendor/journeys/j-new': { body: journey({ id: 'j-new', steps: [STEPS[0]!], isLive: false, visibleStepCount: 1 }) },
    });
    renderJourneys('/journeys');
    await userEvent.click((await screen.findAllByRole('button', { name: /New journey/ }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New journey' });
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Pokhara weekend');
    await userEvent.type(within(dialog).getByLabelText(/^City/), 'Pokhara');
    const create = within(dialog).getByRole('button', { name: 'Create journey' });
    expect(create).toBeDisabled();
    expect(await within(dialog).findByRole('button', { name: /Busy reel \(Already in 3 journeys\)/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: /^Sunset flight/ }));
    expect(within(dialog).getByRole('button', { name: /^Sunset flight/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(create);
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Pokhara weekend', city: 'Pokhara', reelId: 'reel-x' }));
    expect(calls.find((c) => c.method === 'POST')!.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByText(/Shows in the feed once one more business adds/)).toBeInTheDocument();
  });

  it('tells a seller without published reels to publish one first', async () => {
    mockApi({ 'GET /v1/vendor/journeys': { body: page([]) }, 'GET /v1/vendor/journeys/my-reels': { body: [] } });
    renderJourneys('/journeys');
    await userEvent.click((await screen.findAllByRole('button', { name: /New journey/ }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New journey' });
    expect(await within(dialog).findByText('No published reels yet')).toBeInTheDocument();
  });
});

describe('journey detail — owner', () => {
  it('shows the swipe order with thumbnails and names, and the steps with their state', async () => {
    mockApi({ 'GET /v1/vendor/journeys/j-1': { body: journey() } });
    renderJourneys('/journeys/j-1');
    const preview = await screen.findByTestId('journey-preview');
    expect(within(preview).getByTestId('preview-step-1')).toHaveTextContent('1. Greenline Tours');
    expect(within(preview).getByTestId('preview-step-2')).toHaveTextContent('2. Hotel Barahi');
    expect(within(preview).getByTestId('preview-step-3')).toHaveTextContent('Waiting for their reel');
    expect(preview.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/a.jpg');
    expect(screen.getByTestId('step-st-3')).toHaveTextContent('Invited');
    expect(screen.getByTestId('step-st-3')).toHaveTextContent('Fly with us?');
    expect(screen.getByText('Steps (3 of 8)')).toBeInTheDocument();
    // The owner's own step cannot be removed.
    expect(screen.queryByRole('button', { name: 'Remove Greenline Tours' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move Greenline Tours up' })).toBeDisabled();
  });

  it('reorders with the arrows, sending every open step once', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: journey() },
      'PUT /v1/vendor/journeys/j-1/order': { body: journey({ steps: [STEPS[0]!, STEPS[2]!, STEPS[1]!] }) },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Move Hotel Barahi down' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({ method: 'PUT', path: '/v1/vendor/journeys/j-1/order', body: { stepIds: ['st-1', 'st-3', 'st-2'] } });
    await waitFor(() => expect(within(screen.getByTestId('journey-preview')).getByTestId('preview-step-2')).toHaveTextContent('Sunrise Paragliding'));
  });

  it('cancels an invitation only after confirming', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: journey() },
      'DELETE /v1/vendor/journeys/j-1/steps/st-3': { body: journey({ steps: [STEPS[0]!, STEPS[1]!] }) },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Sunrise Paragliding' }));
    let dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Cancel the invitation to Sunrise Paragliding?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes(calls)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Sunrise Paragliding' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ method: 'DELETE', path: '/v1/vendor/journeys/j-1/steps/st-3' })]));
    await waitFor(() => expect(screen.queryByTestId('step-st-3')).toBeNull());
  });

  it('ends the journey after confirming', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: journey() },
      'POST /v1/vendor/journeys/j-1/end': { body: journey({ state: 2, isLive: false, endedBy: 1, endedUtc: '2026-10-23T10:00:00Z' }) },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: /End journey/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'End journey' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ method: 'POST', path: '/v1/vendor/journeys/j-1/end' })]));
    expect(await screen.findByText('This journey has ended')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite a business/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move .* down/ })).toBeNull();
  });

  it('invites a business found by name, with a note, and does not offer businesses already in it', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: journey() },
      'GET /v1/vendor/journeys/vendors': {
        body: [
          { vendorAccountId: HOTEL, businessName: 'Hotel Barahi', logoUrl: null, city: 'Pokhara', category: 1, isVerified: true },
          { vendorAccountId: 'vendor-boat', businessName: 'Phewa Boats', logoUrl: null, city: 'Pokhara', category: 0, isVerified: false },
        ],
      },
      'POST /v1/vendor/journeys/j-1/invites': { body: journey() },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: /Invite a business/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a business' });
    await userEvent.type(within(dialog).getByLabelText('Business name'), 'Pokh');
    expect(await within(dialog).findByRole('listitem', { name: 'Hotel Barahi (already in this journey)' }, { timeout: 2000 })).toBeDisabled();
    expect(calls.find((c) => c.path === '/v1/vendor/journeys/vendors')!.search).toContain('q=Pokh');
    await userEvent.click(within(dialog).getByRole('listitem', { name: 'Phewa Boats' }));
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Join our weekend?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    await waitFor(() =>
      expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/vendor/journeys/j-1/invites', body: { vendorAccountId: 'vendor-boat', note: 'Join our weekend?' } })]),
    );
  });

  it('shows the mapped message when a write is refused', async () => {
    mockApi({
      'GET /v1/vendor/journeys/j-1': { body: journey() },
      'PUT /v1/vendor/journeys/j-1/order': { status: 409, body: { title: 'Conflict', status: 409, errorCode: 'state.concurrency_conflict' } },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Move Hotel Barahi up' }));
    expect(await screen.findByText(/Someone changed this journey at the same moment/)).toBeInTheDocument();
  });
});

describe('journey detail — invitee and member', () => {
  it('accepts an invitation with a picked reel', async () => {
    const accepted = journey({ myRole: 2, myStepId: 'st-3', steps: [STEPS[0]!, STEPS[1]!, { ...STEPS[2]!, state: 2, reelId: 'reel-x', isVisible: true, hiddenReason: 0 }] });
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: asInvitee() },
      'GET /v1/vendor/journeys/my-reels': { body: REELS },
      'POST /v1/vendor/journeys/j-1/steps/st-3/accept': { body: accepted },
    });
    renderJourneys('/journeys/j-1');
    expect(await screen.findByText('Greenline Tours invited you')).toBeInTheDocument();
    expect(screen.getByText('“Fly with us?”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /End journey/ })).toBeNull();
    const accept = screen.getByRole('button', { name: 'Accept with this reel' });
    expect(accept).toBeDisabled();
    await userEvent.click(await screen.findByRole('button', { name: /^Sunset flight/ }));
    await userEvent.click(accept);
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/vendor/journeys/j-1/steps/st-3/accept', body: { reelId: 'reel-x' } })]));
    await waitFor(() => expect(screen.queryByText('Greenline Tours invited you')).toBeNull());
    expect(screen.getByRole('button', { name: /Leave/ })).toBeInTheDocument();
    // my-reels is asked about this journey, so a reel already in it is not counted twice.
    expect(calls.find((c) => c.path === '/v1/vendor/journeys/my-reels')!.search).toContain('journeyId=j-1');
  });

  it('declines an invitation after confirming', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: asInvitee() },
      'GET /v1/vendor/journeys/my-reels': { body: REELS },
      'POST /v1/vendor/journeys/j-1/steps/st-3/decline': { status: 204 },
      'GET /v1/vendor/journeys': { body: page([]) },
    });
    renderJourneys('/journeys/j-1');
    await userEvent.click(await screen.findByRole('button', { name: /^Decline$/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ path: '/v1/vendor/journeys/j-1/steps/st-3/decline' })]));
    expect(await screen.findByText('No journeys yet')).toBeInTheDocument();
  });

  it('lets a member replace its reel and leave, but not reorder, remove or end', async () => {
    const calls = mockApi({
      'GET /v1/vendor/journeys/j-1': { body: asMember() },
      'GET /v1/vendor/journeys/my-reels': { body: [reel({ reelId: 'reel-h', caption: 'Lakeside rooms', journeyCount: 1 }), reel()] },
      'PUT /v1/vendor/journeys/j-1/steps/st-2/reel': { body: asMember() },
      'POST /v1/vendor/journeys/j-1/leave': { status: 204 },
      'GET /v1/vendor/journeys': { body: page([]) },
    });
    renderJourneys('/journeys/j-1');
    expect(await screen.findByTestId('step-st-2')).toHaveTextContent('Hotel Barahi (you)');
    expect(screen.queryByRole('button', { name: /Move .* down/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole('button', { name: /End journey/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Replace my reel/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace my reel' });
    expect(await within(dialog).findByRole('button', { name: /Lakeside rooms \(In use now\)/ })).toBeInTheDocument();
    const use = within(dialog).getByRole('button', { name: 'Use this reel' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Lakeside rooms/ }));
    expect(use).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: /^Sunset flight/ }));
    await userEvent.click(use);
    await waitFor(() => expect(writes(calls)).toEqual([expect.objectContaining({ method: 'PUT', path: '/v1/vendor/journeys/j-1/steps/st-2/reel', body: { reelId: 'reel-x' } })]));

    await userEvent.click(await screen.findByRole('button', { name: /Leave/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Leave this journey?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Leave journey' }));
    await waitFor(() => expect(writes(calls).map((c) => c.path)).toContain('/v1/vendor/journeys/j-1/leave'));
    expect(await screen.findByText('No journeys yet')).toBeInTheDocument();
  });

  it('says "Journey not found" for a journey the business is no longer in', async () => {
    mockApi({ 'GET /v1/vendor/journeys/j-9': { status: 404, body: { title: 'Not found', status: 404, errorCode: 'journey.not_found' } } });
    renderJourneys('/journeys/j-9');
    expect(await screen.findByText('Journey not found')).toBeInTheDocument();
    expect(screen.queryByTestId('state-setting-up')).toBeNull();
  });

  it('shows why an admin ended a journey', async () => {
    mockApi({ 'GET /v1/vendor/journeys/j-1': { body: journey({ state: 2, isLive: false, endedBy: 2, endReason: 'Misleading content', endedUtc: '2026-10-23T10:00:00Z' }) } });
    renderJourneys('/journeys/j-1');
    expect(await screen.findByText('Ended by StyleMint')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Misleading content/)).toBeInTheDocument();
  });
});
