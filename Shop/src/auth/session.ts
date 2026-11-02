import { useSyncExternalStore } from 'react';
import { ApiError, setAuthBridge } from '../api/client';
import { authApi, type AuthResponse } from './api';
import { decodeJwt } from './jwt';

/**
 * The buyer's session, outside React so the HTTP client can use it. Same scheme as Seller Center
 * (`Brand/src/auth/session.ts`), without any role gate (contract A4: the shop never applies one):
 *
 * - Access token: memory only.
 * - Refresh token: localStorage (a shopper expects to stay signed in on their phone).
 * - Refresh is single-flight and serialised across tabs with the Web Locks API — the backend rotates the refresh
 *   token on every use and treats a reused one as theft.
 * - Silent refresh at ~80% of the access token's life.
 */

const RT_KEY = 'sm.shop.rt';
const CHANNEL = 'sm-shop-auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type SignInMethod = 'phone' | 'google' | 'facebook';

export interface SessionState {
  status: AuthStatus;
  accountId: string | null;
  sessionId: string | null;
  signInMethod: SignInMethod | null;
  newAccount: boolean;
}

const initial: SessionState = { status: 'loading', accountId: null, sessionId: null, signInMethod: null, newAccount: false };

let state: SessionState = initial;
let accessToken: string | null = null;
let accessExpiresMs = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<boolean> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const session = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getAccessToken: () => accessToken,
};

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(RT_KEY, token);
    else localStorage.removeItem(RT_KEY);
  } catch {
    /* the session then lasts for this page only */
  }
}

function applyTokens(res: AuthResponse) {
  accessToken = res.accessToken;
  const exp = Date.parse(res.accessExpiresUtc);
  accessExpiresMs = Number.isFinite(exp) ? exp : Date.now() + 14 * 60_000;
  writeRefreshToken(res.refreshToken);
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(15_000, Math.floor((accessExpiresMs - Date.now()) * 0.8));
  refreshTimer = setTimeout(() => void refresh(), delay);
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return locks.request('sm-shop-refresh', fn) as Promise<T>;
  return fn();
}

/** Single-flight refresh. Resolves true when a new access token is in memory. */
export function refresh(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = withRefreshLock(async () => {
    const stored = readRefreshToken();
    if (!stored) {
      if (state.status === 'signedIn') endSession();
      return false;
    }
    try {
      const res = await authApi.refresh(stored);
      applyTokens(res);
      channel?.postMessage({ type: 'rotated' });
      if (state.status !== 'signedIn') setState({ status: 'signedIn', accountId: res.accountId, sessionId: res.sessionId });
      return true;
    } catch (e) {
      // Offline / rate-limited / server error keeps the session; only a refused token ends it.
      if (e instanceof ApiError && (e.isOffline || e.status === 429 || e.status >= 500)) return false;
      endSession();
      return false;
    }
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

function endSession(broadcast = true) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  accessToken = null;
  writeRefreshToken(null);
  state = { ...initial, status: 'signedOut' };
  listeners.forEach((l) => l());
  if (broadcast) channel?.postMessage({ type: 'signed-out' });
}

/** A fresh AuthResponse (OTP, Google, Facebook) becomes the session. */
export function establish(res: AuthResponse, method: SignInMethod) {
  applyTokens(res);
  setState({
    status: 'signedIn',
    accountId: res.accountId ?? decodeJwt(res.accessToken)?.sub ?? null,
    sessionId: res.sessionId,
    signInMethod: method,
    newAccount: res.isNewAccount === true,
  });
}

function wireBridge() {
  setAuthBridge({ getAccessToken: () => accessToken, refresh, onAuthLost: () => endSession() });
}

/** Start-up: resume from a stored refresh token, if any. */
export async function bootstrap(): Promise<void> {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev) => {
      const msg = ev.data as { type?: string } | null;
      if (msg?.type === 'signed-out' && state.status === 'signedIn') endSession(false);
    };
  }
  wireBridge();
  if (!readRefreshToken()) {
    setState({ status: 'signedOut' });
    return;
  }
  const ok = await refresh();
  if (!ok && state.status !== 'signedOut') {
    // Offline at start-up: keep the token for later, but behave as signed out for now.
    setState({ status: 'signedOut' });
  }
}

export async function signOut(): Promise<void> {
  const stored = readRefreshToken();
  try {
    if (stored && accessToken) await authApi.logout(stored);
  } catch {
    /* forgotten locally either way */
  }
  endSession();
}

/** Tests only. */
export function __resetSessionForTests(status: AuthStatus = 'signedOut') {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  accessToken = null;
  inflight = null;
  state = { ...initial, status };
  wireBridge();
  listeners.forEach((l) => l());
}
