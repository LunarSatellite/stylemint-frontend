import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { __resetSessionForTests, establish } from './auth/session';
import { authResponse, renderWithProviders } from './test/utils';

const ROUTES = [
  '/',
  '/reels',
  '/reels/import',
  '/reels/aaaaaaaa-0000-0000-0000-000000000001',
  '/studio',
  '/analytics',
  '/partnerships',
  '/partnerships/aaaaaaaa-0000-0000-0000-000000000001',
  '/brands',
  '/briefs',
  '/briefs/aaaaaaaa-0000-0000-0000-000000000001',
  '/deals',
  '/rate-card',
  '/earnings',
  '/payouts',
  '/profile',
  '/collections',
  '/social',
  '/growth',
  '/community',
  '/audio',
  '/activity',
  '/settings',
];

/** Every API call fails with a server error. */
function failEverything() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/auth/refresh')) return new Response(JSON.stringify({ title: 'down', status: 503 }), { status: 503 });
      return new Response(JSON.stringify({ title: 'StyleMint is down', status: 500, errorCode: 'system.internal_error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

describe('every screen, when the API is down', () => {
  beforeEach(async () => {
    __resetSessionForTests();
    failEverything();
    await establish(authResponse(['Creator']), { remember: false, checkPassword: false });
  });

  it.each(ROUTES)('%s shows an error, not a crash and not "nothing here"', async (route) => {
    renderWithProviders(<AppRoutes />, { route });
    await waitFor(() => expect(screen.getAllByTestId('state-error').length).toBeGreaterThan(0), { timeout: 8000 });
    expect(screen.queryByText(/this page could not be shown/i)).toBeNull();
    expect(screen.queryByTestId('state-empty')).toBeNull();
  });
});
