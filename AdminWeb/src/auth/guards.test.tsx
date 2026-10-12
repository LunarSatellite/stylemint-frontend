import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/App';
import { setConfigForTests } from '@/config';
import { fakeAdminJwt, mockFetch, signInAs, TestProviders } from '@/test/utils';
import { render } from '@testing-library/react';
import { can } from './roles';
import { installSession, resetSessionForTests } from './session';

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <TestProviders route={null}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return router;
}

beforeEach(() => {
  installSession();
  resetSessionForTests();
  setConfigForTests({});
});
afterEach(() => vi.unstubAllGlobals());

describe('role capabilities', () => {
  it('mirror the server: SuperAdmin passes everything, Readonly reads but never writes', () => {
    expect(can(['SuperAdmin'], 'forcePayouts')).toBe(true);
    expect(can(['Readonly'], 'viewKyc')).toBe(true);
    expect(can(['Readonly'], 'decideKyc')).toBe(false);
    expect(can(['KycReviewer'], 'decideKyc')).toBe(true);
    expect(can(['KycReviewer'], 'viewPayouts')).toBe(false);
    expect(can(['PayoutsOps'], 'refund')).toBe(true);
    expect(can(['SupportAgent'], 'viewRiders')).toBe(false);
    expect(can([], 'viewDashboard')).toBe(false);
  });
});

describe('route guards', () => {
  it('sends a signed-out visitor to sign-in and remembers where they were going', async () => {
    const router = renderApp('/payouts?state=5');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/payouts?state=5')}`);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('explains a page the operator’s roles do not open, instead of showing it broken', async () => {
    signInAs(['KycReviewer']);
    mockFetch(() => ({ body: { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0 } }));
    renderApp('/payouts');
    expect(await screen.findByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.getByText(/This page isn’t part of your role/)).toBeInTheDocument();
  });

  it('hides menu entries the roles cannot open', async () => {
    signInAs(['KycReviewer']);
    mockFetch(() => ({ body: { items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0 } }));
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main menu' });
    expect(nav).toHaveTextContent('KYC & applications');
    expect(nav).toHaveTextContent('Riders');
    expect(nav).not.toHaveTextContent('Payouts');
    expect(nav).not.toHaveTextContent('Admins & roles');
  });

  it('shows the waiting-for-access screen to an admin with no role yet', async () => {
    signInAs([]);
    renderApp('/');
    expect(await screen.findByText(/access is pending/)).toBeInTheDocument();
  });
});

describe('sign-in page', () => {
  it('signs in with an access key and lands where the operator was going', async () => {
    const token = fakeAdminJwt(['SupportAgent']);
    const { calls } = mockFetch((req) => {
      if (req.path === '/v1/admin/auth/sso')
        return { body: { accessToken: token, expiresAtUtc: new Date(Date.now() + 3600_000).toISOString(), adminAccountId: 'x', email: 'e', displayName: 'd', roles: [4] } };
      return { body: { items: [], totalCount: 0, pageNumber: 1, pageSize: 50 } };
    });
    const router = renderApp(`/login?next=${encodeURIComponent('/customers')}`);
    await userEvent.type(await screen.findByLabelText('Access key'), 'bootstrap-access-key-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    expect(calls[0]!.body).toEqual({ idToken: 'bootstrap-access-key-123' });
  });

  it('says why a key was refused', async () => {
    mockFetch(() => ({ status: 401, body: { errorCode: 'auth.unauthorized', title: 'Invalid identity token.', status: 401 } }));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Access key'), 'wrong-key-wrong-key-wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/That sign-in was not accepted/)).toBeInTheDocument();
  });

  it('offers single sign-on when an identity provider is configured', async () => {
    setConfigForTests({ sso: { authority: 'https://login.example.com', clientId: 'admin', responseType: 'code', scope: 'openid', providerName: 'Microsoft' } });
    renderApp('/login');
    expect(await screen.findByRole('button', { name: 'Continue with Microsoft' })).toBeInTheDocument();
    // The key form is folded away behind a link.
    expect(screen.getByRole('button', { name: /access key instead/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('explains an expired session', async () => {
    renderApp('/login?reason=expired');
    expect(await screen.findByText(/Your session expired/)).toBeInTheDocument();
  });
});
