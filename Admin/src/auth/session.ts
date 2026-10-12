/**
 * The admin session.
 *
 * `POST /v1/admin/auth/sso` turns an identity token (an OIDC id_token from the corporate IdP, or the environment's
 * bootstrap access key) into a StyleMint admin JWT (`accessToken`, `expiresAtUtc`, default 60 minutes). There is no
 * refresh token and no refresh endpoint: "refreshing" means getting a new id_token from the IdP without a prompt and
 * exchanging it again.
 *
 * Where the token lives: in memory, mirrored to this TAB's sessionStorage so a reload does not sign the operator out
 * (sessionStorage is per tab, gone when the tab closes, and never sent anywhere by the browser). It is never put in
 * localStorage or a cookie. Logout and an expired/revoked session clear it, and the logout is broadcast to the other
 * tabs.
 */
import { useSyncExternalStore } from 'react';
import { http, installSessionHooks, request } from '@/api/client';
import { getConfig } from '@/config';
import { silentRenew } from './silentRenew';

export interface AdminClaims {
  /** `adm_<guid>` */
  sub: string;
  adminAccountId: string;
  jti: string;
  email: string;
  name: string;
  roles: string[];
  exp: number;
}

export interface AdminLoginSession {
  accessToken: string;
  expiresAtUtc: string;
  adminAccountId: string;
  email: string;
  displayName: string;
  roles: number[];
}

export interface Session {
  token: string;
  expiresAt: number;
  claims: AdminClaims;
  /** How it was obtained, which decides how it can be renewed. */
  via: 'sso' | 'key';
}

export type EndReason = 'expired' | 'revoked' | 'security' | 'signedOut';

interface State {
  session: Session | null;
  /** Why the last session ended, for the sign-in screen. */
  ended: EndReason | null;
}

const STORAGE_KEY = 'sm.admin.session';
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sm.admin.auth') : null;

let state: State = { session: null, ended: null };
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** .NET writes one role as a string and several as an array, under the same claim. */
function normaliseRoles(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : [];
  if (Array.isArray(value)) return value.filter((r): r is string => typeof r === 'string');
  return [];
}

/**
 * Reads the admin JWT's claims. Decode only - the browser cannot verify the signature and does not try. The claims
 * decide what the console offers; the server authorises every call again.
 */
export function parseClaims(token: string | null | undefined): AdminClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  let raw: Record<string, unknown>;
  try {
    const decoded = decodeSegment(parts[1]);
    if (!decoded || typeof decoded !== 'object') return null;
    raw = decoded as Record<string, unknown>;
  } catch {
    return null;
  }
  const exp = typeof raw.exp === 'number' ? raw.exp : Number.NaN;
  if (!Number.isFinite(exp)) return null;
  const sub = typeof raw.sub === 'string' ? raw.sub : '';
  return {
    sub,
    adminAccountId: sub.startsWith('adm_') ? sub.slice(4) : sub,
    jti: typeof raw.jti === 'string' ? raw.jti : '',
    email: (typeof raw.admin_email === 'string' && raw.admin_email) || (typeof raw.email === 'string' ? raw.email : ''),
    name: (typeof raw.admin_name === 'string' && raw.admin_name) || (typeof raw.name === 'string' ? raw.name : ''),
    roles: normaliseRoles(raw.admin_role ?? raw.roles ?? raw.role),
    exp,
  };
}

function persist(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt, via: session.via }));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the session simply lasts until reload.
  }
}

export function sessionFromLogin(login: AdminLoginSession, via: Session['via']): Session {
  const claims = parseClaims(login.accessToken);
  if (!claims) throw new Error('The server returned a token this console cannot read.');
  const fromBody = Date.parse(login.expiresAtUtc);
  const expiresAt = Number.isFinite(fromBody) ? fromBody : claims.exp * 1000;
  return { token: login.accessToken, expiresAt, claims, via };
}

export function setSession(session: Session) {
  persist(session);
  emit({ session, ended: null });
}

export function endSession(reason: EndReason, broadcast = true) {
  if (!state.session && state.ended === reason) return;
  persist(null);
  emit({ session: null, ended: reason });
  if (broadcast) channel?.postMessage({ type: 'ended', reason });
}

/** Restores this tab's session after a reload, if it has not expired. */
export function restoreSession(now = Date.now()): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { token: string; expiresAt: number; via: Session['via'] };
    const claims = parseClaims(stored.token);
    if (!claims || stored.expiresAt <= now + 15_000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const session: Session = { token: stored.token, expiresAt: stored.expiresAt, claims, via: stored.via === 'key' ? 'key' : 'sso' };
    emit({ session, ended: null });
    return session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return state.session;
}

/** The whole store: the session and why the last one ended. */
export function getSessionState(): Readonly<State> {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// ---------------------------------------------------------------- API

export const authApi = {
  logout: () => http.post<number>('/v1/admin/auth/logout'),
  logoutAll: () => http.post<number>('/v1/admin/auth/logout-all'),
};

/** Exchanges an identity token (id_token or access key) for an admin session and makes it current. */
export async function signInWithIdToken(idToken: string, via: Session['via']): Promise<Session> {
  const login = await request<AdminLoginSession>('/v1/admin/auth/sso', { method: 'POST', body: { idToken }, anonymous: true });
  const session = sessionFromLogin(login, via);
  setSession(session);
  return session;
}

export async function signOut(everywhere = false): Promise<void> {
  try {
    if (everywhere) await authApi.logoutAll();
    else await authApi.logout();
  } catch {
    // The server-side row expires on its own; the local session ends regardless.
  }
  endSession('signedOut');
}

/** A fresh token without a prompt: only an SSO session can do that, and only while the IdP session is alive. */
async function refresh(): Promise<boolean> {
  const current = state.session;
  const sso = getConfig().sso;
  if (!current || current.via !== 'sso' || !sso) return false;
  try {
    const idToken = await silentRenew(sso);
    if (!idToken) return false;
    await signInWithIdToken(idToken, 'sso');
    return true;
  } catch {
    return false;
  }
}

let installed = false;
/** Wires the HTTP client to this session and listens for logouts in other tabs. Call once at startup. */
export function installSession() {
  if (installed) return;
  installed = true;
  installSessionHooks({
    token: () => state.session?.token ?? null,
    refresh,
    expire: (reason) => endSession(reason),
  });
  if (channel) {
    channel.onmessage = (event: MessageEvent<{ type?: string; reason?: EndReason }>) => {
      if (event.data?.type === 'ended' && state.session) endSession(event.data.reason ?? 'signedOut', false);
    };
  }
}

/** For tests. */
export function resetSessionForTests() {
  state = { session: null, ended: null };
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export { refresh as refreshSession };
