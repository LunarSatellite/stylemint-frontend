import { api, ApiError } from '../../api/client';
import { session as authSession } from '../../auth/session';
import { normalizeRole, type CrmRole } from './roles';

/**
 * The seller's CRM session, outside React so the CRM client can use it.
 *
 * `POST /v1/vendor/crm/session` (StyleMint vendor token) exchanges the seller's StyleMint session
 * for a short-lived OmniFlow CRM token scoped to the seller's own CRM workspace:
 * `{ accessToken, expiresUtc, tenantId, role }`.
 *
 * - The CRM token lives in memory only; it is re-requested a minute before `expiresUtc`, and on
 *   any 401 from the CRM API (one retry).
 * - Acquisition is single-flight: concurrent callers share one request.
 * - 404 (endpoint not deployed yet) or 503 `seller_crm.disabled` → `unavailable`: the UI says
 *   "CRM is being set up" instead of an error. 403 (`seller_crm.not_a_vendor`) → `forbidden`.
 *   409 `seller_crm.ambiguous_vendor` and anything else → `error`, with the server's message.
 * - Signing out of StyleMint drops the CRM token too.
 */

export const CRM_SESSION_PATH = '/v1/vendor/crm/session';

/** Refresh this long before the token expires. */
const REFRESH_LEAD_MS = 60_000;
const MIN_DELAY_MS = 5_000;
const DEFAULT_LIFETIME_MS = 15 * 60_000;

export type CrmSessionStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error';

export interface CrmSessionState {
  status: CrmSessionStatus;
  tenantId: string | null;
  role: CrmRole | null;
  /** Optional narrowing of the CRM areas, when the session response lists them. */
  areas: string[] | null;
  businessName: string | null;
  error: unknown;
}

export interface CrmSessionResponse {
  accessToken: string;
  expiresUtc: string;
  tenantId: string;
  role: string | number;
  vendorAccountId?: string | null;
  businessName?: string | null;
  areas?: string[] | null;
}

const initial: CrmSessionState = { status: 'idle', tenantId: null, role: null, areas: null, businessName: null, error: null };

let state: CrmSessionState = initial;
let token: { value: string; expiresMs: number } | null = null;
let inflight: Promise<string | null> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Bumped on reset so a request started before sign-out cannot install its token after it. */
let generation = 0;
const listeners = new Set<() => void>();

function setState(patch: Partial<CrmSessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!token) return;
  const delay = Math.max(MIN_DELAY_MS, token.expiresMs - Date.now() - REFRESH_LEAD_MS);
  timer = setTimeout(() => {
    void acquire(true);
  }, delay);
}

function classify(error: unknown): CrmSessionStatus {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 405 || error.status === 501) return 'unavailable';
    if (error.status === 503 && error.code === 'seller_crm.disabled') return 'unavailable';
    if (error.status === 403) return 'forbidden';
  }
  return 'error';
}

/**
 * Get a CRM token, asking the server when there is none or `force` is set. Resolves null when
 * the CRM is unavailable / forbidden / failed (the state says which).
 */
export function acquire(force = false): Promise<string | null> {
  if (!force && token && token.expiresMs - Date.now() > REFRESH_LEAD_MS / 2) return Promise.resolve(token.value);
  if (inflight) return inflight;
  const gen = generation;
  // Keep showing the current state while a background refresh runs; only a first acquisition shows "loading".
  if (state.status !== 'ready') setState({ status: 'loading', error: null });
  inflight = api
    .post<CrmSessionResponse>(CRM_SESSION_PATH, {})
    .then((res) => {
      if (gen !== generation) return null;
      if (!res?.accessToken) throw new ApiError(502, 'The CRM did not return a session.', 'crm.session_invalid', null);
      const expires = Date.parse(res.expiresUtc);
      token = { value: res.accessToken, expiresMs: Number.isFinite(expires) ? expires : Date.now() + DEFAULT_LIFETIME_MS };
      schedule();
      setState({
        status: 'ready',
        tenantId: res.tenantId ?? null,
        role: normalizeRole(res.role),
        areas: Array.isArray(res.areas) ? res.areas : null,
        businessName: res.businessName ?? null,
        error: null,
      });
      return token.value;
    })
    .catch((error: unknown) => {
      if (gen !== generation) return null;
      token = null;
      schedule();
      setState({ status: classify(error), error, role: null, tenantId: null, areas: null, businessName: null });
      return null;
    })
    .finally(() => {
      if (gen === generation) inflight = null;
    });
  return inflight;
}

/** The current token, without asking the server. */
export function currentToken(): string | null {
  return token?.value ?? null;
}

/** Forget everything (sign-out, tests). */
export function resetCrmSession() {
  generation += 1;
  if (timer) clearTimeout(timer);
  timer = null;
  token = null;
  inflight = null;
  state = initial;
  listeners.forEach((l) => l());
}

export const crmSession = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  acquire,
  currentToken,
  reset: resetCrmSession,
};

// Drop the CRM token the moment the StyleMint session ends — nothing from one seller may leak to the next.
let lastAccountId = authSession.getState().accountId;
authSession.subscribe(() => {
  const s = authSession.getState();
  const accountChanged = s.accountId !== lastAccountId;
  lastAccountId = s.accountId;
  if ((s.status !== 'signedIn' || accountChanged) && state.status !== 'idle') resetCrmSession();
});
