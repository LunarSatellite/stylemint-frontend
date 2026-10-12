import axios from 'axios';
import { env } from '@/env';
import { useAuth } from '@/auth/store';
import { newIdempotencyKey } from './idempotency';
import { errorCodeOf } from './errors';

/**
 * The only axios instance in the app.
 *
 * Everything a request needs to be correct — the bearer token, an
 * idempotency key on writes, the operator's language — is attached
 * here, so no call site can forget one. A second instance created
 * "just for this one endpoint" is how a write ends up without an
 * idempotency key.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
});

const WRITES = new Set(['post', 'patch', 'put', 'delete']);

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  // The SSO exchange is the one call made without a token; sending a
  // stale one there invites the server to reject the login rather than
  // the token.
  if (token && !config.url?.endsWith('/auth/sso')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  if (WRITES.has((config.method ?? '').toLowerCase()) && !config.headers.has('Idempotency-Key')) {
    config.headers.set('Idempotency-Key', newIdempotencyKey());
  }
  config.headers.set('Accept-Language', navigator.language || 'en');
  return config;
});

/**
 * Set by `installSessionRecovery` so this module does not import the
 * SSO frame, which imports the store, which imports this file.
 */
let trySilentRefresh: (() => Promise<boolean>) | null = null;
let redirect: (to: string) => void = (to) => window.location.assign(to);

export function installSessionRecovery(options: {
  silentRefresh: () => Promise<boolean>;
  redirect?: (to: string) => void;
}): void {
  trySilentRefresh = options.silentRefresh;
  if (options.redirect) redirect = options.redirect;
}

function signOut(reason: string): void {
  useAuth.getState().clear();
  redirect(`/login?reason=${reason}`);
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status !== 401) return Promise.reject(error);

    const code = errorCodeOf(error);

    // These two are not "your token aged out" — they say the session was
    // ended deliberately, or replayed. Recovering silently would hide a
    // security event from the person it happened to, and in the reuse
    // case would re-authenticate an account that should be challenged.
    if (code === 'auth.token_reuse_detected') {
      signOut('security');
      return Promise.reject(error);
    }
    if (code === 'auth.session_revoked') {
      signOut('revoked');
      return Promise.reject(error);
    }

    const recovered = trySilentRefresh ? await trySilentRefresh() : false;
    if (!recovered) signOut('expired');
    return Promise.reject(error);
  },
);
