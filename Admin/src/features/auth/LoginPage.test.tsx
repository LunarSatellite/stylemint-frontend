import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/App';
import { setConfigForTests } from '@/config';
import { getSession, installSession, resetSessionForTests } from '@/auth/session';
import { resetThirdPartyForTests, type FacebookLoginResponse, type GoogleCredentialResponse } from '@/auth/thirdParty';
import { fakeAdminJwt, mockFetch, TestProviders, type Captured } from '@/test/utils';
import { RESET_SENT_MESSAGE } from './LoginPage';

const METHODS = '/v1/admin/auth/methods';
const ALL_METHODS = { google: { clientId: 'admin-console.apps.googleusercontent.com' }, facebook: { appId: '998877' }, password: true };
const PASSWORD_ONLY = { google: null, facebook: null, password: true };

function loginBody(roles: string[] = ['SupportAgent']) {
  return { accessToken: fakeAdminJwt(roles), expiresAtUtc: new Date(Date.now() + 3600_000).toISOString(), adminAccountId: 'x', email: 'ops@stylemint.test', displayName: 'Asha', roles: [4] };
}

const emptyList = { body: { items: [], totalCount: 0, pageNumber: 1, pageSize: 50 } };

/** Answers `/methods` with `methods` and everything else with `rest` (or an empty list). */
function serve(methods: unknown, rest: (req: Captured) => ReturnType<Parameters<typeof mockFetch>[0]> = () => emptyList) {
  return mockFetch((req) => (req.path === METHODS ? { body: methods } : rest(req)));
}

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <TestProviders route={null}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return router;
}

/** Google Identity Services, as far as the page uses it: initialize() keeps the callback, renderButton() draws a button. */
function mockGoogle(credential = 'google-id-token') {
  let callback: ((r: GoogleCredentialResponse) => void) | null = null;
  const initialize = vi.fn((config: { client_id: string; callback: (r: GoogleCredentialResponse) => void }) => {
    callback = config.callback;
  });
  const renderButton = vi.fn((parent: HTMLElement) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue with Google';
    button.dataset.testid = 'gsi-button';
    button.addEventListener('click', () => callback?.({ credential, select_by: 'btn' }));
    parent.appendChild(button);
  });
  (window as unknown as { google: unknown }).google = { accounts: { id: { initialize, renderButton } } };
  return { initialize, renderButton };
}

function mockFacebook(response: FacebookLoginResponse) {
  const init = vi.fn();
  const login = vi.fn((cb: (r: FacebookLoginResponse) => void) => cb(response));
  (window as unknown as { FB: unknown }).FB = { init, login };
  return { init, login };
}

const scriptTag = (host: string) => document.head.querySelector(`script[src*="${host}"]`);

beforeEach(() => {
  installSession();
  resetSessionForTests();
  setConfigForTests({});
  resetThirdPartyForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetThirdPartyForTests();
  document.head.querySelectorAll('script[src^="https://"]').forEach((s) => s.remove());
});

describe('what the sign-in page offers', () => {
  it('shows Google, Facebook and email + password when the server has all three', async () => {
    const google = mockGoogle();
    const facebook = mockFacebook({ status: 'unknown' });
    serve(ALL_METHODS);
    renderApp('/login');
    expect(await screen.findByTestId('gsi-button')).toBeInTheDocument();
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'admin-console.apps.googleusercontent.com', ux_mode: 'popup' }));
    expect(google.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ text: 'continue_with' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Facebook' })).toBeEnabled());
    expect(facebook.init).toHaveBeenCalledWith(expect.objectContaining({ appId: '998877', cookie: false }));
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument();
    // Nothing else is configured, so there is nothing "other" to offer.
    expect(screen.queryByRole('button', { name: /Other ways to sign in/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Access key')).not.toBeInTheDocument();
  });

  it('hides the providers the server reports as null and never loads their scripts', async () => {
    serve(PASSWORD_ONLY);
    renderApp('/login');
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with Facebook' })).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
    expect(scriptTag('accounts.google.com')).toBeNull();
    expect(scriptTag('connect.facebook.net')).toBeNull();
  });

  it('loads the provider scripts from their own origins only when a provider is configured', async () => {
    serve({ google: { clientId: 'cid' }, facebook: null, password: true });
    renderApp('/login');
    await waitFor(() => expect(scriptTag('accounts.google.com')).not.toBeNull());
    expect(scriptTag('accounts.google.com')!.getAttribute('src')).toBe('https://accounts.google.com/gsi/client');
    expect(scriptTag('connect.facebook.net')).toBeNull();
    // Until the script loads, a placeholder says what is coming.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('keeps single sign-on and the access key behind "Other ways to sign in", only when configured', async () => {
    setConfigForTests({ sso: { authority: 'https://login.example.com', clientId: 'admin', responseType: 'code', scope: 'openid', providerName: 'Microsoft' }, accessKey: true });
    serve(PASSWORD_ONLY);
    renderApp('/login');
    const toggle = await screen.findByRole('button', { name: /Other ways to sign in/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Continue with Microsoft' })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('button', { name: 'Continue with Microsoft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /access key instead/ })).toBeInTheDocument();
  });

  it('follows the server on single sign-on and the access key when it reports them', async () => {
    setConfigForTests({ sso: { authority: 'https://login.example.com', clientId: 'admin', responseType: 'code', scope: 'openid', providerName: 'Microsoft' }, accessKey: true });
    serve({ ...PASSWORD_ONLY, sso: false, accessKey: false });
    renderApp('/login');
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Other ways to sign in/ })).not.toBeInTheDocument();
  });

  it('offers the access key when the server says it is configured', async () => {
    serve({ ...PASSWORD_ONLY, sso: false, accessKey: true });
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: /Other ways to sign in/ }));
    expect(await screen.findByLabelText('Access key')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue with/ })).not.toBeInTheDocument();
  });

  it('still offers email + password when the options cannot be loaded', async () => {
    mockFetch(() => ({ status: 500, body: { errorCode: 'system.internal_error' } }));
    renderApp('/login');
    expect(await screen.findByText(/sign-in options could not be loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});

describe('email + password', () => {
  it('signs in and lands where the operator was going', async () => {
    const { calls } = serve(PASSWORD_ONLY, (req) => (req.path === '/v1/admin/auth/password' ? { body: loginBody() } : emptyList));
    const router = renderApp(`/login?next=${encodeURIComponent('/customers')}`);
    await userEvent.type(await screen.findByLabelText('Email'), ' ops@stylemint.test ');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse 42');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    const sent = calls.find((c) => c.path === '/v1/admin/auth/password')!;
    expect(sent.method).toBe('POST');
    expect(sent.body).toEqual({ email: 'ops@stylemint.test', password: 'correct horse 42' });
    expect(sent.headers.authorization).toBeUndefined();
    expect(getSession()?.via).toBe('password');
  });

  it('checks the fields before sending anything', async () => {
    const { calls } = serve(PASSWORD_ONLY);
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/admin/auth/password')).toHaveLength(0);
  });

  it('says the email and password do not match, without saying which', async () => {
    serve(PASSWORD_ONLY, () => ({ status: 401, body: { errorCode: 'admin_auth.invalid_credentials', title: 'Invalid credentials.', status: 401 } }));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'ops@stylemint.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password 1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That email and password don’t match an admin account');
    expect(getSession()).toBeNull();
    // The password is not left in the field after a refusal.
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('explains a lockout and when to try again', async () => {
    serve(PASSWORD_ONLY, () => ({ status: 429, body: { errorCode: 'admin_auth.locked', title: 'Locked.', status: 429 }, headers: { 'Retry-After': '600' } }));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'ops@stylemint.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong password 6');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('sign-in is locked for 15 minutes');
    expect(alert).toHaveTextContent('Try again in about 10 minutes');
  });

  it('says when password sign-in is not set up on the server', async () => {
    serve(PASSWORD_ONLY, () => ({ status: 503, body: { errorCode: 'admin_auth.method_unavailable', status: 503 } }));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'ops@stylemint.test');
    await userEvent.type(screen.getByLabelText('Password'), 'some password 1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email and password sign-in isn’t set up on the server right now');
  });
});

describe('forgot password', () => {
  it('requests a reset link and gives the same answer whatever the address', async () => {
    const { calls } = serve(PASSWORD_ONLY, (req) => (req.path === '/v1/admin/auth/password/reset-request' ? { status: 204 } : emptyList));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'someone@stylemint.test');
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    // The address typed on the sign-in form is carried over.
    expect(screen.getByLabelText('Email')).toHaveValue('someone@stylemint.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(RESET_SENT_MESSAGE)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/admin/auth/password/reset-request')!.body).toEqual({ email: 'someone@stylemint.test' });
    await userEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('does not reveal anything when the server refuses the request', async () => {
    serve(PASSWORD_ONLY, (req) => (req.path === '/v1/admin/auth/password/reset-request' ? { status: 429, body: { errorCode: 'admin.rate_limited' } } : emptyList));
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(RESET_SENT_MESSAGE)).toBeInTheDocument();
  });

  it('says so when the request never reached the server', async () => {
    serve(PASSWORD_ONLY, (req) => (req.path === '/v1/admin/auth/password/reset-request' ? { status: 502 } : emptyList));
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    await userEvent.type(screen.getByLabelText('Email'), 'ops@stylemint.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent right now');
    expect(screen.queryByText(RESET_SENT_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('Google', () => {
  it('hands the Google ID token to the server and signs in', async () => {
    mockGoogle('google-id-token-abc');
    const { calls } = serve({ ...PASSWORD_ONLY, google: { clientId: 'cid' } }, (req) => (req.path === '/v1/admin/auth/google' ? { body: loginBody() } : emptyList));
    const router = renderApp(`/login?next=${encodeURIComponent('/customers')}`);
    await userEvent.click(await screen.findByTestId('gsi-button'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    expect(calls.find((c) => c.path === '/v1/admin/auth/google')!.body).toEqual({ idToken: 'google-id-token-abc' });
    expect(getSession()?.via).toBe('google');
  });

  it('says a Google account that is not an admin cannot sign in', async () => {
    mockGoogle();
    serve({ ...PASSWORD_ONLY, google: { clientId: 'cid' } }, () => ({ status: 401, body: { errorCode: 'admin_auth.invalid_credentials' } }));
    renderApp('/login');
    await userEvent.click(await screen.findByTestId('gsi-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('That Google account can’t sign in here');
  });

  it('says when Google sign-in is not configured on the server', async () => {
    mockGoogle();
    serve({ ...PASSWORD_ONLY, google: { clientId: 'cid' } }, () => ({ status: 503, body: { errorCode: 'admin_auth.method_unavailable' } }));
    renderApp('/login');
    await userEvent.click(await screen.findByTestId('gsi-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in isn’t set up on the server right now');
  });
});

describe('Facebook', () => {
  it('hands the Facebook access token to the server and signs in', async () => {
    const fb = mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb-access-token', userID: '42', grantedScopes: 'email,public_profile' } });
    const { calls } = serve({ ...PASSWORD_ONLY, facebook: { appId: '998877' } }, (req) => (req.path === '/v1/admin/auth/facebook' ? { body: loginBody() } : emptyList));
    const router = renderApp(`/login?next=${encodeURIComponent('/customers')}`);
    const button = await screen.findByRole('button', { name: 'Continue with Facebook' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    expect(fb.login).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ scope: 'email', return_scopes: true }));
    expect(calls.find((c) => c.path === '/v1/admin/auth/facebook')!.body).toEqual({ accessToken: 'fb-access-token' });
    expect(getSession()?.via).toBe('facebook');
  });

  it('does nothing when the operator closes the Facebook popup', async () => {
    mockFacebook({ status: 'unknown', authResponse: null });
    const { calls } = serve({ ...PASSWORD_ONLY, facebook: { appId: '998877' } });
    renderApp('/login');
    const button = await screen.findByRole('button', { name: 'Continue with Facebook' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(calls.filter((c) => c.path === '/v1/admin/auth/facebook')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks again for the email permission when it was declined', async () => {
    const fb = mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb-access-token', grantedScopes: 'public_profile' } });
    const { calls } = serve({ ...PASSWORD_ONLY, facebook: { appId: '998877' } });
    renderApp('/login');
    const button = await screen.findByRole('button', { name: 'Continue with Facebook' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('needs the email address on your Facebook account');
    expect(calls.filter((c) => c.path === '/v1/admin/auth/facebook')).toHaveLength(0);
    await userEvent.click(button);
    expect(fb.login).toHaveBeenLastCalledWith(expect.any(Function), expect.objectContaining({ auth_type: 'rerequest' }));
  });
});
