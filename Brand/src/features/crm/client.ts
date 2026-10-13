import { ApiError, buildUrl, type ProblemDetails, type Query } from '../../api/client';
import { camelizeKeys, redactPii } from './redact';
import { crmSession } from './session';

/**
 * The CRM HTTP client — separate from the StyleMint client because the CRM (OmniFlow) API differs:
 *
 * - Paths live under `/api/v1/crm/...` on the same origin (nginx proxies `/api` to the API).
 * - Bearer = the CRM session token from `POST /v1/vendor/crm/session`, not the StyleMint token.
 *   On 401 the session is re-requested once and the call retried.
 * - Responses are enveloped: `{ success, data, message, errorCode?, errors? }`; paged lists are
 *   `{ success, data: [...], totalCount, pageNumber, pageSize, totalPages }` (or a `PagedResult`
 *   `{ items, totalCount, page, pageSize }` inside `data`). Errors are `{ success:false, message }`
 *   or ASP.NET problem details. All of it is normalised here.
 * - Enums are integers, keys camelCase (PascalCase keys are camelised defensively).
 * - Every response is passed through `redactPii`: no buyer phone/email ever reaches a component.
 */

export const CRM_BASE = '/api/v1/crm';

export interface CrmPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Envelope {
  success?: boolean;
  data?: unknown;
  message?: string;
  errorCode?: string;
  errors?: unknown;
  totalCount?: number;
  pageNumber?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface CrmRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

/** Thrown when there is no CRM session to call with (the CRM gate normally prevents this). */
export class CrmUnavailableError extends ApiError {
  constructor() {
    super(503, 'The CRM is not available right now.', 'crm.unavailable', null);
    this.name = 'CrmUnavailableError';
  }
}

function crmUrl(path: string, query?: Query) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return buildUrl(`${CRM_BASE}${p}`, query);
}

async function send(path: string, opts: CrmRequestOptions, token: string): Promise<Response> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  try {
    return await fetch(crmUrl(path, opts.query), { method, headers, body, signal: opts.signal, credentials: 'same-origin' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Could not reach StyleMint. Check your connection.', 'network', null);
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return camelizeKeys(JSON.parse(text));
  } catch {
    return text;
  }
}

function firstError(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const first = errors.find((e) => typeof e === 'string' || (e && typeof e === 'object' && 'message' in e));
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') return String((first as { message?: unknown }).message ?? '') || null;
    return null;
  }
  if (typeof errors === 'object') {
    const v = Object.values(errors as Record<string, unknown>)[0];
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v ? String(v) : null;
  }
  return null;
}

function describe(status: number, json: unknown): { message: string; code: string | null } {
  const o = (json && typeof json === 'object' ? json : {}) as Envelope & ProblemDetails;
  const code = (o.errorCode as string) ?? (o.code as string) ?? null;
  const fromBody =
    (typeof o.message === 'string' && o.message.trim()) ||
    (typeof o.detail === 'string' && o.detail.trim()) ||
    firstError(o.errors) ||
    (typeof o.title === 'string' && !/validation errors/i.test(o.title) && o.title.trim()) ||
    '';
  if (fromBody) return { message: fromBody, code };
  if (status === 401) return { message: 'Your CRM session has ended. Please reload the page.', code };
  if (status === 403) return { message: 'This part of the CRM is not available for your account.', code };
  if (status === 404) return { message: 'Not found.', code };
  if (status === 409) return { message: 'This changed in the meantime. Refresh and try again.', code };
  if (status === 429) return { message: 'Too many requests. Please wait a moment and try again.', code };
  if (status >= 500) return { message: 'The CRM had a problem handling that. Please try again shortly.', code };
  return { message: code ?? `Request failed (${status}).`, code };
}

function toError(status: number, json: unknown): ApiError {
  const { message, code } = describe(status, json);
  const problem = json && typeof json === 'object' ? (json as ProblemDetails) : null;
  return new ApiError(status, message, code, problem);
}

/** Peel the `{ success, data }` envelope. Paged envelopes keep their paging fields. */
function unwrap(json: unknown, status: number): unknown {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !('success' in json)) return json;
  const env = json as Envelope;
  if (env.success === false) throw toError(status >= 400 ? status : 400, json);
  if (Array.isArray(env.data) && typeof env.totalCount === 'number') {
    return {
      items: env.data,
      totalCount: env.totalCount,
      page: env.pageNumber ?? env.page ?? 1,
      pageSize: env.pageSize ?? env.data.length,
      totalPages: env.totalPages,
    };
  }
  return env.data;
}

export async function crmRequest<T>(path: string, opts: CrmRequestOptions = {}): Promise<T> {
  let token = await crmSession.acquire();
  if (!token) throw new CrmUnavailableError();
  let res = await send(path, opts, token);
  if (res.status === 401) {
    token = await crmSession.acquire(true);
    if (!token) throw new CrmUnavailableError();
    res = await send(path, opts, token);
  }
  const json = await readJson(res);
  if (!res.ok) throw toError(res.status, json);
  return redactPii(unwrap(json, res.status)) as T;
}

/** Any list shape → a page: an array, a `PagedResult`, or an unwrapped paged envelope. */
export function toPage<T>(value: unknown, requested?: { page?: number; pageSize?: number }): CrmPage<T> {
  if (Array.isArray(value)) {
    return { items: value as T[], totalCount: value.length, page: 1, pageSize: value.length || 1, totalPages: 1 };
  }
  const v = (value ?? {}) as { items?: T[]; totalCount?: number; page?: number; pageNumber?: number; pageSize?: number; totalPages?: number };
  const items = Array.isArray(v.items) ? v.items : [];
  const pageSize = v.pageSize || requested?.pageSize || items.length || 1;
  const totalCount = typeof v.totalCount === 'number' ? v.totalCount : items.length;
  const totalPages = v.totalPages || Math.max(1, Math.ceil(totalCount / pageSize));
  return { items, totalCount, page: v.page ?? v.pageNumber ?? requested?.page ?? 1, pageSize, totalPages };
}

export const crm = {
  get: <T>(path: string, query?: Query) => crmRequest<T>(path, { method: 'GET', query }),
  page: async <T>(path: string, query: Query & { page?: number; pageSize?: number } = {}) =>
    toPage<T>(await crmRequest<unknown>(path, { method: 'GET', query }), { page: query.page, pageSize: query.pageSize }),
  post: <T>(path: string, body?: unknown) => crmRequest<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => crmRequest<T>(path, { method: 'PUT', body: body ?? {} }),
  del: <T>(path: string) => crmRequest<T>(path, { method: 'DELETE' }),
};
