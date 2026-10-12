import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt, StepUpCancelled } from '@/auth/stepUp';
import { http } from '@/api/client';
import { mockFetch, renderWithProviders, signInAs, type Captured } from '@/test/utils';
import { AdminsPage } from './AdminsPage';

const NEW_FIELDS = {
  id: 'a1',
  ssoSubject: null,
  email: 'asha@stylemint.test',
  displayName: 'Asha Operator',
  state: 1,
  lastLoginUtc: '2026-10-01T08:00:00Z',
  lastSignInUtc: '2026-10-11T08:00:00Z',
  signInMethods: ['google', 'password'],
  lastSignInMethod: 'google',
  createdUtc: '2026-09-01T08:00:00Z',
  updatedUtc: '2026-09-01T08:00:00Z',
  rowVersion: null,
  roles: [{ id: 'r1', adminAccountId: 'a1', role: 2, assignedUtc: '2026-09-01T08:00:00Z', assignedByAdminId: 'x' }],
};
/** A row from a server that predates the admin-login fields. */
const OLD_SHAPE = {
  id: 'a2',
  ssoSubject: 'oidc|abc',
  email: 'bikash@stylemint.test',
  displayName: 'Bikash Ops',
  state: 1,
  lastLoginUtc: null,
  createdUtc: '2026-09-01T08:00:00Z',
  updatedUtc: '2026-09-01T08:00:00Z',
  rowVersion: null,
  roles: [],
};

function serve(extra: (req: Captured) => ReturnType<Parameters<typeof mockFetch>[0]> = () => undefined) {
  return mockFetch((req) => {
    if (req.method === 'GET' && req.path === '/v1/admin/admins') return { body: { items: [NEW_FIELDS, OLD_SHAPE], totalCount: 2, pageNumber: 1, pageSize: 50, totalPages: 1 } };
    return extra(req);
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

describe('admins list', () => {
  it('shows how each admin signs in and when they last did, tolerating rows without those fields', async () => {
    serve();
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const table = await screen.findByRole('table', { name: 'Admin accounts' });
    expect(within(table).getByRole('columnheader', { name: 'Sign-in methods' })).toBeInTheDocument();
    const [first, second] = within(table).getAllByTestId('table-row');
    expect(first).toHaveTextContent('Google');
    expect(first).toHaveTextContent('Password');
    expect(first).toHaveTextContent('with Google');
    // The older row falls back to what the SSO subject says.
    expect(second).toHaveTextContent('Single sign-on');
  });
});

describe('invite admin', () => {
  async function openDialog() {
    await userEvent.click(await screen.findByRole('button', { name: 'Invite admin' }));
    return screen.findByRole('dialog');
  }

  it('checks the email, name and roles before sending', async () => {
    const { calls } = serve(() => ({ status: 200, body: {} }));
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(within(dialog).getByText('Email is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter their name as colleagues know it')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose at least one role')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/admin/admins/invite')).toHaveLength(0);
  });

  it('sends the invitation after the step-up check and refreshes the list', async () => {
    let attempts = 0;
    const { calls } = serve((req) => {
      if (req.path === '/v1/admin/auth/mfa/totp/verify') return { status: 204 };
      if (req.path === '/v1/admin/admins/invite') {
        attempts += 1;
        return attempts === 1 ? { status: 403, body: { errorCode: 'admin.step_up.required', reason: 'missing' } } : { status: 200, body: { id: 'new' } };
      }
      return undefined;
    });
    // What the StepUpDialog does once the operator enters a code.
    const prompt = vi.fn(async () => {
      await http.post('/v1/admin/auth/mfa/totp/verify', { code: '123456' });
    });
    registerStepUpPrompt(prompt);
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Email/), '  new.admin@stylemint.test ');
    await userEvent.type(within(dialog).getByLabelText(/^Display name/), 'New Admin');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /KYC reviewer/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Support agent/ }));
    const listCallsBefore = calls.filter((c) => c.path === '/v1/admin/admins').length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
    expect(prompt).toHaveBeenCalledTimes(1);
    const invites = calls.filter((c) => c.path === '/v1/admin/admins/invite');
    expect(invites).toHaveLength(2);
    expect(invites[1]!.body).toEqual({ email: 'new.admin@stylemint.test', displayName: 'New Admin', roles: [2, 4] });
    expect(invites[0]!.headers['idempotency-key']).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(calls.filter((c) => c.path === '/v1/admin/admins').length).toBeGreaterThan(listCallsBefore));
  });

  it('keeps the dialog open and says nothing was sent when the step-up is cancelled', async () => {
    const { calls } = serve((req) => (req.path === '/v1/admin/admins/invite' ? { status: 403, body: { errorCode: 'admin.step_up.required' } } : undefined));
    registerStepUpPrompt(async () => Promise.reject(new StepUpCancelled()));
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Email/), 'x@stylemint.test');
    await userEvent.type(within(dialog).getByLabelText(/^Display name/), 'X Person');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Read-only/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cancelled - no invitation was sent.');
    expect(calls.filter((c) => c.path === '/v1/admin/admins/invite')).toHaveLength(1);
  });

  it('shows the invitation link once when the server could not email it', async () => {
    serve((req) =>
      req.path === '/v1/admin/admins/invite'
        ? {
            body: {
              adminAccountId: 'new',
              email: 'new.admin@stylemint.test',
              displayName: 'New Admin',
              roles: [6],
              roleNames: ['Readonly'],
              invitationExpiresUtc: '2026-10-15T10:00:00Z',
              emailDelivered: false,
              invitationUrl: 'https://stylemint.voyageritnepal.com/admin/set-password?token=abcDEF123',
            },
          }
        : undefined,
    );
    registerStepUpPrompt(async () => undefined);
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Email/), 'new.admin@stylemint.test');
    await userEvent.type(within(dialog).getByLabelText(/^Display name/), 'New Admin');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Read-only/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByLabelText('Invitation link')).toHaveValue('https://stylemint.voyageritnepal.com/admin/set-password?token=abcDEF123');
    expect(screen.getByRole('alert')).toHaveTextContent('could not be delivered');
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument());
    // Opening the dialog again starts clean: the link is not kept anywhere.
    await openDialog();
    expect(screen.queryByText(/abcDEF123/)).not.toBeInTheDocument();
  });

  it('says when the server cannot invite yet', async () => {
    serve(() => undefined);
    renderWithProviders(<AdminsPage />, { route: '/admins' });
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Email/), 'x@stylemint.test');
    await userEvent.type(within(dialog).getByLabelText(/^Display name/), 'X Person');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Read-only/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('isn’t available on this server yet');
  });
});
