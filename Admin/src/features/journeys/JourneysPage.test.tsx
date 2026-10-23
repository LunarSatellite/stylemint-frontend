import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { journeyTitle, validEndReason } from '@/api/journeys';
import { can } from '@/auth/roles';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt } from '@/auth/stepUp';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { JourneysPage } from './JourneysPage';

const OWNER = '0f1e2d3c-0000-4000-8000-000000000001';
const HOTEL = '0f1e2d3c-0000-4000-8000-000000000002';
const PARA = '0f1e2d3c-0000-4000-8000-000000000003';

function step(patch: Record<string, unknown> = {}) {
  return {
    id: 'st-1',
    index: 0,
    state: 2,
    vendorAccountId: OWNER,
    vendorName: 'Greenline Tours',
    vendorLogoUrl: null,
    reelId: 'a1b2c3d4-0000-4000-8000-0000000000a1',
    thumbnailUrl: 'https://cdn.test/a.jpg',
    caption: 'Our deluxe bus',
    isVisible: true,
    hiddenReason: 0,
    inviteNote: null,
    invitedUtc: null,
    acceptedUtc: '2026-10-23T08:00:00Z',
    closedUtc: null,
    ...patch,
  };
}

const OPEN = [step(), step({ id: 'st-2', index: 1, vendorAccountId: HOTEL, vendorName: 'Hotel Barahi', caption: 'Lakeside rooms', thumbnailUrl: null })];
const CLOSED = step({ id: 'st-3', index: 2, state: 3, vendorAccountId: PARA, vendorName: 'Sunrise Paragliding', isVisible: false, hiddenReason: 0, closedUtc: '2026-10-23T09:30:00Z' });

function journey(patch: Record<string, unknown> = {}) {
  return {
    id: 'j-1',
    title: 'Kathmandu → Pokhara weekend',
    city: 'Pokhara',
    state: 1,
    ownerVendorAccountId: OWNER,
    ownerName: 'Greenline Tours',
    ownerLogoUrl: null,
    isLive: true,
    visibleStepCount: 2,
    maxSteps: 8,
    memberCount: 2,
    endedUtc: null,
    endedBy: null,
    endReason: null,
    createdUtc: '2026-10-23T08:00:00Z',
    updatedUtc: '2026-10-23T09:00:00Z',
    steps: OPEN,
    allSteps: [...OPEN, CLOSED],
    ...patch,
  };
}

const page = (items: unknown[]) => ({ items, totalCount: items.length, nextCursor: null, previousCursor: null, pageSize: 25, hasMore: false });

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  registerStepUpPrompt(null);
  vi.unstubAllGlobals();
});

describe('journey roles and rules', () => {
  it('lets content moderators and read-only staff look, and only moderators / super admins end', () => {
    expect(can(['ContentMod'], 'viewModeration')).toBe(true);
    expect(can(['Readonly'], 'viewModeration')).toBe(true);
    expect(can(['PayoutsOps'], 'viewModeration')).toBe(false);
    expect(can(['ContentMod'], 'decideModeration')).toBe(true);
    expect(can(['Readonly'], 'decideModeration')).toBe(false);
    expect(can(['SuperAdmin'], 'decideModeration')).toBe(true);
  });

  it('names an untitled journey after its owner and checks the end reason length', () => {
    expect(journeyTitle({ title: null, ownerName: 'Greenline Tours' })).toBe('Greenline Tours journey');
    expect(journeyTitle({ title: 'Pokhara', ownerName: 'X' })).toBe('Pokhara');
    expect(validEndReason('ab')).toBe(false);
    expect(validEndReason('  abc  ')).toBe(true);
    expect(validEndReason('x'.repeat(500))).toBe(true);
    expect(validEndReason('x'.repeat(501))).toBe(false);
  });
});

describe('journeys list', () => {
  it('searches and filters on the server and shows owner, steps and status', async () => {
    signInAs(['ContentMod']);
    const { calls } = mockFetch((req) => (req.path === '/v1/admin/journeys' ? { body: page([journey(), journey({ id: 'j-2', title: null, state: 2, isLive: false })]) } : undefined));
    renderWithProviders(<JourneysPage />, { route: `/journeys?q=Pokhara&state=1&vendor=${HOTEL}` });
    const table = await screen.findByRole('table', { name: 'Journeys' });
    const rows = within(table).getAllByTestId('table-row');
    expect(rows[0]).toHaveTextContent('Kathmandu → Pokhara weekend');
    expect(rows[0]).toHaveTextContent('Greenline Tours');
    expect(rows[0]).toHaveTextContent('2 visible / 2');
    expect(rows[0]).toHaveTextContent('Live');
    expect(rows[1]).toHaveTextContent('Greenline Tours journey');
    expect(rows[1]).toHaveTextContent('Ended');
    const url = calls.find((c) => c.path === '/v1/admin/journeys')!.url;
    expect(url).toContain('q=Pokhara');
    expect(url).toContain('state=1');
    expect(url).toContain(`vendorAccountId=${HOTEL}`);
    expect(url).toContain('page=1');
  });

  it('says the feature is not deployed instead of showing no journeys', async () => {
    signInAs(['ContentMod']);
    mockFetch(() => undefined);
    renderWithProviders(<JourneysPage />, { route: '/journeys' });
    expect(await screen.findByTestId('state-unavailable')).toHaveTextContent('Journeys');
    expect(screen.queryByText('No journeys yet')).toBeNull();
  });
});

describe('journey detail', () => {
  it('shows members and every step, closed ones included', async () => {
    signInAs(['Readonly']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/journeys') return { body: page([]) };
      if (req.path === '/v1/admin/journeys/j-1') return { body: journey() };
      return undefined;
    });
    renderWithProviders(<JourneysPage />, { route: '/journeys?open=j-1' });
    expect(await screen.findByText('Members (2)')).toBeInTheDocument();
    expect(screen.getByText('Greenline Tours (owner)')).toBeInTheDocument();
    const steps = screen.getByRole('table', { name: 'Journey steps' });
    expect(within(steps).getByTestId('step-st-1')).toHaveTextContent('Greenline Tours');
    expect(within(steps).getByTestId('step-st-2')).toHaveTextContent('Hotel Barahi');
    expect(within(steps).getByTestId('step-st-3')).toHaveTextContent('Left');
    expect(within(steps).getByTestId('step-st-3')).toHaveTextContent('Closed');
    // Read-only staff can look but not end.
    expect(screen.queryByRole('button', { name: /End journey/ })).toBeNull();
    expect(screen.getByText(/can look at journeys but not end them/)).toBeInTheDocument();
  });

  it('ends a journey with a required reason', async () => {
    signInAs(['ContentMod']);
    const { calls } = mockFetch((req) => {
      if (req.method === 'GET' && req.path === '/v1/admin/journeys') return { body: page([journey()]) };
      if (req.method === 'GET' && req.path === '/v1/admin/journeys/j-1') return { body: journey() };
      if (req.method === 'POST' && req.path === '/v1/admin/journeys/j-1/end')
        return { body: journey({ state: 2, isLive: false, endedBy: 2, endReason: 'Misleading content', endedUtc: '2026-10-23T10:00:00Z' }) };
      return undefined;
    });
    renderWithProviders(<JourneysPage />, { route: '/journeys?open=j-1' });
    await userEvent.click(await screen.findByRole('button', { name: /End journey…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'End “Kathmandu → Pokhara weekend”' });
    expect(dialog).toHaveTextContent(/cannot be undone/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'End journey' }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'Misleading content');
    await userEvent.click(within(dialog).getByRole('button', { name: 'End journey' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ reason: 'Misleading content' }));
    expect(calls.find((c) => c.method === 'POST')!.headers['idempotency-key']).toBeTruthy();
  });

  it('offers no end button on a journey that already ended and shows the reason', async () => {
    signInAs(['SuperAdmin']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/journeys') return { body: page([]) };
      if (req.path === '/v1/admin/journeys/j-1') return { body: journey({ state: 2, isLive: false, endedBy: 2, endReason: 'Spam', endedUtc: '2026-10-23T10:00:00Z' }) };
      return undefined;
    });
    renderWithProviders(<JourneysPage />, { route: '/journeys?open=j-1' });
    expect(await screen.findByText('Spam')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /End journey/ })).toBeNull();
  });
});
