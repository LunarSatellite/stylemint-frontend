/**
 * The one HTTP client. Same origin as the API (nginx proxies `/v1` to it), so paths are absolute and there is no
 * base URL to configure and no CORS.
 *
 * Everything a request needs to be correct - the bearer token, an Idempotency-Key on writes, the language - is
 * attached here so no call site can forget one. A 401 tries one silent refresh and replays the request; if that
 * fails the session ends everywhere.
 */
import { ApiError, parseErrorBody } from './errors';

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Sign-in calls go without a bearer and never trigger the refresh-and-retry. */
  anonymous?: boolean;
  headers?: Record<string, string>;
}

/** Hooks the auth module installs, so this file does not import it (and the cycle stays broken). */
interface SessionHooks {
  token: () => string | null;
  /** Gets a fresh access token; resolves false when the session cannot be continued. */
  refresh: () => Promise<boolean>;
  /** Ends the session locally with a reason shown on the sign-in screen. */
  expire: (reason: 'expired' | 'revoked' | 'security') => void;
}

let hooks: SessionHooks = {
  token: () => null,
  refresh: async () => false,
  expire: () => undefined,
};

export function installSessionHooks(next: SessionHooks): void {
  hooks = next;
}

export function buildUrl(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function send(path: string, options: RequestOptions, idempotencyKey: string | undefined): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': (typeof navigator !== 'undefined' && navigator.language) || 'en',
    ...options.headers,
  };
  if (!options.anonymous) {
    const token = hooks.token();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  try {
    return await fetch(buildUrl(path, options.query), { method, headers, body, signal: options.signal, credentials: 'same-origin' });
  } catch (cause) {
    if ((cause as { name?: string })?.name === 'AbortError') throw cause;
    throw new ApiError({ status: 0, message: 'The server could not be reached. Check your connection and try again.' });
  }
}

async function toError(response: Response): Promise<ApiError> {
  let parsed: unknown = undefined;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  const retryAfter = Number(response.headers.get('Retry-After'));
  return parseErrorBody(response.status, parsed, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  const type = response.headers.get('Content-Type') ?? '';
  if (type.includes('json') || text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // An HTML page where JSON was expected is a routing problem (a missing nginx rule), not data.
      throw new ApiError({ status: response.status, message: 'The server answered with something that is not data.' });
    }
  }
  return text as T;
}

/** One refresh at a time: twenty queries failing together share it rather than racing twenty refreshes. */
let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  refreshing ??= hooks.refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  // The same key on the replay after a refresh: it is the same write, and the server must treat it as one.
  const idempotencyKey = WRITES.has(method) ? newIdempotencyKey() : undefined;
  let response = await send(path, options, idempotencyKey);

  if (response.status === 401 && !options.anonymous) {
    const error = await toError(response);
    if (error.code === 'auth.token_reuse_detected') {
      hooks.expire('security');
      throw error;
    }
    if (error.code === 'auth.session_revoked' || error.code === 'admin.session.revoked') {
      hooks.expire('revoked');
      throw error;
    }
    const ok = await refreshOnce();
    if (!ok) {
      hooks.expire('expired');
      throw error;
    }
    response = await send(path, options, idempotencyKey);
    if (response.status === 401) {
      hooks.expire('expired');
      throw await toError(response);
    }
  }

  if (!response.ok) throw await toError(response);
  return read<T>(response);
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>(path, { method: 'POST', body, query }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};
