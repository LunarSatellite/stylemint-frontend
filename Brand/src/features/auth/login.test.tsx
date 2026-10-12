import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { __resetSessionForTests, session } from '../../auth/session';
import { ACCOUNT_ID, authResponse, mockApi, renderWithProviders } from '../../test/utils';

/**
 * The AppRoutes gate decides where a status lands; the shell's pages are lazy, so a signed-in
 * vendor is asserted through the session status rather than by rendering Home.
 */
describe('Seller Center sign-in', () => {
  beforeEach(() => {
    __resetSessionForTests();
  });

  async function startAtLogin() {
    // Bootstrap with no stored token → signed out → /login renders.
    const { bootstrap } = await import('../../auth/session');
    await bootstrap();
    renderWithProviders(<AppRoutes />, { route: '/login' });
    await screen.findByRole('heading', { name: /sign in to your shop/i });
  }

  it('signs a vendor in with a Nepali phone number and password', async () => {
    const calls = mockApi({ 'POST /v1/auth/login': { body: authResponse(['Customer', 'Vendor']) } });
    await startAtLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or phone number/i), '981-234 5678');
    await user.type(screen.getByLabelText(/^password/i), 'correct horse 42');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    const login = calls.find((c) => c.path === '/v1/auth/login')!;
    expect(login.body).toMatchObject({ identifierType: 2, identifier: '+9779812345678', password: 'correct horse 42', devicePlatform: 3 });
    expect((login.body as { deviceFingerprint: string }).deviceFingerprint).toMatch(/^web-/);
    expect(login.headers['Idempotency-Key']).toBeTruthy();
    // Refresh token kept for this tab only (not "remember me").
    expect(sessionStorage.getItem('sm.seller.rt')).toBe('refresh-1');
    expect(localStorage.getItem('sm.seller.rt')).toBeNull();
  });

  it('shows the server refusal for a wrong password', async () => {
    mockApi({
      'POST /v1/auth/login': {
        status: 403,
        body: { type: 'x', title: 'Invalid credentials.', status: 403, errorCode: 'auth.forbidden', correlationId: 'c' },
      },
    });
    await startAtLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or phone number/i), 'shop@gmail.com');
    await user.type(screen.getByLabelText(/^password/i), 'wrong password 1');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByTestId('login-error')).toHaveTextContent(/do not match/i);
    expect(session.getState().status).toBe('signedOut');
  });

  it('validates the identifier before calling the server', async () => {
    const calls = mockApi({});
    await startAtLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or phone number/i), 'not-an-email@');
    await user.type(screen.getByLabelText(/^password/i), 'whatever12345');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText(/does not look right/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/auth/login')).toHaveLength(0);
  });

  it('signs in with a code, then forces "Create your password" through the authenticated route', async () => {
    const calls = mockApi({
      'POST /v1/auth/login-otp/request': {
        body: { otpId: 'o1', accountId: ACCOUNT_ID, expiresUtc: new Date().toISOString(), devPlaintextCode: null, isNewAccount: false },
      },
      'POST /v1/auth/login-otp/verify': { body: authResponse(['Vendor']) },
      [`GET /v1/registration/${ACCOUNT_ID}/status`]: {
        body: { accountId: ACCOUNT_ID, emailVerified: true, phoneVerified: false, hasPassword: false, hasPasskey: false, termsAccepted: true, isComplete: false },
      },
      [`PUT /v1/accounts/${ACCOUNT_ID}/password`]: { status: 204 },
    });
    await startAtLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with a code/i }));
    await user.type(screen.getByLabelText(/email or phone number/i), 'Shop@Gmail.com');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByRole('heading', { name: /enter your code/i })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/v1/auth/login-otp/request')!.body).toEqual({ identifierType: 1, identifier: 'shop@gmail.com' });

    const first = document.querySelectorAll('form input')[0] as HTMLInputElement;
    await user.click(first);
    await user.keyboard('48213');
    // The fifth digit submits the code by itself.

    await waitFor(() => expect(session.getState().status).toBe('needsPassword'));
    expect(calls.find((c) => c.path === '/v1/auth/login-otp/verify')!.body).toMatchObject({ code: '48213', identifierType: 1 });

    // The gate sends the seller to the mandatory password step.
    expect(await screen.findByRole('heading', { name: /create your password/i })).toBeInTheDocument();
    const rules = screen.getByTestId('password-rules');
    expect(rules).toHaveTextContent(/12–128 characters/);

    await user.type(screen.getByLabelText(/^new password/i), 'short1');
    await user.type(screen.getByLabelText(/confirm password/i), 'short1');
    await user.click(screen.getByRole('button', { name: /save password/i }));
    expect(await screen.findByText(/does not meet all the rules/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    await user.clear(screen.getByLabelText(/^new password/i));
    await user.clear(screen.getByLabelText(/confirm password/i));
    await user.type(screen.getByLabelText(/^new password/i), 'himalaya-shop-2026');
    await user.type(screen.getByLabelText(/confirm password/i), 'himalaya-shop-2026');
    await user.click(screen.getByRole('button', { name: /save password/i }));

    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe(`/v1/accounts/${ACCOUNT_ID}/password`);
    expect(put.body).toEqual({ newPassword: 'himalaya-shop-2026' });
    expect(put.headers.Authorization).toMatch(/^Bearer /);
    expect(put.headers['Idempotency-Key']).toBeTruthy();
    // Never the anonymous registration route.
    expect(calls.some((c) => c.path.includes('/set-password'))).toBe(false);
  });

  it('skips the password step when the account already has one', async () => {
    mockApi({
      'POST /v1/auth/login-otp/request': {
        body: { otpId: 'o1', accountId: ACCOUNT_ID, expiresUtc: new Date().toISOString(), devPlaintextCode: null, isNewAccount: false },
      },
      'POST /v1/auth/login-otp/verify': { body: authResponse(['Vendor']) },
      [`GET /v1/registration/${ACCOUNT_ID}/status`]: { body: { accountId: ACCOUNT_ID, hasPassword: true } },
    });
    await startAtLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with a code/i }));
    await user.type(screen.getByLabelText(/email or phone number/i), '9801234567');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByRole('heading', { name: /enter your code/i });
    const first = document.querySelectorAll('form input')[0] as HTMLInputElement;
    await user.click(first);
    await user.keyboard('12345');
    // The fifth digit submits the code by itself.
    await waitFor(() => expect(session.getState().status).toBe('signedIn'));
  });

  it('turns away an account without the Vendor role', async () => {
    mockApi({
      'POST /v1/auth/login': { body: authResponse(['Customer']) },
      'GET /v1/vendor/application': {
        status: 404,
        body: { title: 'Not found', status: 404, errorCode: 'resource.not_found' },
      },
    });
    await startAtLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or phone number/i), 'buyer@gmail.com');
    await user.type(screen.getByLabelText(/^password/i), 'buyer-password-1');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(session.getState().status).toBe('notVendor'));
    expect(await screen.findByTestId('not-a-seller')).toHaveTextContent(/isn’t a seller account/i);
  });

  it('shows the application status to an applicant who is not approved yet', async () => {
    mockApi({
      'POST /v1/auth/login': { body: authResponse(['Customer']) },
      'GET /v1/vendor/application': {
        body: {
          id: 'a1',
          state: 3,
          brandName: 'Himalaya Knits',
          legalBusinessName: 'Himalaya Knits Pvt Ltd',
          submittedAtUtc: '2026-10-01T10:00:00Z',
          expectedDecisionByUtc: '2026-10-15T10:00:00Z',
          decisionAtUtc: null,
          rejectionReason: null,
          createdUtc: '2026-09-30T10:00:00Z',
        },
      },
    });
    await startAtLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or phone number/i), 'knits@gmail.com');
    await user.type(screen.getByLabelText(/^password/i), 'knits-password-1');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    const status = await screen.findByTestId('application-status');
    expect(status).toHaveTextContent(/under review/i);
    expect(status).toHaveTextContent(/Himalaya Knits/);
  });
});
