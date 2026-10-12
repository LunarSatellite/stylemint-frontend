import { useAuth } from './store';

/**
 * Let a developer into the console before SSO exists.
 *
 * `?devToken=<jwt>` seeds the auth store and is then stripped from the
 * URL so it does not linger in history or a screenshot.
 *
 * Guarded by `import.meta.env.DEV`, which Vite replaces with a literal
 * `false` in a production build — the branch is then dead code and is
 * dropped entirely, so there is no path to this in anything shipped.
 * That matters more than usual here: the whole point of keeping the
 * token out of storage is that this console can revoke sessions and
 * force payouts.
 */
export function seedDevToken(): void {
  if (!import.meta.env.DEV) return;

  const url = new URL(window.location.href);
  const token = url.searchParams.get('devToken');
  if (!token) return;

  useAuth.getState().setToken(token);
  url.searchParams.delete('devToken');
  window.history.replaceState({}, '', url.toString());
  console.warn('[dev] auth seeded from ?devToken — never available in a production build');
}
