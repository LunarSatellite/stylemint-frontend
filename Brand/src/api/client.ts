import { newIdempotencyKey } from '../lib/id';

/**
 * The one HTTP client. Same origin: every path is `/v1/...` on the host that served the app
 * (nginx proxies it to the API), so there is no base URL and no CORS.
 *
 * - Adds the bearer token from the auth session.
 * - On 401 asks the session to refresh once (single flight) and retries; if that fails the
 *   session signs out everywhere.
 * - Adds an `Idempotency-Key` to every POST/PUT/PATCH/DELETE (the backend dedupes retries on it).
 * - Turns RFC 7807 problem details into ApiError with the backend's `errorCode`.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errorCode?: string;
  code?: string;
  errors?: Record<string, string[] | string> | { field?: string; message?: string }[];
  traceId?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly problem: ProblemDetails | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, message: string, code: string | null, problem: ProblemDetails | null, retryAfter: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.problem = problem;
    this.retryAfterSeconds = retryAfter;
  }

  get isOffline() {
    return this.status === 0;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  /** Field → first message, from ASP.NET validation problems. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const errors = this.problem?.errors;
    if (!errors) return out;
    if (Array.isArray(errors)) {
      for (const e of errors) if (e?.field) out[lowerFirst(e.field)] = e.message ?? 'Invalid';
    } else {
      for (const [k, v] of Object.entries(errors)) out[lowerFirst(k)] = Array.isArray(v) ? v[0] : String(v);
    }
    return out;
  }
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** A human sentence for any error, preferring the server's own words. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/** What the client needs from the auth session. Wired by auth/session.ts at start-up. */
export interface AuthBridge {
  getAccessToken(): string | null;
  /** Refresh tokens; resolves true when a new access token is available. */
  refresh(): Promise<boolean>;
  /** Called when a refresh failed: clear the session and go to sign-in. */
  onAuthLost(): void;
}

let bridge: AuthBridge | null = null;
export function setAuthBridge(b: AuthBridge | null) {
  bridge = b;
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  /** JSON body. */
  body?: unknown;
  /** Multipart body (file uploads). */
  form?: FormData;
  /** No bearer token, no refresh-on-401 (sign-in endpoints). */
  anonymous?: boolean;
  /** Pass a stable key to make a retried user action idempotent; otherwise a new one per call. */
  idempotencyKey?: string | false;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Return the raw Response (for blobs / HTML). */
  raw?: boolean;
}

export function buildUrl(path: string, query?: Query): string {
  const url = path.startsWith('http') ? path : path.startsWith('/') ? path : `/${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
    else params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: ProblemDetails | null = null;
  try {
    const text = await res.text();
    if (text) problem = JSON.parse(text) as ProblemDetails;
  } catch {
    problem = null;
  }
  const code = (problem?.errorCode as string) ?? (problem?.code as string) ?? null;
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) || null : null;
  return new ApiError(res.status, describe(res.status, problem, code), code, problem, retryAfter);
}

function describe(status: number, problem: ProblemDetails | null, code: string | null): string {
  // StyleMint's ErrorResponseVm carries the human message in `title` (no `detail`); ASP.NET's own
  // ValidationProblemDetails carries `errors` as a dictionary. Both shapes are handled.
  const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
  if (detail) return detail;
  const title = typeof problem?.title === 'string' ? problem.title.trim() : '';
  const genericTitle = !title || /validation errors|validation failed|^bad request$/i.test(title);
  const errors = problem?.errors;
  if (genericTitle && errors) {
    if (Array.isArray(errors)) {
      const first = errors.find((e) => e?.message);
      if (first?.message) return first.message;
    } else {
      const first = Object.values(errors)[0];
      if (first) return Array.isArray(first) ? first[0] : String(first);
    }
  }
  if (title && !genericTitle) return title;
  if (status === 401) return 'Your session has ended. Please sign in again.';
  if (status === 403) return 'Your account is not allowed to do this.';
  if (status === 404) return 'Not found.';
  if (status === 409) return 'This changed in the meantime. Refresh and try again.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'StyleMint had a problem handling that. Please try again shortly.';
  return code ? code : `Request failed (${status}).`;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const method = opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET' && opts.idempotencyKey !== false) {
    headers['Idempotency-Key'] = opts.idempotencyKey || newIdempotencyKey();
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  try {
    return await fetch(buildUrl(path, opts.query), { method, headers, body, signal: opts.signal, credentials: 'same-origin' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Could not reach StyleMint. Check your connection.', 'network', null);
  }
}

export async function requestRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  const token = opts.anonymous ? null : (bridge?.getAccessToken() ?? null);
  let res = await send(path, opts, token);
  if (res.status === 401 && !opts.anonymous && bridge) {
    // A refused refresh ends the session itself; a transient failure (offline, 5xx) keeps it and
    // this request simply fails.
    const refreshed = await bridge.refresh();
    if (refreshed) {
      res = await send(path, opts, bridge.getAccessToken());
      if (res.status === 401) bridge.onAuthLost();
    }
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await requestRaw(path, opts);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  const type = res.headers.get('Content-Type') ?? '';
  if (type.includes('json') || text.startsWith('{') || text.startsWith('[')) return JSON.parse(text) as T;
  return text as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts: Omit<RequestOptions, 'query' | 'method'> = {}) =>
    request<T>(path, { ...opts, query, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(path, { ...opts, body: body ?? {}, method: 'POST' }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(path, { ...opts, body: body ?? {}, method: 'PUT' }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(path, { ...opts, body: body ?? {}, method: 'PATCH' }),
  del: <T>(path: string, opts: Omit<RequestOptions, 'method'> = {}) => request<T>(path, { ...opts, method: 'DELETE' }),
  upload: <T>(path: string, form: FormData, opts: Omit<RequestOptions, 'form' | 'method'> = {}) =>
    request<T>(path, { ...opts, form, method: 'POST' }),
};

/** Is this a "the endpoint is not deployed yet" answer? Used to hide optional features. */
export function isMissingEndpoint(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501) && !error.code;
}
