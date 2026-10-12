import type { ReactElement, ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { setSession, sessionFromLogin } from '@/auth/session';
import { cssVariablesResolver, theme } from '@/theme';

export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } } });
}

export function TestProviders({ children, queryClient, route = '/' }: { children: ReactNode; queryClient?: QueryClient; route?: string | null }) {
  const client = queryClient ?? testQueryClient();
  const inner = (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <Notifications />
        {children}
      </ModalsProvider>
    </QueryClientProvider>
  );
  return (
    // env="test" turns transitions off and keeps popovers reachable in jsdom.
    <MantineProvider env="test" theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      {route === null ? inner : <MemoryRouter initialEntries={[route]}>{inner}</MemoryRouter>}
    </MantineProvider>
  );
}

export function renderWithProviders(ui: ReactElement, { route = '/', queryClient, ...options }: RenderOptions & { route?: string; queryClient?: QueryClient } = {}) {
  const client = queryClient ?? testQueryClient();
  return {
    queryClient: client,
    ...render(ui, {
      wrapper: ({ children }) => (
        <TestProviders queryClient={client} route={route}>
          {children}
        </TestProviders>
      ),
      ...options,
    }),
  };
}

function b64url(value: unknown) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** An unsigned admin JWT with the claims the backend mints (admin_role is an array of names). */
export function fakeAdminJwt(roles: string[] | string = ['SuperAdmin'], overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub: 'adm_11111111-2222-3333-4444-555555555555',
      jti: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      admin_email: 'ops@stylemint.test',
      admin_name: 'Asha Operator',
      admin_role: roles,
      iss: 'stylemint-admin',
      aud: 'stylemint-admin-console',
      iat: now,
      nbf: now,
      exp: now + 3600,
      ...overrides,
    }),
    'sig',
  ].join('.');
}

export function signInAs(roles: string[] = ['SuperAdmin']) {
  const token = fakeAdminJwt(roles);
  setSession(
    sessionFromLogin(
      { accessToken: token, expiresAtUtc: new Date(Date.now() + 3600_000).toISOString(), adminAccountId: '11111111-2222-3333-4444-555555555555', email: 'ops@stylemint.test', displayName: 'Asha', roles: [1] },
      'key',
    ),
  );
  return token;
}

export interface Captured {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (req: Captured) => { status?: number; body?: unknown; headers?: Record<string, string> } | undefined;

/**
 * Replaces fetch with a router of canned answers. Unmatched requests answer 404 with no body (what the API does for
 * a route it does not have), so a test notices a call it did not expect.
 */
export function mockFetch(responder: Responder) {
  const calls: Captured[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    const req: Captured = {
      method: (init?.method ?? 'GET').toUpperCase(),
      url,
      path: url.split('?')[0]!,
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(req);
    const res = responder(req) ?? { status: 404 };
    const status = res.status ?? 200;
    const text = res.body === undefined ? '' : JSON.stringify(res.body);
    return new Response(status === 204 ? null : text, { status, headers: { 'Content-Type': 'application/json', ...res.headers } });
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
