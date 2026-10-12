import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The interceptor chain, which is the only place a request becomes
 * correct.
 *
 * Two behaviours are worth pinning because getting either wrong is
 * expensive and silent: a write that goes out without an
 * `Idempotency-Key` can be applied twice, and a 401 routed on status
 * rather than `errorCode` turns a security event into a routine
 * "please log in again".
 */

vi.mock('@/env', () => ({
  env: {
    apiBaseUrl: 'http://api.test',
    ssoAuthority: 'http://sso.test',
    ssoClientId: 'test',
    ssoRedirectUri: 'http://admin.test/sso/callback',
  },
  assertEnv: () => {},
}));

const { api, installSessionRecovery } = await import('./client');
const { useAuth } = await import('@/auth/store');

/** Run the request interceptors the way axios would. */
async function runRequest(config: Record<string, unknown>) {
  const handlers = (api.interceptors.request as unknown as { handlers: { fulfilled: Function }[] })
    .handlers;
  let result = { headers: new (await import('axios')).AxiosHeaders(), ...config };
  for (const h of handlers) if (h) result = await h.fulfilled(result);
  return result;
}

async function runResponseError(error: unknown) {
  const handlers = (api.interceptors.response as unknown as { handlers: { rejected: Function }[] })
    .handlers;
  for (const h of handlers) {
    if (h?.rejected) {
      return h.rejected(error).catch((e: unknown) => e);
    }
  }
  return error;
}

beforeEach(() => {
  useAuth.getState().clear();
});

describe('request interceptor', () => {
  it('puts an Idempotency-Key on every write', async () => {
    for (const method of ['post', 'put', 'patch', 'delete']) {
      const config = await runRequest({ method, url: '/v1/admin/kyc/1/decide' });
      expect(config.headers.get('Idempotency-Key'), method).toBeTruthy();
    }
  });

  it('puts no Idempotency-Key on a read', async () => {
    const config = await runRequest({ method: 'get', url: '/v1/admin/kyc/queue' });
    expect(config.headers.get('Idempotency-Key')).toBeFalsy();
  });

  it('keeps a key the caller set, so a deliberate retry stays the same request', async () => {
    const { AxiosHeaders } = await import('axios');
    const headers = new AxiosHeaders();
    headers.set('Idempotency-Key', 'chosen-by-caller');
    const config = await runRequest({ method: 'post', url: '/x', headers });
    expect(config.headers.get('Idempotency-Key')).toBe('chosen-by-caller');
  });

  it('sends the token, except to the SSO exchange', async () => {
    useAuth.getState().setToken('tok');
    const normal = await runRequest({ method: 'get', url: '/v1/admin/me' });
    expect(normal.headers.get('Authorization')).toBe('Bearer tok');

    const sso = await runRequest({ method: 'post', url: '/v1/admin/auth/sso' });
    expect(sso.headers.get('Authorization')).toBeFalsy();
  });
});

describe('401 routing, by errorCode and not by status', () => {
  function signedOutTo() {
    const seen: string[] = [];
    installSessionRecovery({
      silentRefresh: async () => false,
      redirect: (to) => seen.push(to),
    });
    return seen;
  }

  it('sends a replayed token to the security screen without trying to recover', async () => {
    const redirects = signedOutTo();
    const refresh = vi.fn(async () => true);
    installSessionRecovery({ silentRefresh: refresh, redirect: (to) => redirects.push(to) });

    await runResponseError({
      response: { status: 401, data: { errorCode: 'auth.token_reuse_detected' } },
    });

    expect(redirects).toEqual(['/login?reason=security']);
    // Recovering silently would re-authenticate an account that should
    // be challenged, and hide the event from the person it happened to.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sends a revoked session to its own screen', async () => {
    const redirects = signedOutTo();
    await runResponseError({
      response: { status: 401, data: { errorCode: 'auth.session_revoked' } },
    });
    expect(redirects).toEqual(['/login?reason=revoked']);
  });

  it('tries a silent refresh for an ordinary expiry, and stays signed in when it works', async () => {
    const redirects: string[] = [];
    installSessionRecovery({ silentRefresh: async () => true, redirect: (to) => redirects.push(to) });
    useAuth.getState().setToken('tok');

    await runResponseError({
      response: { status: 401, data: { errorCode: 'auth.token_expired' } },
    });

    expect(redirects).toEqual([]);
    expect(useAuth.getState().token).toBe('tok');
  });

  it('leaves a 403 alone', async () => {
    const redirects = signedOutTo();
    await runResponseError({ response: { status: 403, data: { errorCode: 'auth.forbidden' } } });
    expect(redirects).toEqual([]);
  });
});
