import { api, ApiError } from '../api/client';
import { deviceBinding, type AuthResponse } from './api';

/**
 * "Continue with Google / Facebook" (contract A4). The provider SDK signs the buyer in inside a popup and hands
 * this page a token; the page posts it to `POST /v1/auth/oauth/{provider}/native`. New accounts become customers
 * (existing backend behaviour). Which providers to offer comes from `GET /v1/auth/oauth/web-config`.
 */

export type SocialProvider = 'google' | 'facebook';

export const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

export interface SocialWebConfig {
  google: { clientId: string } | null;
  facebook: { appId: string; graphVersion: string | null } | null;
}

export const NO_SOCIAL: SocialWebConfig = { google: null, facebook: null };

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

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

function switchedOff(block: Loose | undefined): boolean {
  if (!block) return false;
  return Object.entries(block).some(([k, v]) => ['webready', 'enabled', 'configured'].includes(k.toLowerCase()) && v === false);
}

export function parseWebConfig(raw: unknown): SocialWebConfig {
  if (!isObject(raw)) return NO_SOCIAL;
  const g = section(raw, 'google');
  const f = section(raw, 'facebook');
  const googleClientId = switchedOff(g) ? null : pick(g, 'clientId', 'webClientId');
  const facebookAppId = switchedOff(f) ? null : pick(f, 'appId', 'clientId');
  const graphVersion = pick(f, 'graphVersion');
  return {
    google: googleClientId ? { clientId: googleClientId } : null,
    facebook: facebookAppId ? { appId: facebookAppId, graphVersion: graphVersion && /^v\d+\.\d+$/.test(graphVersion) ? graphVersion : null } : null,
  };
}

/** Any failure (404 included) means "no social buttons": phone sign-in always stays. */
export async function fetchSocialConfig(): Promise<SocialWebConfig> {
  try {
    return parseWebConfig(await api.get<unknown>('/v1/auth/oauth/web-config', undefined, { anonymous: true }));
  } catch {
    return NO_SOCIAL;
  }
}

export function socialSignIn(provider: SocialProvider, token: string, nonce?: string | null) {
  return api.post<AuthResponse>(
    `/v1/auth/oauth/${provider}/native`,
    { identityToken: token, ...(nonce ? { nonce } : {}), ...deviceBinding() },
    { anonymous: true },
  );
}

/** Result of a refused provider sign-in: the message, and whether to steer to phone sign-in. */
export function socialError(error: unknown, provider: SocialProvider): { message: string; usePhone: boolean } {
  const name = PROVIDER_NAME[provider];
  if (!(error instanceof ApiError)) return { message: `${name} sign-in did not finish. Please try again.`, usePhone: false };
  if (error.isOffline) return { message: 'Could not reach StyleMint. Check your internet connection and try again.', usePhone: false };
  if (error.status === 409 || error.code === 'state.conflict')
    return { message: `This ${name} account can’t be used here automatically. Sign in with your phone number instead.`, usePhone: true };
  if (error.status === 400 && /email/i.test(error.message))
    return { message: `${name} did not share your email address. Sign in with your phone number instead.`, usePhone: true };
  if (error.status === 429) return { message: 'Too many attempts. Please wait a minute and try again.', usePhone: false };
  if ([404, 501, 503].includes(error.status)) return { message: `${name} sign-in isn’t available right now. Use your phone number.`, usePhone: true };
  return { message: error.message, usePhone: false };
}
