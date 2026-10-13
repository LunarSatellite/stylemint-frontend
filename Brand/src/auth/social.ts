import { api, ApiError } from '../api/client';
import { deviceBinding, type AuthResponse } from './api';

/**
 * "Continue with Google / Apple / Facebook".
 *
 * The provider's own SDK signs the person in inside a popup and hands this page a token; the page posts it to
 * `POST /v1/auth/oauth/{provider}/native`, which verifies it and answers with the same AuthResponse as a password
 * sign-in. Which providers to offer, and their public ids, come from `GET /v1/auth/oauth/web-config`.
 */

export type SocialProvider = 'google' | 'apple' | 'facebook';

export const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };

export interface SocialWebConfig {
  google: { clientId: string } | null;
  apple: { servicesId: string; redirectUri: string } | null;
  /** `graphVersion` (e.g. "v21.0") is what the SDK is initialised with; the SDK default otherwise. */
  facebook: { appId: string; graphVersion: string | null } | null;
}

export const NO_SOCIAL: SocialWebConfig = { google: null, apple: null, facebook: null };

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

/** First non-empty string among `keys`, compared case-insensitively. */
function pick(source: Loose | undefined, ...keys: string[]): string | null {
  if (!source) return null;
  const wanted = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(source)) {
    if (wanted.includes(k.toLowerCase()) && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function section(raw: Loose, name: string): Loose | undefined {
  for (const [k, v] of Object.entries(raw)) if (k.toLowerCase() === name && isObject(v)) return v;
  return undefined;
}

/** A provider block switched off explicitly (`webReady: false` / `enabled: false`) is not offered. */
function switchedOff(block: Loose | undefined): boolean {
  if (!block) return false;
  return Object.entries(block).some(([k, v]) => ['webready', 'enabled', 'configured'].includes(k.toLowerCase()) && v === false);
}

/**
 * Reads the web-config answer. A provider is offered only with every public id its web flow needs; anything else
 * (missing, null, blank, switched off) hides its button.
 */
export function parseWebConfig(raw: unknown): SocialWebConfig {
  if (!isObject(raw)) return NO_SOCIAL;
  const g = section(raw, 'google');
  const a = section(raw, 'apple');
  const f = section(raw, 'facebook');

  const googleClientId = switchedOff(g) ? null : pick(g, 'clientId', 'webClientId');
  const appleServicesId = switchedOff(a) ? null : pick(a, 'servicesId', 'serviceId', 'clientId');
  const appleRedirect = pick(a, 'redirectUri', 'redirectURI', 'redirectUrl');
  const facebookAppId = switchedOff(f) ? null : pick(f, 'appId', 'clientId');
  const graphVersion = pick(f, 'graphVersion');

  return {
    google: googleClientId ? { clientId: googleClientId } : null,
    apple: appleServicesId && appleRedirect ? { servicesId: appleServicesId, redirectUri: appleRedirect } : null,
    facebook: facebookAppId
      ? { appId: facebookAppId, graphVersion: graphVersion && /^v\d+\.\d+$/.test(graphVersion) ? graphVersion : null }
      : null,
  };
}

/** Which providers this deployment can finish on the web. Any failure (404 included) means "none": the form stays. */
export async function fetchSocialConfig(signal?: AbortSignal): Promise<SocialWebConfig> {
  try {
    return parseWebConfig(await api.get<unknown>('/v1/auth/oauth/web-config', undefined, { anonymous: true, signal }));
  } catch {
    return NO_SOCIAL;
  }
}

export interface SocialToken {
  /** Google: the ID token. Apple: the identity token. Facebook: the user access token. */
  token: string;
  /** Apple only, and only on the very first authorization: the name Apple will never send again. */
  displayName?: string | null;
  /** Google and Apple: the raw nonce whose hex SHA-256 the provider put in the token (the server requires it). */
  nonce?: string | null;
}

export function socialSignIn(provider: SocialProvider, { token, displayName, nonce }: SocialToken) {
  return api.post<AuthResponse>(
    `/v1/auth/oauth/${provider}/native`,
    {
      identityToken: token,
      ...(displayName ? { displayName } : {}),
      ...(nonce ? { nonce } : {}),
      ...deviceBinding(),
    },
    { anonymous: true },
  );
}

const ASK_REGISTERED = 'sign in with the phone number or email your shop was registered with';

/** What the seller is told when the server refuses a provider sign-in. */
export function socialError(error: unknown, provider: SocialProvider): string {
  const name = PROVIDER_NAME[provider];
  if (!(error instanceof ApiError)) return `${name} sign-in did not finish. Please try again.`;
  if (error.isOffline) return 'Could not reach StyleMint. Check your internet connection and try again.';
  const text = error.message.toLowerCase();
  if (error.status === 409 || error.code === 'state.conflict')
    return `This ${name} account can’t be linked to your StyleMint account automatically — its email is not verified on one side, or a different ${name} account is already linked. Please ${ASK_REGISTERED} (password or a code).`;
  if (text.includes('did not share an email') || (error.status === 400 && 'email' in error.fieldErrors))
    return provider === 'facebook'
      ? `Facebook did not share your email address, so we can’t find your shop. Try again and allow access to your email, or ${ASK_REGISTERED}.`
      : `${name} did not share your email address, so we can’t find your shop. Please ${ASK_REGISTERED}.`;
  if (error.status === 429 || error.code === 'system.rate_limited') return 'Too many attempts. Please wait a minute and try again.';
  if (text.includes('temporarily locked'))
    return 'Too many wrong attempts — this account is locked for 30 minutes. You can sign in with a code instead.';
  if (text.includes('not active') || text.includes('suspended')) return 'This account is not active. Please contact StyleMint support.';
  if (error.status === 503 || error.code === 'system.service_unavailable' || error.status === 404 || error.status === 501)
    return `${name} sign-in isn’t available right now. Please ${ASK_REGISTERED}.`;
  if (error.status === 401 || error.status === 403)
    return `${name} could not confirm this sign-in. Try again, or ${ASK_REGISTERED}.`;
  if (error.status >= 500) return 'StyleMint had a problem signing you in. Please try again shortly.';
  return error.message;
}
