import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { setConfigForTests } from '@/config';
import { fakeAdminJwt, mockFetch, signInAs } from '@/test/utils';
import { endSession, getSession, getSessionState, installSession, parseClaims, resetSessionForTests, restoreSession, signInWithIdToken, signOut } from './session';

beforeEach(() => {
  installSession();
  resetSessionForTests();
  setConfigForTests({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseClaims', () => {
  it('reads the admin claim names the backend mints', () => {
    const claims = parseClaims(fakeAdminJwt(['KycReviewer', 'Readonly']));
    expect(claims).toMatchObject({
      sub: 'adm_11111111-2222-3333-4444-555555555555',
      adminAccountId: '11111111-2222-3333-4444-555555555555',
      email: 'ops@stylemint.test',
      name: 'Asha Operator',
      roles: ['KycReviewer', 'Readonly'],
    });
  });

  it('treats a single role string as one role, not a list of characters', () => {
    expect(parseClaims(fakeAdminJwt('SuperAdmin'))?.roles).toEqual(['SuperAdmin']);
  });

  it('rejects anything that is not a readable JWT', () => {
    expect(parseClaims('nope')).toBeNull();
    expect(parseClaims('a.b.c')).toBeNull();
    expect(parseClaims(null)).toBeNull();
  });
});

describe('sign-in', () => {
  it('exchanges an identity token at /v1/admin/auth/sso without a bearer and keeps the session for this tab', async () => {
    const token = fakeAdminJwt(['SupportAgent']);
    const { calls } = mockFetch((req) =>
      req.path === '/v1/admin/auth/sso'
        ? { body: { accessToken: token, expiresAtUtc: new Date(Date.now() + 3600_000).toISOString(), adminAccountId: 'x', email: 'e', displayName: 'd', roles: [4] } }
        : undefined,
    );
    const session = await signInWithIdToken('a-long-identity-token-from-the-idp', 'sso');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ idToken: 'a-long-identity-token-from-the-idp' });
    expect(calls[0]!.headers.authorization).toBeUndefined();
    expect(calls[0]!.headers['idempotency-key']).toBeTruthy();
    expect(session.claims.roles).toEqual(['SupportAgent']);
    expect(getSession()?.token).toBe(token);
    // Survives a reload of this tab, and only this tab.
    expect(sessionStorage.getItem('sm.admin.session')).toContain(token);
    expect(localStorage.length).toBe(0);
  });

  it('restores a stored session after a reload, but not an expired one', () => {
    const token = signInAs(['Readonly']);
    resetSessionForTests();
    sessionStorage.setItem('sm.admin.session', JSON.stringify({ token, expiresAt: Date.now() + 600_000, via: 'sso' }));
    expect(restoreSession()?.claims.roles).toEqual(['Readonly']);

    resetSessionForTests();
    sessionStorage.setItem('sm.admin.session', JSON.stringify({ token, expiresAt: Date.now() - 1, via: 'sso' }));
    expect(restoreSession()).toBeNull();
    expect(sessionStorage.getItem('sm.admin.session')).toBeNull();
  });

  it('signs out on the server and clears everything locally', async () => {
    signInAs();
    const { calls } = mockFetch((req) => (req.path === '/v1/admin/auth/logout' ? { body: 1 } : undefined));
    await signOut();
    expect(calls[0]!.path).toBe('/v1/admin/auth/logout');
    expect(calls[0]!.headers.authorization).toMatch(/^Bearer /);
    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem('sm.admin.session')).toBeNull();
  });

  it('still signs out locally when the server cannot be reached', async () => {
    signInAs();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await signOut();
    expect(getSession()).toBeNull();
  });
});

describe('expired and revoked sessions', () => {
  it('sends the bearer token on API calls', async () => {
    const token = signInAs();
    const { calls } = mockFetch(() => ({ body: { ok: true } }));
    await request('/v1/admin/me');
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${token}`);
  });

  it('ends the session as expired when a 401 cannot be recovered (no refresh token exists)', async () => {
    signInAs();
    mockFetch(() => ({ status: 401 }));
    await expect(request('/v1/admin/me')).rejects.toBeInstanceOf(ApiError);
    expect(getSession()).toBeNull();
    expect(getSessionState().ended).toBe('expired');
  });

  it('ends the session as revoked when the server says it was revoked', async () => {
    signInAs();
    mockFetch(() => ({ status: 401, body: { errorCode: 'admin.session.revoked', title: 'Unauthorized', status: 401 } }));
    await expect(request('/v1/admin/me')).rejects.toMatchObject({ code: 'admin.session.revoked' });
    expect(getSessionState().ended).toBe('revoked');
  });

  it('a revoked replay is reported as a security event', async () => {
    signInAs();
    mockFetch(() => ({ status: 401, body: { errorCode: 'auth.token_reuse_detected' } }));
    await expect(request('/v1/admin/me')).rejects.toBeInstanceOf(ApiError);
    expect(getSessionState().ended).toBe('security');
  });

  it('does not end the session on a 403 - that is a role answer, not a session answer', async () => {
    signInAs(['Readonly']);
    mockFetch(() => ({ status: 403, body: { errorCode: 'auth.forbidden', title: 'This endpoint requires one of: SuperAdmin', status: 403 } }));
    const error = await request('/v1/admin/admins').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isForbidden).toBe(true);
    expect(getSession()).not.toBeNull();
  });

  it('ending a session clears it and records why', () => {
    signInAs();
    endSession('signedOut');
    expect(getSession()).toBeNull();
    expect(getSessionState().ended).toBe('signedOut');
  });
});
