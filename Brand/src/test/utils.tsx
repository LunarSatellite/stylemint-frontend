import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { createQueryClient, Providers } from '../App';

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
  return {
    client,
    ...render(
      <Providers client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Providers>,
    ),
  };
}

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function fakeJwt(claims: Record<string, unknown>): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ exp: Math.floor(Date.now() / 1000) + 900, ...claims })}.sig`;
}

export const ACCOUNT_ID = '11111111-2222-3333-4444-555555555555';
export const SESSION_ID = '99999999-8888-7777-6666-555555555555';

export function authResponse(roles: string[], extra: Record<string, unknown> = {}) {
  return {
    accountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    accessToken: fakeJwt({ sub: ACCOUNT_ID, session_id: SESSION_ID, roles }),
    accessExpiresUtc: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-1',
    refreshExpiresUtc: new Date(Date.now() + 30 * 86400_000).toISOString(),
    tokenType: 'Bearer',
    isNewAccount: false,
    displayNameConfirmed: true,
    ...extra,
  };
}

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

type Handler = (call: RecordedCall) => { status?: number; body?: unknown } | undefined;

/**
 * Stubs global fetch with a route table: `"POST /v1/auth/login": handler`. Unmatched calls answer
 * 404 with an empty body (like an undeployed route). Returns the list of calls made.
 */
export function mockApi(routes: Record<string, Handler | { status?: number; body?: unknown }>) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    let body: unknown = undefined;
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
    const call: RecordedCall = { method, path: url.pathname, body, headers };
    calls.push(call);
    const key = `${method} ${url.pathname}`;
    const route = routes[key];
    const res = typeof route === 'function' ? route(call) : route;
    if (!res) return new Response('', { status: 404 });
    const status = res.status ?? 200;
    if (status === 204 || res.body === undefined) return new Response(null, { status: status === 200 ? 204 : status });
    return new Response(JSON.stringify(res.body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}
