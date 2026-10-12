/**
 * The corporate identity provider half of admin sign-in (docs/admin/ADMIN_AUTH_FLOW.md): send the operator to the
 * IdP, come back with an OIDC id_token, and hand that to `POST /v1/admin/auth/sso`, which verifies it and mints the
 * StyleMint admin JWT. Provider-agnostic (Entra ID, Okta, Auth0, Keycloak, Google): authority + client id only.
 *
 * Authorization code + PKCE by default, so no token ever travels in the URL; the implicit `id_token` response is
 * there for an IdP whose token endpoint has no CORS.
 */
import type { SsoConfig } from '@/config';

const PENDING_KEY = 'sm.admin.sso.pending';

interface Pending {
  state: string;
  nonce: string;
  verifier?: string;
  returnTo: string;
  createdAt: number;
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
}

const discoveryCache = new Map<string, Promise<Discovery>>();

export function discover(authority: string): Promise<Discovery> {
  const key = authority.replace(/\/+$/, '');
  let cached = discoveryCache.get(key);
  if (!cached) {
    cached = fetch(`${key}/.well-known/openid-configuration`).then(async (r) => {
      if (!r.ok) throw new Error(`The identity provider’s configuration could not be read (${r.status}).`);
      return (await r.json()) as Discovery;
    });
    cached.catch(() => discoveryCache.delete(key));
    discoveryCache.set(key, cached);
  }
  return cached;
}

function randomString(bytes = 32): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

function base64Url(data: Uint8Array): string {
  let s = '';
  data.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function redirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}sso/callback`;
}

/** Only paths inside this console, never an address that leaves it. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

export async function buildAuthorizeUrl(config: SsoConfig, returnTo: string, opts: { silent?: boolean } = {}): Promise<string> {
  const meta = await discover(config.authority);
  const pending: Pending = { state: randomString(16), nonce: randomString(16), returnTo: safeReturnTo(returnTo), createdAt: Date.now() };
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    scope: config.scope,
    state: pending.state,
    nonce: pending.nonce,
  });
  if (config.responseType === 'code') {
    pending.verifier = randomString(48);
    params.set('response_type', 'code');
    params.set('code_challenge', await challengeOf(pending.verifier));
    params.set('code_challenge_method', 'S256');
  } else {
    params.set('response_type', 'id_token');
    params.set('response_mode', 'fragment');
  }
  if (opts.silent) params.set('prompt', 'none');
  for (const [k, v] of Object.entries(config.extraParams ?? {})) params.set(k, v);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  return `${meta.authorization_endpoint}?${params.toString()}`;
}

export async function startSignIn(config: SsoConfig, returnTo: string, opts: { silent?: boolean } = {}): Promise<void> {
  window.location.assign(await buildAuthorizeUrl(config, returnTo, opts));
}

export class SsoCallbackError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Reads the IdP's answer from the callback URL and returns the id_token to exchange, and where to go after. */
export async function completeSignIn(config: SsoConfig, location: { search: string; hash: string }): Promise<{ idToken: string; returnTo: string }> {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const get = (k: string) => query.get(k) ?? fragment.get(k);

  let pending: Pending | null = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
  } catch {
    pending = null;
  }
  sessionStorage.removeItem(PENDING_KEY);

  const error = get('error');
  if (error) {
    const described = get('error_description');
    if (error === 'login_required' || error === 'interaction_required' || error === 'consent_required') {
      throw new SsoCallbackError('Your identity provider needs you to sign in again.', error);
    }
    throw new SsoCallbackError(described ? `The identity provider said: ${described}` : `The identity provider refused the sign-in (${error}).`, error);
  }
  const state = get('state');
  if (!pending || !state || state !== pending.state) {
    throw new SsoCallbackError('This sign-in link is out of date or was not started here. Please start again.', 'state_mismatch');
  }
  if (Date.now() - pending.createdAt > 15 * 60_000) {
    throw new SsoCallbackError('The sign-in took too long. Please start again.', 'expired');
  }

  if (config.responseType === 'id_token') {
    const idToken = get('id_token');
    if (!idToken) throw new SsoCallbackError('The identity provider did not return an identity token.', 'no_token');
    checkNonce(idToken, pending.nonce);
    return { idToken, returnTo: pending.returnTo };
  }

  const code = get('code');
  if (!code || !pending.verifier) throw new SsoCallbackError('The identity provider did not return a sign-in code.', 'no_code');
  const meta = await discover(config.authority);
  if (!meta.token_endpoint) throw new SsoCallbackError('The identity provider has no token endpoint.', 'no_token_endpoint');
  const response = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: config.clientId,
      code_verifier: pending.verifier,
    }),
  }).catch(() => null);
  if (!response || !response.ok) {
    throw new SsoCallbackError('The sign-in code could not be redeemed with the identity provider.', 'token_exchange_failed');
  }
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new SsoCallbackError('The identity provider did not return an identity token.', 'no_token');
  checkNonce(body.id_token, pending.nonce);
  return { idToken: body.id_token, returnTo: pending.returnTo };
}

function checkNonce(idToken: string, expected: string) {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { nonce?: string };
    if (payload.nonce && payload.nonce !== expected) throw new Error('nonce');
  } catch {
    throw new SsoCallbackError('The identity token did not match this sign-in. Please start again.', 'nonce_mismatch');
  }
}
