import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/App';
import { passwordRules } from '@/api/adminAuth';
import { setConfigForTests } from '@/config';
import { installSession, resetSessionForTests } from '@/auth/session';
import { mockFetch, TestProviders } from '@/test/utils';

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <TestProviders route={null}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return router;
}

const rule = (label: string) => screen.getByText(label).closest('li')!;

beforeEach(() => {
  installSession();
  resetSessionForTests();
  setConfigForTests({});
});
afterEach(() => vi.unstubAllGlobals());

describe('password rules', () => {
  it('mirror the server policy: 12+ characters, a letter and a digit, typed the same twice', () => {
    const met = (p: string, c = p) => passwordRules(p, c).filter((r) => r.met).map((r) => r.id);
    expect(met('short1')).toEqual(['letter', 'digit', 'match']);
    expect(met('abcdefghijkl')).toEqual(['length', 'letter', 'match']);
    expect(met('123456789012')).toEqual(['length', 'digit', 'match']);
    expect(met('long enough 42', 'long enough 43')).toEqual(['length', 'letter', 'digit']);
    expect(met('')).toEqual([]);
  });
});

describe('set-password page', () => {
  it('shows the rules live as the password is typed', async () => {
    mockFetch(() => undefined);
    renderApp('/set-password?token=tok-123');
    const password = await screen.findByLabelText('New password');
    expect(rule('At least 12 characters')).toHaveAttribute('data-met', 'false');
    await userEvent.type(password, 'abc');
    expect(rule('At least one letter')).toHaveAttribute('data-met', 'true');
    expect(rule('At least one number')).toHaveAttribute('data-met', 'false');
    await userEvent.type(password, 'defghij 9');
    expect(rule('At least 12 characters')).toHaveAttribute('data-met', 'true');
    expect(rule('At least one number')).toHaveAttribute('data-met', 'true');
    expect(rule('Both entries match')).toHaveAttribute('data-met', 'false');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'abcdefghij 9');
    expect(rule('Both entries match')).toHaveAttribute('data-met', 'true');
  });

  it('does not send a password that breaks a rule', async () => {
    const { calls } = mockFetch(() => ({ status: 204 }));
    renderApp('/set-password?token=tok-123');
    await userEvent.type(await screen.findByLabelText('New password'), 'tooshort1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'tooshort1');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText(/doesn’t meet every rule/)).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/admin/auth/password/set')).toHaveLength(0);
  });

  it('sets the password with the token from the link, then offers sign-in', async () => {
    const { calls } = mockFetch((req) => (req.path === '/v1/admin/auth/password/set' ? { status: 204 } : undefined));
    const router = renderApp('/set-password?token=tok-123');
    await userEvent.type(await screen.findByLabelText('New password'), 'a good password 2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a good password 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Your password is set')).toBeInTheDocument();
    const sent = calls.find((c) => c.path === '/v1/admin/auth/password/set')!;
    expect(sent.method).toBe('POST');
    expect(sent.body).toEqual({ token: 'tok-123', password: 'a good password 2026' });
    expect(sent.headers.authorization).toBeUndefined();
    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('explains an expired or used link', async () => {
    mockFetch((req) => (req.path === '/v1/admin/auth/password/set' ? { status: 400, body: { errorCode: 'admin_auth.token_invalid', title: 'Invalid token.' } } : undefined));
    renderApp('/set-password?token=used-token');
    await userEvent.type(await screen.findByLabelText('New password'), 'a good password 2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a good password 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired or has already been used');
  });

  it('shows the server’s reason when it refuses the password', async () => {
    mockFetch((req) =>
      req.path === '/v1/admin/auth/password/set' ? { status: 400, body: { errorCode: 'admin_auth.password_policy', title: 'The password must be at most 128 characters.' } } : undefined,
    );
    renderApp('/set-password?token=tok-123');
    await userEvent.type(await screen.findByLabelText('New password'), 'a good password 2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a good password 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 128 characters');
  });

  it('says a link without a token is incomplete', async () => {
    mockFetch(() => undefined);
    renderApp('/set-password');
    expect(await screen.findByText(/This link is incomplete/)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('is reachable without signing in', async () => {
    mockFetch(() => undefined);
    const router = renderApp('/set-password?token=t');
    expect(await screen.findByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/set-password');
  });
});
