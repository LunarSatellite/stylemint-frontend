import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests, establish, session } from '../auth/session';
import { ACCOUNT_ID, authResponse, mockApi } from '../test/utils';
import { api, ApiError } from './client';

describe('HTTP client and token refresh', () => {
  beforeEach(() => __resetSessionForTests());

  it('turns StyleMint errors into ApiError with the errorCode and the title as message', async () => {
    mockApi({
      'POST /v1/vendor/sub-orders/x/accept': {
        status: 409,
        body: { type: 't', title: 'Cannot transition SubOrder from Cancelled to Accepted.', status: 409, errorCode: 'state.invalid_transition', correlationId: 'c' },
      },
    });
    const err = await api.post<never>('/v1/vendor/sub-orders/x/accept').catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('state.invalid_transition');
    expect(err.message).toMatch(/cannot transition/i);
  });

  it('uses the first validation message when the title is generic', async () => {
    mockApi({
      'POST /v1/x': {
        status: 400,
        body: {
          title: 'One or more validation errors occurred.',
          status: 400,
          errorCode: 'validation.multiple_errors',
          errors: [{ field: 'Name', code: 'NotEmptyValidator', message: "'Name' must not be empty." }],
        },
      },
    });
    const err = await api.post<never>('/v1/x').catch((e: unknown) => e as ApiError);
    expect(err.message).toBe("'Name' must not be empty.");
    expect(err.fieldErrors).toEqual({ name: "'Name' must not be empty." });
  });

  it('refreshes once on 401, rotates the refresh token, and retries', async () => {
    let first = true;
    const calls = mockApi({
      'POST /v1/auth/login': { body: authResponse(['Vendor']) },
      'GET /v1/vendor/sub-orders': (c) => {
        if (first) {
          first = false;
          return { status: 401 };
        }
        return c.headers.Authorization?.includes('.') ? { body: { items: [], totalCount: 0, nextCursor: null, hasMore: false } } : { status: 401 };
      },
      'POST /v1/auth/refresh': () => ({ body: authResponse(['Vendor'], { refreshToken: 'refresh-2' }) }),
    });
    await establish(authResponse(['Vendor']), { remember: false, checkPassword: false });
    const page = await api.get<{ totalCount: number }>('/v1/vendor/sub-orders');
    expect(page.totalCount).toBe(0);
    expect(calls.filter((c) => c.path === '/v1/auth/refresh')).toHaveLength(1);
    expect(calls.find((c) => c.path === '/v1/auth/refresh')!.body).toEqual({ refreshToken: 'refresh-1' });
    expect(sessionStorage.getItem('sm.seller.rt')).toBe('refresh-2');
    expect(session.getState().status).toBe('signedIn');
  });

  it('runs one refresh for many parallel 401s (the backend kills a reused token)', async () => {
    let refreshed = false;
    const calls = mockApi({
      'GET /v1/a': () => (refreshed ? { body: { ok: true } } : { status: 401 }),
      'POST /v1/auth/refresh': () => {
        refreshed = true;
        return { body: authResponse(['Vendor'], { refreshToken: 'refresh-2' }) };
      },
    });
    await establish(authResponse(['Vendor']), { remember: true, checkPassword: false });
    await Promise.all([api.get('/v1/a'), api.get('/v1/a'), api.get('/v1/a')]);
    expect(calls.filter((c) => c.path === '/v1/auth/refresh')).toHaveLength(1);
    expect(localStorage.getItem('sm.seller.rt')).toBe('refresh-2');
  });

  it('a refused refresh signs the seller out', async () => {
    mockApi({
      'GET /v1/a': { status: 401 },
      'POST /v1/auth/refresh': { status: 400, body: { title: 'Token reuse detected', status: 400, errorCode: 'auth.token_reuse_detected' } },
    });
    await establish(authResponse(['Vendor']), { remember: false, checkPassword: false });
    await expect(api.get('/v1/a')).rejects.toBeInstanceOf(ApiError);
    expect(session.getState().status).toBe('signedOut');
    expect(sessionStorage.getItem('sm.seller.rt')).toBeNull();
  });

  it('a server error during refresh keeps the session', async () => {
    mockApi({
      'GET /v1/a': { status: 401 },
      'POST /v1/auth/refresh': { status: 503, body: { title: 'Unavailable', status: 503, errorCode: 'system.service_unavailable' } },
    });
    await establish(authResponse(['Vendor']), { remember: false, checkPassword: false });
    await expect(api.get('/v1/a')).rejects.toBeInstanceOf(ApiError);
    expect(session.getState().status).toBe('signedIn');
    expect(session.getState().accountId).toBe(ACCOUNT_ID);
  });
});
