/**
 * Admin sign-in by Google, Facebook or email + password (wt/admin-login-contract.md). Only the email addresses of
 * existing, enabled admin accounts get in, whichever way they sign in. The exchanges that create a session live in
 * `auth/session.ts`; this module has what the sign-in and set-password screens read and send before there is one.
 *
 * Every call here is anonymous: no bearer, and a 401 never triggers the refresh-and-retry.
 */
import { z } from 'zod';
import { request } from './client';
import { ApiError } from './errors';

const methodsSchema = z.object({
  google: z.object({ clientId: z.string().min(1) }).passthrough().nullable().optional().catch(null),
  facebook: z.object({ appId: z.string().min(1) }).passthrough().nullable().optional().catch(null),
  password: z.boolean().optional().catch(undefined),
  sso: z.boolean().optional().catch(undefined),
  accessKey: z.boolean().optional().catch(undefined),
});

export interface AuthMethods {
  google: { clientId: string } | null;
  facebook: { appId: string } | null;
  password: boolean;
  /** Generic OIDC is configured on the server (`Admin:Oidc:Authority`); null when the server does not say. */
  sso: boolean | null;
  /** The environment access key (dev shared secret) is configured; null when the server does not say. */
  accessKey: boolean | null;
  /**
   * The server has no `/methods` endpoint yet (it answered a bare 404): only the older single sign-on and access-key
   * exchange exist there, so the sign-in page offers those as it did before.
   */
  legacy: boolean;
}

export const LEGACY_METHODS: AuthMethods = { google: null, facebook: null, password: false, sso: null, accessKey: true, legacy: true };

/** Reads `GET /v1/admin/auth/methods`, tolerating a server that does not have it yet. */
export async function fetchAuthMethods(signal?: AbortSignal): Promise<AuthMethods> {
  let raw: unknown;
  try {
    raw = await request<unknown>('/v1/admin/auth/methods', { anonymous: true, signal });
  } catch (error) {
    if (error instanceof ApiError && error.isMissingEndpoint) return LEGACY_METHODS;
    throw error;
  }
  const parsed = methodsSchema.safeParse(raw ?? {});
  const data: z.infer<typeof methodsSchema> = parsed.success ? parsed.data : {};
  return {
    google: data.google?.clientId ? { clientId: data.google.clientId } : null,
    facebook: data.facebook?.appId ? { appId: data.facebook.appId } : null,
    // The contract always reports `password: true`; only an explicit false hides the form.
    password: data.password !== false,
    sso: data.sso ?? null,
    accessKey: data.accessKey ?? null,
    legacy: false,
  };
}

export const passwordApi = {
  /** Always 204 for any address: the answer never says whether the email belongs to an admin. */
  requestReset: (email: string) =>
    request<void>('/v1/admin/auth/password/reset-request', { method: 'POST', body: { email: email.trim() }, anonymous: true }),
  /** For both a reset link (30 min) and an invitation link (72 h). */
  set: (token: string, password: string) => request<void>('/v1/admin/auth/password/set', { method: 'POST', body: { token, password }, anonymous: true }),
};

// ---------------------------------------------------------------- password policy

/** Mirrors the server's policy: at least 12 characters, with a letter and a digit. The server checks again. */
export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordRule {
  id: 'length' | 'letter' | 'digit' | 'match';
  label: string;
  met: boolean;
}

export function passwordRules(password: string, confirm: string): PasswordRule[] {
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'letter', label: 'At least one letter', met: /\p{L}/u.test(password) },
    { id: 'digit', label: 'At least one number', met: /\p{Nd}/u.test(password) },
    { id: 'match', label: 'Both entries match', met: password.length > 0 && password === confirm },
  ];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}
