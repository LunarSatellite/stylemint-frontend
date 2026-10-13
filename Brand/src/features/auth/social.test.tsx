import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { __resetSessionForTests, bootstrap, session } from '../../auth/session';
import { ApiError } from '../../api/client';
import { parseWebConfig, socialError } from '../../auth/social';
import { resetThirdPartyForTests, type AppleSignInResponse, type FacebookLoginResponse, type GoogleCredentialResponse } from '../../auth/thirdParty';
import { ACCOUNT_ID, authResponse, mockApi, renderWithProviders, type RecordedCall } from '../../test/utils';

const WEB_CONFIG = 'GET /v1/auth/oauth/web-config';
const ALL = {
  google: { clientId: 'seller-web.apps.googleusercontent.com' },
  apple: { servicesId: 'com.stylemint.seller.web', redirectUri: 'https://stylemint.voyageritnepal.com/seller/login' },
  facebook: { appId: '998877', graphVersion: 'v21.0' },
};

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

function mockApple(result: () => Promise<AppleSignInResponse>) {
  const init = vi.fn();
  const signIn = vi.fn(result);
  (window as unknown as { AppleID: unknown }).AppleID = { auth: { init, signIn } };
  return { init, signIn };
}

function mockFacebook(response: FacebookLoginResponse) {
  const init = vi.fn();
  const login = vi.fn((cb: (r: FacebookLoginResponse) => void) => cb(response));
  (window as unknown as { FB: unknown }).FB = { init, login };
  return { init, login };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const scriptTag = (host: string) => document.head.querySelector(`script[src*="${host}"]`);
const native = (calls: RecordedCall[], provider: string) => calls.filter((c) => c.path === `/v1/auth/oauth/${provider}/native`);

async function startAtLogin() {
  await bootstrap();
  renderWithProviders(<AppRoutes />, { route: '/login' });
  await screen.findByRole('heading', { name: /sign in to your shop/i });
}

async function readyButton(name: RegExp) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

beforeEach(() => {
  __resetSessionForTests();
  resetThirdPartyForTests();
});
afterEach(() => {
  resetThirdPartyForTests();
  document.head.querySelectorAll('script[src^="https://"]').forEach((s) => s.remove());
});

describe('which providers the sign-in page offers', () => {
  it('shows Google, Apple and Facebook above the form, with an "or" divider, when all three are web-ready', async () => {
    const google = mockGoogle();
    const apple = mockApple(() => new Promise(() => {}));
    const facebook = mockFacebook({ status: 'unknown' });
    mockApi({ [WEB_CONFIG]: { body: ALL } });
    await startAtLogin();

    expect(await screen.findByTestId('gsi-button')).toBeInTheDocument();
    expect(google.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'seller-web.apps.googleusercontent.com', ux_mode: 'popup' }));
    expect(google.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ text: 'continue_with', theme: 'outline' }));
    await readyButton(/continue with apple/i);
    expect(apple.init).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'com.stylemint.seller.web', redirectURI: 'https://stylemint.voyageritnepal.com/seller/login', usePopup: true, scope: 'name email' }),
    );
    // Apple gets the SHA-256 of the nonce, never the raw value.
    expect(apple.init.mock.calls[0][0].nonce).toMatch(/^[0-9a-f]{64}$/);
    await readyButton(/continue with facebook/i);
    expect(facebook.init).toHaveBeenCalledWith(expect.objectContaining({ appId: '998877', version: 'v21.0', cookie: false }));
    expect(screen.getByText('or')).toBeInTheDocument();

    // The providers come before the email/phone form.
    const social = screen.getByTestId('social-sign-in');
    const identifier = screen.getByLabelText(/email or phone number/i);
    expect(social.compareDocumentPosition(identifier) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides all three, loads no provider script and keeps the form when the web-config endpoint 404s', async () => {
    const calls = mockApi({});
    await startAtLogin();
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/auth/oauth/web-config')).toBe(true));
    // Let the 404 settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('social-sign-in')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with/i })).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
    expect(scriptTag('accounts.google.com')).toBeNull();
    expect(scriptTag('appleid.cdn-apple.com')).toBeNull();
    expect(scriptTag('connect.facebook.net')).toBeNull();
    expect(screen.getByLabelText(/email or phone number/i)).toBeInTheDocument();
  });

  it('loads only the configured provider’s script, from its own origin', async () => {
    mockApi({ [WEB_CONFIG]: { body: { google: null, apple: ALL.apple, facebook: null } } });
    await startAtLogin();
    await waitFor(() => expect(scriptTag('appleid.cdn-apple.com')).not.toBeNull());
    expect(scriptTag('appleid.cdn-apple.com')!.getAttribute('src')).toBe(
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    );
    expect(scriptTag('accounts.google.com')).toBeNull();
    expect(scriptTag('connect.facebook.net')).toBeNull();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with facebook/i })).not.toBeInTheDocument();
    // Until the script loads, the Apple button says what is coming but cannot be pressed.
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeDisabled();
  });

  it('reads the web-config tolerantly and drops providers missing a public id or switched off', () => {
    expect(parseWebConfig(null)).toEqual({ google: null, apple: null, facebook: null });
    expect(
      parseWebConfig({
        Google: { ClientId: ' cid ' },
        apple: { clientId: 'svc', redirectURI: 'https://x/seller/login' },
        facebook: { appId: '1', webReady: false },
      }),
    ).toEqual({ google: { clientId: 'cid' }, apple: { servicesId: 'svc', redirectUri: 'https://x/seller/login' }, facebook: null });
    // Apple without a redirect URI cannot run its web flow.
    expect(parseWebConfig({ apple: { servicesId: 'svc' } }).apple).toBeNull();
    expect(parseWebConfig({ google: { clientId: '' } }).google).toBeNull();
    expect(parseWebConfig({ facebook: { appId: '1', graphVersion: 'v21.0' } }).facebook).toEqual({ appId: '1', graphVersion: 'v21.0' });
    expect(parseWebConfig({ facebook: { appId: '1', graphVersion: 'latest' } }).facebook).toEqual({ appId: '1', graphVersion: null });
  });

  it('maps the server’s refusals to what the seller should do next', () => {
    const problem = (status: number, title: string, errorCode: string) => new ApiError(status, title, errorCode, { title, status, errorCode });
    expect(socialError(problem(403, 'Account is temporarily locked.', 'auth.forbidden'), 'google')).toMatch(/locked for 30 minutes/);
    expect(socialError(problem(403, 'Account is not active.', 'auth.forbidden'), 'apple')).toMatch(/not active/);
    expect(socialError(problem(403, 'Provider rejected the identity token.', 'auth.forbidden'), 'apple')).toMatch(/Apple could not confirm/);
    expect(socialError(problem(429, 'Too many requests', 'system.rate_limited'), 'facebook')).toMatch(/Too many attempts/);
    expect(socialError(new ApiError(0, 'offline', 'network', null), 'google')).toMatch(/internet connection/);
  });
});

describe('provider token handoff', () => {
  it('Google: posts the ID token to /oauth/google/native and signs the seller in without forcing a password', async () => {
    const google = mockGoogle('google-id-token-abc');
    const calls = mockApi({
      [WEB_CONFIG]: { body: { google: ALL.google } },
      'POST /v1/auth/oauth/google/native': { body: authResponse(['Customer', 'Vendor']) },
    });
    await startAtLogin();
    await userEvent.click(await screen.findByTestId('gsi-button'));

    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    const [call] = native(calls, 'google');
    expect(call.body).toMatchObject({ identityToken: 'google-id-token-abc', devicePlatform: 3 });
    // The raw nonce goes to the server; Google was initialised with its hex SHA-256.
    const raw = (call.body as { nonce: string }).nonce;
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    const hashed = (google.initialize.mock.calls[0][0] as unknown as { nonce: string }).nonce;
    expect(await sha256Hex(raw)).toBe(hashed);
    expect((call.body as { deviceFingerprint: string }).deviceFingerprint).toMatch(/^web-/);
    expect(call.headers.Authorization).toBeUndefined();
    expect(session.getState().signInMethod).toBe('google');
    // No "create your password" step, and no registration-status lookup for it.
    expect(calls.some((c) => c.path.includes('/registration/'))).toBe(false);
    expect(sessionStorage.getItem('sm.seller.rt')).toBe('refresh-1');
    expect(sessionStorage.getItem('sm.seller.needsPassword')).toBeNull();
  });

  it('Apple: posts the identity token, the raw nonce and the first-time name to /oauth/apple/native', async () => {
    const apple = mockApple(() =>
      Promise.resolve({ authorization: { id_token: 'apple-identity-token', code: 'c' }, user: { email: 'shop@privaterelay.appleid.com', name: { firstName: 'Asha', lastName: 'Rai' } } }),
    );
    const calls = mockApi({
      [WEB_CONFIG]: { body: { apple: ALL.apple } },
      'POST /v1/auth/oauth/apple/native': { body: authResponse(['Vendor']) },
    });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with apple/i));

    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    expect(apple.signIn).toHaveBeenCalledTimes(1);
    const body = native(calls, 'apple')[0].body as { identityToken: string; displayName: string; nonce: string };
    expect(body).toMatchObject({ identityToken: 'apple-identity-token', displayName: 'Asha Rai', devicePlatform: 3 });
    // The raw nonce goes to the server; its SHA-256 went to Apple.
    const hashed = apple.init.mock.calls[0][0].nonce as string;
    expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(body.nonce)).toBe(hashed);
  });

  it('Facebook: asks for the email permission and posts the access token to /oauth/facebook/native', async () => {
    const fb = mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb-access-token', userID: '42', grantedScopes: 'email,public_profile' } });
    const calls = mockApi({
      [WEB_CONFIG]: { body: { facebook: ALL.facebook } },
      'POST /v1/auth/oauth/facebook/native': { body: authResponse(['Vendor']) },
    });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with facebook/i));

    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    expect(fb.login).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ scope: 'email', return_scopes: true }));
    expect(native(calls, 'facebook')[0].body).toMatchObject({ identityToken: 'fb-access-token', devicePlatform: 3 });
    expect(session.getState().signInMethod).toBe('facebook');
  });

  it('keeps the session for this device only when "keep me signed in" is ticked', async () => {
    mockGoogle();
    mockApi({
      [WEB_CONFIG]: { body: { google: ALL.google } },
      'POST /v1/auth/oauth/google/native': { body: authResponse(['Vendor']) },
    });
    await startAtLogin();
    await userEvent.click(screen.getByLabelText(/keep me signed in/i));
    await userEvent.click(await screen.findByTestId('gsi-button'));
    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    expect(localStorage.getItem('sm.seller.rt')).toBe('refresh-1');
    expect(sessionStorage.getItem('sm.seller.rt')).toBeNull();
  });
});

describe('a provider account that is not a seller', () => {
  it('lands on "isn’t a seller account" and says to use the phone/email the shop was registered with', async () => {
    mockGoogle();
    mockApi({
      [WEB_CONFIG]: { body: { google: ALL.google } },
      'POST /v1/auth/oauth/google/native': { body: authResponse(['Customer'], { isNewAccount: true }) },
      'GET /v1/vendor/application': { status: 404, body: { title: 'Not found', status: 404, errorCode: 'resource.not_found' } },
    });
    await startAtLogin();
    await userEvent.click(await screen.findByTestId('gsi-button'));

    await waitFor(() => expect(session.getState().status).toBe('notVendor'));
    const block = await screen.findByTestId('not-a-seller');
    expect(block).toHaveTextContent(/isn’t a seller account/i);
    expect(block).toHaveTextContent(/new, empty StyleMint account/i);
    expect(block).toHaveTextContent(/sign in with the phone number or email your shop was registered with/i);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('still shows the application status when the provider account has a pending application', async () => {
    mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb', grantedScopes: 'email' } });
    mockApi({
      [WEB_CONFIG]: { body: { facebook: ALL.facebook } },
      'POST /v1/auth/oauth/facebook/native': { body: authResponse(['Customer']) },
      'GET /v1/vendor/application': {
        body: { id: 'a1', state: 3, brandName: 'Himalaya Knits', legalBusinessName: 'HK', submittedAtUtc: null, expectedDecisionByUtc: null, decisionAtUtc: null, rejectionReason: null, createdUtc: '2026-10-01T00:00:00Z' },
      },
    });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with facebook/i));
    expect(await screen.findByTestId('application-status')).toHaveTextContent(/under review/i);
  });
});

describe('errors', () => {
  it('says so, quietly, when the Apple popup is closed — and posts nothing', async () => {
    mockApple(() => Promise.reject({ error: 'popup_closed_by_user' }));
    const calls = mockApi({ [WEB_CONFIG]: { body: { apple: ALL.apple } } });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with apple/i));
    expect(await screen.findByTestId('login-info')).toHaveTextContent(/apple sign-in was cancelled/i);
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
    expect(native(calls, 'apple')).toHaveLength(0);
    expect(session.getState().status).toBe('signedOut');
  });

  it('says so when the Facebook popup is closed — and posts nothing', async () => {
    mockFacebook({ status: 'unknown', authResponse: null });
    const calls = mockApi({ [WEB_CONFIG]: { body: { facebook: ALL.facebook } } });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with facebook/i));
    expect(await screen.findByTestId('login-info')).toHaveTextContent(/facebook sign-in was cancelled/i);
    expect(native(calls, 'facebook')).toHaveLength(0);
  });

  it('explains a declined Facebook email permission and asks for it again next time', async () => {
    const fb = mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb-access-token', grantedScopes: 'public_profile' } });
    const calls = mockApi({ [WEB_CONFIG]: { body: { facebook: ALL.facebook } } });
    await startAtLogin();
    const button = await readyButton(/continue with facebook/i);
    await userEvent.click(button);
    expect(await screen.findByTestId('login-error')).toHaveTextContent(/needs the email address on your Facebook account/i);
    expect(native(calls, 'facebook')).toHaveLength(0);
    await userEvent.click(button);
    expect(fb.login).toHaveBeenLastCalledWith(expect.any(Function), expect.objectContaining({ auth_type: 'rerequest' }));
  });

  it('explains when the server says the provider shared no email', async () => {
    mockFacebook({ status: 'connected', authResponse: { accessToken: 'fb' } });
    mockApi({
      [WEB_CONFIG]: { body: { facebook: ALL.facebook } },
      'POST /v1/auth/oauth/facebook/native': {
        status: 400,
        body: { title: 'One or more validation errors occurred.', status: 400, errorCode: 'validation.failed', errors: { Email: ['Sign-in provider did not share an email address.'] } },
      },
    });
    await startAtLogin();
    await userEvent.click(await readyButton(/continue with facebook/i));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(/Facebook did not share your email address/i);
  });

  it('explains an email that exists but cannot be linked automatically (409)', async () => {
    mockGoogle();
    mockApi({
      [WEB_CONFIG]: { body: { google: ALL.google } },
      'POST /v1/auth/oauth/google/native': {
        status: 409,
        body: { title: 'An account already uses this email.', status: 409, errorCode: 'state.conflict' },
      },
    });
    await startAtLogin();
    await userEvent.click(await screen.findByTestId('gsi-button'));
    const alert = await screen.findByTestId('login-error');
    expect(alert).toHaveTextContent(/can’t be linked to your StyleMint account automatically/i);
    expect(alert).toHaveTextContent(/phone number or email your shop was registered with/i);
    expect(session.getState().status).toBe('signedOut');
  });

  it('explains a token the server refused, and a provider switched off on the server', async () => {
    mockGoogle();
    let status = 403;
    mockApi({
      [WEB_CONFIG]: { body: { google: ALL.google } },
      'POST /v1/auth/oauth/google/native': () =>
        status === 403
          ? { status, body: { title: 'Provider rejected the identity token.', status, errorCode: 'auth.forbidden' } }
          : { status, body: { title: "Native sign-in is not configured for provider 'Google'.", status, errorCode: 'system.service_unavailable' } },
    });
    await startAtLogin();
    await userEvent.click(await screen.findByTestId('gsi-button'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(/Google could not confirm this sign-in/i);
    status = 503;
    await userEvent.click(screen.getByTestId('gsi-button'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent(/Google sign-in isn’t available right now/i));
  });

  it('says when a provider script cannot load', async () => {
    mockApi({ [WEB_CONFIG]: { body: { facebook: ALL.facebook } } });
    await startAtLogin();
    await waitFor(() => expect(scriptTag('connect.facebook.net')).not.toBeNull());
    scriptTag('connect.facebook.net')!.dispatchEvent(new Event('error'));
    expect(await screen.findByText(/Facebook sign-in could not load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with facebook/i })).toBeDisabled();
  });
});

it('does not force "create your password" after a social sign-in even when the account has none', async () => {
  mockGoogle();
  mockApi({
    [WEB_CONFIG]: { body: { google: ALL.google } },
    'POST /v1/auth/oauth/google/native': { body: authResponse(['Vendor']) },
    [`GET /v1/registration/${ACCOUNT_ID}/status`]: { body: { accountId: ACCOUNT_ID, hasPassword: false } },
  });
  await startAtLogin();
  await userEvent.click(await screen.findByTestId('gsi-button'));
  await waitFor(() => expect(session.getState().status).toBe('signedIn'));
  expect(screen.queryByRole('heading', { name: /create your password/i })).not.toBeInTheDocument();
});
