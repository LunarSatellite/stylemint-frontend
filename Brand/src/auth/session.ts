import { ApiError, setAuthBridge } from '../api/client';
import { authApi, type AuthResponse } from './api';
import { decodeJwt, isVendor, rolesOf, type AccessClaims } from './jwt';

/**
 * The signed-in session, outside React so the HTTP client can use it.
 *
 * - Access token: memory only.
 * - Refresh token: sessionStorage, or localStorage when "keep me signed in" was ticked.
 * - Refresh is single-flight (and serialised across tabs with the Web Locks API): the backend
 *   rotates the refresh token on every use and treats a reused one as theft, revoking the session.
 * - Silent refresh at ~80% of the access token's life.
 */

const RT_KEY = 'sm.seller.rt';
const NEEDS_PASSWORD_KEY = 'sm.seller.needsPassword';
const CHANNEL = 'sm-seller-auth';

export type AuthStatus = 'loading' | 'signedOut' | 'needsPassword' | 'notVendor' | 'signedIn';

/** How this tab signed in. Unknown (null) after a reload resumed the session from its refresh token. */
export type SignInMethod = 'password' | 'code' | 'google' | 'apple' | 'facebook';

export interface SessionState {
  status: AuthStatus;
  accountId: string | null;
  sessionId: string | null;
  roles: string[];
  /** Why the last session ended, for the sign-in page. */
  endedReason: string | null;
  signInMethod: SignInMethod | null;
  /** The server created a brand-new account for this sign-in (e.g. a provider email no account had). */
  newAccount: boolean;
}

interface Tokens {
  accessToken: string;
  accessExpiresMs: number;
  claims: AccessClaims | null;
}

const initial: SessionState = {
  status: 'loading',
  accountId: null,
  sessionId: null,
  roles: [],
  endedReason: null,
  signInMethod: null,
  newAccount: false,
};

let state: SessionState = initial;
let tokens: Tokens | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  emit();
}

export const session = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getAccessToken: () => tokens?.accessToken ?? null,
};

// ---------------------------------------------------------------- storage

function storages(): Storage[] {
  const out: Storage[] = [];
  try {
    out.push(sessionStorage);
  } catch {
    /* blocked */
  }
  try {
    out.push(localStorage);
  } catch {
    /* blocked */
  }
  return out;
}

function readRefreshToken(): { token: string; remember: boolean } | null {
  try {
    const s = sessionStorage.getItem(RT_KEY);
    if (s) return { token: s, remember: false };
  } catch {
    /* ignore */
  }
  try {
    const l = localStorage.getItem(RT_KEY);
    if (l) return { token: l, remember: true };
  } catch {
    /* ignore */
  }
  return null;
}

function writeRefreshToken(token: string, remember: boolean) {
  for (const s of storages()) s.removeItem(RT_KEY);
  try {
    (remember ? localStorage : sessionStorage).setItem(RT_KEY, token);
  } catch {
    /* the session then lasts for this page only */
  }
}

function needsPasswordFlag(): boolean {
  return storages().some((s) => s.getItem(NEEDS_PASSWORD_KEY) === '1');
}

function setNeedsPasswordFlag(on: boolean, remember: boolean) {
  for (const s of storages()) s.removeItem(NEEDS_PASSWORD_KEY);
  if (on) {
    try {
      (remember ? localStorage : sessionStorage).setItem(NEEDS_PASSWORD_KEY, '1');
    } catch {
      /* ignore */
    }
  }
}

function clearStorage() {
  for (const s of storages()) {
    s.removeItem(RT_KEY);
    s.removeItem(NEEDS_PASSWORD_KEY);
  }
}

// ---------------------------------------------------------------- tokens

function applyTokens(res: AuthResponse, remember: boolean) {
  const claims = decodeJwt(res.accessToken);
  const expires = Date.parse(res.accessExpiresUtc);
  tokens = {
    accessToken: res.accessToken,
    accessExpiresMs: Number.isFinite(expires) ? expires : Date.now() + 14 * 60_000,
    claims,
  };
  writeRefreshToken(res.refreshToken, remember);
  scheduleRefresh();
  return claims;
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!tokens) return;
  const life = tokens.accessExpiresMs - Date.now();
  const delay = Math.max(15_000, Math.floor(life * 0.8));
  refreshTimer = setTimeout(() => {
    void refresh();
  }, delay);
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return locks.request('sm-seller-refresh', fn) as Promise<T>;
  return fn();
}

/** Single-flight refresh. Resolves true when a new access token is in memory. */
export function refresh(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = withRefreshLock(async () => {
    // Another tab may have rotated a shared token a moment ago; give its broadcast a beat to land,
    // then read inside the lock.
    if (channel) await new Promise((r) => setTimeout(r, 25));
    const stored = readRefreshToken();
    if (!stored) {
      // Signed in on this page but the token is gone (storage cleared or blocked): start over.
      if (state.status !== 'loading' && state.status !== 'signedOut') endSession('Your session has ended. Please sign in again.');
      return false;
    }
    try {
      const res = await authApi.refresh(stored.token);
      const claims = applyTokens(res, stored.remember);
      // A duplicated tab holds a copy of the same token in its own sessionStorage: tell it.
      channel?.postMessage({ type: 'rotated', from: stored.token, to: res.refreshToken });
      const roles = rolesOf(claims);
      if (state.status === 'signedIn' || state.status === 'needsPassword' || state.status === 'notVendor') {
        setState({ roles, sessionId: res.sessionId, accountId: res.accountId });
      }
      return true;
    } catch (e) {
      // Offline, rate-limited or a server error keeps the session (it may come back); only a
      // refused token (invalid, expired, reused, session gone) ends it.
      if (e instanceof ApiError && (e.isOffline || e.status === 429 || e.status >= 500)) return false;
      endSession('Your session has ended. Please sign in again.');
      return false;
    }
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

function endSession(reason: string | null, broadcast = true) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  tokens = null;
  clearStorage();
  state = { ...initial, status: 'signedOut', endedReason: reason };
  emit();
  if (broadcast) channel?.postMessage('signed-out');
}

// ---------------------------------------------------------------- sign-in outcomes

export interface EstablishOptions {
  remember: boolean;
  /**
   * After a code sign-in: check whether the account has a password yet. Not after Google / Apple / Facebook: the
   * provider is a credential of its own (the Security page still offers "Create a password").
   */
  checkPassword: boolean;
  method?: SignInMethod;
}

/**
 * Takes a fresh AuthResponse to a session state: role gate first (a non-seller account goes no
 * further), then — for code sign-ins — the mandatory "create your password" step.
 */
export async function establish(res: AuthResponse, opts: EstablishOptions): Promise<AuthStatus> {
  let claims = applyTokens(res, opts.remember);
  // On an account's very first sign-in the roles claim can be empty; a refresh re-reads them.
  if (rolesOf(claims).length === 0) {
    const ok = await refresh();
    if (ok) claims = tokens?.claims ?? claims;
  }
  const roles = rolesOf(claims);
  const base = {
    accountId: res.accountId,
    sessionId: res.sessionId,
    roles,
    endedReason: null,
    signInMethod: opts.method ?? null,
    newAccount: res.isNewAccount === true,
  };
  if (!isVendor(claims)) {
    setState({ ...base, status: 'notVendor' });
    return 'notVendor';
  }
  if (opts.checkPassword) {
    let hasPassword = true;
    try {
      const status = await authApi.registrationStatus(res.accountId);
      hasPassword = status.hasPassword;
    } catch {
      // If the status cannot be read, do not trap the seller; they can set one in Security.
      hasPassword = true;
    }
    if (!hasPassword) {
      setNeedsPasswordFlag(true, opts.remember);
      setState({ ...base, status: 'needsPassword' });
      return 'needsPassword';
    }
  }
  setNeedsPasswordFlag(false, opts.remember);
  setState({ ...base, status: 'signedIn' });
  return 'signedIn';
}

/** The password now exists (created, or the server said one already did). */
export function passwordCreated() {
  const remember = readRefreshToken()?.remember ?? false;
  setNeedsPasswordFlag(false, remember);
  if (state.status === 'needsPassword') setState({ status: 'signedIn' });
}

/** Start-up: resume from a stored refresh token, if any. */
export async function bootstrap(): Promise<void> {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev) => {
      if (ev.data === 'signed-out' && state.status !== 'signedOut') endSession('You signed out in another tab.', false);
      const msg = ev.data as { type?: string; from?: string; to?: string } | null;
      if (msg && msg.type === 'rotated' && msg.from && msg.to) {
        const stored = readRefreshToken();
        if (stored && stored.token === msg.from) writeRefreshToken(msg.to, stored.remember);
      }
    };
  }
  setAuthBridge({
    getAccessToken: () => tokens?.accessToken ?? null,
    refresh,
    onAuthLost: () => endSession('Your session has ended. Please sign in again.'),
  });
  const stored = readRefreshToken();
  if (!stored) {
    setState({ status: 'signedOut' });
    return;
  }
  const ok = await refresh();
  if (!ok) {
    if (state.status !== 'signedOut') setState({ status: 'signedOut' });
    return;
  }
  const claims = tokens?.claims ?? null;
  const base = {
    accountId: claims?.sub ?? null,
    sessionId: claims?.session_id ?? null,
    roles: rolesOf(claims),
    endedReason: null,
  };
  if (!isVendor(claims)) setState({ ...base, status: 'notVendor' });
  else if (needsPasswordFlag()) setState({ ...base, status: 'needsPassword' });
  else setState({ ...base, status: 'signedIn' });
}

/** After an application is approved: refresh to pick up the Vendor role, then re-run the gate. */
export async function recheckRoles(): Promise<AuthStatus> {
  const ok = await refresh();
  if (!ok) return state.status;
  const claims = tokens?.claims ?? null;
  const roles = rolesOf(claims);
  if (!isVendor(claims)) {
    setState({ roles, status: 'notVendor' });
    return 'notVendor';
  }
  const next: AuthStatus = needsPasswordFlag() ? 'needsPassword' : 'signedIn';
  setState({ roles, status: next });
  return next;
}

/** Sign out of this browser: revoke this session on the server, then forget it here. */
export async function signOut(): Promise<void> {
  const { accountId, sessionId } = state;
  const stored = readRefreshToken();
  try {
    if (accountId && sessionId && tokens) await authApi.revokeSession(accountId, sessionId);
    else if (stored && tokens) await authApi.logout(stored.token);
  } catch {
    // The local sign-out still happens; the refresh token is forgotten either way.
  }
  endSession(null);
}

/** Sign out of every device (StyleMint app included). */
export async function signOutEverywhere(): Promise<void> {
  try {
    await authApi.logoutEverywhere();
  } finally {
    endSession('You signed out of all devices.');
  }
}

/** Tests only. */
export function __resetSessionForTests() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  tokens = null;
  inflight = null;
  state = initial;
  clearStorage();
  setAuthBridge({
    getAccessToken: () => tokens?.accessToken ?? null,
    refresh,
    onAuthLost: () => endSession('Your session has ended. Please sign in again.'),
  });
  emit();
}
