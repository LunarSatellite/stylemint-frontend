import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSession, resetSessionForTests } from '@/auth/session';
import { registerStepUpPrompt, StepUpCancelled, withStepUp } from '@/auth/stepUp';
import { mockFetch, signInAs } from '@/test/utils';
import { buildUrl, http } from './client';
import { ApiError, parseErrorBody } from './errors';
import { toPage } from './paging';

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  registerStepUpPrompt(null);
});

describe('requests', () => {
  it('builds query strings, repeating arrays and dropping empty values', () => {
    expect(buildUrl('/v1/admin/support/tickets', { state: [1, 3], skip: 0, take: 20, q: '', x: undefined })).toBe('/v1/admin/support/tickets?state=1&state=3&skip=0&take=20');
  });

  it('puts a fresh Idempotency-Key on every write and none on reads', async () => {
    signInAs();
    const { calls } = mockFetch(() => ({ body: {} }));
    await http.get('/v1/admin/me');
    await http.post('/v1/admin/couriers/x/suspend', { reason: 'r' });
    await http.post('/v1/admin/couriers/x/suspend', { reason: 'r' });
    expect(calls[0]!.headers['idempotency-key']).toBeUndefined();
    expect(calls[1]!.headers['idempotency-key']).toBeTruthy();
    expect(calls[1]!.headers['idempotency-key']).not.toBe(calls[2]!.headers['idempotency-key']);
    expect(calls[1]!.headers['content-type']).toBe('application/json');
  });

  it('turns an unreachable server into an offline error, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const error = await http.get('/v1/admin/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isOffline).toBe(true);
  });

  it('treats an HTML page where JSON was expected as an error, not data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{<html>', { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(http.get('/v1/admin/me')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('error envelopes', () => {
  it('reads StyleMint’s ErrorResponseVm, with the sentence in title and field errors in an array', () => {
    const e = parseErrorBody(400, {
      type: 'https://stylemint.dev/errors/validation.multiple_errors',
      title: 'Validation failed.',
      status: 400,
      errorCode: 'validation.multiple_errors',
      correlationId: 'corr-1',
      errors: [{ field: 'DecisionReasonCode', code: 'NotEmptyValidator', message: 'A reason code is required.' }],
    });
    expect(e.code).toBe('validation.multiple_errors');
    expect(e.correlationId).toBe('corr-1');
    expect(e.fieldErrors).toEqual({ DecisionReasonCode: ['A reason code is required.'] });
    expect(e.message).toContain('A reason code is required.');
  });

  it('reads ASP.NET’s ValidationProblemDetails, which has no errorCode', () => {
    const e = parseErrorBody(400, { title: 'One or more validation errors occurred.', status: 400, errors: { '$.decision': ['The JSON value could not be converted.'] }, traceId: 't-1' });
    expect(e.code).toBeUndefined();
    expect(e.correlationId).toBe('t-1');
    expect(e.message).toContain('could not be converted');
  });

  it('reads the PascalCase body the exception handler writes', () => {
    const e = parseErrorBody(500, { Type: 'x', Title: 'Something broke.', Status: 500, ErrorCode: 'system.internal_error', CorrelationId: 'c-9' });
    expect(e.code).toBe('system.internal_error');
    expect(e.correlationId).toBe('c-9');
  });

  it('tells a step-up challenge apart from a role refusal', () => {
    const stepUp = parseErrorBody(403, { errorCode: 'admin.step_up.required', title: 'Step-up MFA required for this operation.', reason: 'missing' });
    const role = parseErrorBody(403, { errorCode: 'auth.forbidden', title: 'This endpoint requires one of: SuperAdmin' });
    expect(stepUp.isStepUp).toBe(true);
    expect(stepUp.isForbidden).toBe(false);
    expect(role.isStepUp).toBe(false);
    expect(role.isForbidden).toBe(true);
  });

  it('a bare 404 is a missing endpoint; a coded 404 is a missing record', () => {
    expect(parseErrorBody(404, undefined).isMissingEndpoint).toBe(true);
    expect(parseErrorBody(404, { errorCode: 'resource.not_found', title: 'Not found' }).isMissingEndpoint).toBe(false);
  });
});

describe('step-up', () => {
  it('asks for a code once, verifies it, and replays the write', async () => {
    signInAs();
    let attempts = 0;
    const { calls } = mockFetch((req) => {
      if (req.path === '/v1/admin/auth/mfa/totp/verify') return { status: 204 };
      if (req.path.endsWith('/disable')) {
        attempts += 1;
        return attempts === 1 ? { status: 403, body: { errorCode: 'admin.step_up.required', reason: 'missing' } } : { status: 204 };
      }
      return undefined;
    });
    const prompt = vi.fn(async () => {
      await http.post('/v1/admin/auth/mfa/totp/verify', { code: '123456' });
    });
    registerStepUpPrompt(prompt);
    await withStepUp(() => http.post('/v1/admin/admins/abc/disable'));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.path)).toEqual(['/v1/admin/admins/abc/disable', '/v1/admin/auth/mfa/totp/verify', '/v1/admin/admins/abc/disable']);
  });

  it('does not send the write again when the operator cancels', async () => {
    signInAs();
    const { calls } = mockFetch(() => ({ status: 403, body: { errorCode: 'admin.step_up.required' } }));
    registerStepUpPrompt(async () => Promise.reject(new StepUpCancelled()));
    await expect(withStepUp(() => http.post('/v1/admin/admins/abc/enable'))).rejects.toMatchObject({ code: 'mfa.step_up_cancelled' });
    expect(calls).toHaveLength(1);
  });

  it('passes other errors straight through without prompting', async () => {
    signInAs();
    mockFetch(() => ({ status: 409, body: { errorCode: 'state.invalid_transition', title: 'Cannot go from Paid to Held.' } }));
    const prompt = vi.fn();
    registerStepUpPrompt(prompt);
    await expect(withStepUp(() => http.post('/v1/admin/payouts/p/hold', { reason: 'x' }))).rejects.toMatchObject({ code: 'state.invalid_transition' });
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('paging shapes', () => {
  it('normalises PagedList', () => {
    const p = toPage({ items: [1, 2], totalCount: 52, pageNumber: 2, pageSize: 25, totalPages: 3, hasNext: true }, 1, 25);
    expect(p).toMatchObject({ items: [1, 2], total: 52, page: 2, pageSize: 25, hasMore: true });
  });
  it('normalises a cursor PagedResult', () => {
    const p = toPage({ items: [1], totalCount: 9, nextCursor: 'abc', pageSize: 1, hasMore: true }, 3, 1);
    expect(p).toMatchObject({ total: 9, page: 3, hasMore: true, nextCursor: 'abc' });
  });
  it('normalises a skip/take envelope', () => {
    const p = toPage({ items: [1, 2, 3], totalCount: 30, skip: 10, take: 10 }, 2, 10);
    expect(p).toMatchObject({ total: 30, page: 2, pageSize: 10 });
  });
  it('a full bare array may have more; a short one does not', () => {
    expect(toPage([1, 2], 1, 2).hasMore).toBe(true);
    expect(toPage([1], 1, 2).hasMore).toBe(false);
    expect(toPage([1], 1, 2).total).toBeUndefined();
  });
});
