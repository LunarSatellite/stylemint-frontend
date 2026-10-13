import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { mockApi } from '../../test/utils';
import { crm } from './client';
import { EMAIL_MASK, PHONE_MASK, redactPii } from './redact';
import { crmSession, resetCrmSession } from './session';
import { CRM, envelope, SESSION, sessionBody } from './testkit';

describe('CRM session', () => {
  beforeEach(() => resetCrmSession());
  afterEach(() => {
    resetCrmSession();
    vi.useRealTimers();
  });

  it('exchanges the StyleMint session for a CRM token and calls the CRM with it', async () => {
    const calls = mockApi({
      [SESSION]: { body: sessionBody('Admin') },
      [`GET ${CRM}/seller/me`]: envelope({ tenantId: 'tenant-1', customerCount: 12 }),
    });
    const me = await crm.get<{ customerCount: number }>('/seller/me');
    expect(me.customerCount).toBe(12);
    expect(crmSession.getState()).toMatchObject({ status: 'ready', role: 'Admin', tenantId: 'tenant-1', businessName: 'Kathmandu Threads' });
    const crmCall = calls.find((c) => c.path === `${CRM}/seller/me`)!;
    expect(crmCall.headers.Authorization).toBe('Bearer crm-token-1');
  });

  it('asks for a session once even when several CRM calls start together', async () => {
    const calls = mockApi({
      [SESSION]: { body: sessionBody() },
      [`GET ${CRM}/tasks`]: envelope([]),
      [`GET ${CRM}/meetings`]: envelope([]),
    });
    await Promise.all([crm.get('/tasks'), crm.get('/meetings'), crm.get('/tasks')]);
    expect(calls.filter((c) => c.path === '/v1/vendor/crm/session')).toHaveLength(1);
  });

  it('refreshes the token a minute before it expires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let n = 0;
    const calls = mockApi({ [SESSION]: () => ({ body: sessionBody('Owner', `crm-token-${++n}`, 3 * 60_000) }) });
    await crmSession.acquire();
    expect(crmSession.currentToken()).toBe('crm-token-1');
    await vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000);
    expect(calls.filter((c) => c.path === '/v1/vendor/crm/session')).toHaveLength(2);
    expect(crmSession.currentToken()).toBe('crm-token-2');
    expect(crmSession.getState().status).toBe('ready');
  });

  it('re-requests the session on a 401 from the CRM and retries the call once', async () => {
    let n = 0;
    let first = true;
    const calls = mockApi({
      [SESSION]: () => ({ body: sessionBody('Owner', `crm-token-${++n}`) }),
      [`GET ${CRM}/tasks`]: () => {
        if (first) {
          first = false;
          return { status: 401, body: { success: false, message: 'expired' } };
        }
        return envelope([{ id: 't-1' }]);
      },
    });
    const tasks = await crm.get<{ id: string }[]>('/tasks');
    expect(tasks).toEqual([{ id: 't-1' }]);
    const taskCalls = calls.filter((c) => c.path === `${CRM}/tasks`);
    expect(taskCalls.map((c) => c.headers.Authorization)).toEqual(['Bearer crm-token-1', 'Bearer crm-token-2']);
  });

  it('says "being set up" (unavailable) when the session endpoint is not there yet', async () => {
    mockApi({});
    expect(await crmSession.acquire()).toBeNull();
    expect(crmSession.getState().status).toBe('unavailable');
    await expect(crm.get('/tasks')).rejects.toBeInstanceOf(ApiError);
  });

  it('treats a disabled seller CRM as "being set up" and a non-vendor as forbidden', async () => {
    mockApi({ [SESSION]: { status: 503, body: { errorCode: 'seller_crm.disabled', title: 'Seller CRM is disabled' } } });
    await crmSession.acquire();
    expect(crmSession.getState().status).toBe('unavailable');
    resetCrmSession();
    mockApi({ [SESSION]: { status: 403, body: { errorCode: 'seller_crm.not_a_vendor', title: 'Not a vendor' } } });
    await crmSession.acquire();
    expect(crmSession.getState().status).toBe('forbidden');
  });

  it('turns OmniFlow error envelopes into ApiError with the server message', async () => {
    mockApi({
      [SESSION]: { body: sessionBody() },
      [`POST ${CRM}/tasks`]: { status: 400, body: { success: false, message: 'Title is required.' } },
    });
    await expect(crm.post('/tasks', {})).rejects.toMatchObject({ status: 400, message: 'Title is required.' });
  });

  it('normalises a paged envelope into a page', async () => {
    mockApi({
      [SESSION]: { body: sessionBody() },
      [`GET ${CRM}/tasks`]: { body: { success: true, data: [{ id: 'a' }], totalCount: 41, pageNumber: 2, pageSize: 20, totalPages: 3 } },
    });
    const page = await crm.page('/tasks', { page: 2, pageSize: 20 });
    expect(page).toEqual({ items: [{ id: 'a' }], totalCount: 41, page: 2, pageSize: 20, totalPages: 3 });
  });
});

describe('buyer contact details never pass the CRM client', () => {
  it('drops phone/email fields and masks them inside text', () => {
    const out = redactPii({
      fullName: 'Ram',
      email: 'ram@example.com',
      phone: '+977 981-2345678',
      primaryEmail: 'x@y.com',
      hasEmail: true,
      consent: { push: true, email: false },
      attendees: [{ name: 'Ram', email: 'ram@example.com', role: 'Buyer' }],
      summary: 'Asked to be called on 9812345678 or ram@example.com about size',
      notes: 'Order #10023 placed 2026-10-12, ref SM-2026101200123',
      targetFilterJson: '{"tags":["VIP"]}',
    });
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('phone');
    expect(out).not.toHaveProperty('primaryEmail');
    expect(out.hasEmail).toBe(true);
    expect(out.consent).toEqual({ push: true, email: false });
    expect(out.attendees[0]).toEqual({ name: 'Ram', role: 'Buyer' });
    expect(out.summary).toBe(`Asked to be called on ${PHONE_MASK} or ${EMAIL_MASK} about size`);
    expect(out.notes).toBe('Order #10023 placed 2026-10-12, ref SM-2026101200123');
    expect(out.targetFilterJson).toBe('{"tags":["VIP"]}');
  });
});
