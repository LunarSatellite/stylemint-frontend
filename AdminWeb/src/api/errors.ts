/**
 * The server's error vocabulary. UI switches on `code` (the API's `errorCode`), not on the HTTP status: a 401 can
 * mean "expired", "revoked" or "replayed", and a 403 can mean "wrong role" or "confirm with your authenticator".
 *
 * The API answers in up to six shapes depending on which layer refused (ErrorResponseVm with `title` + `errors[]`,
 * the role filter's bare object, the step-up 403, the session middleware's problem+json, ASP.NET's
 * ValidationProblemDetails with `errors{}` and no errorCode, and PascalCase bodies from the exception handler), so
 * parsing is defensive.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(init: {
    status: number;
    message: string;
    code?: string;
    correlationId?: string;
    fieldErrors?: Record<string, string[]>;
    retryAfter?: number;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.fieldErrors = init.fieldErrors;
    this.retryAfter = init.retryAfter;
  }

  get isOffline() {
    return this.status === 0;
  }
  get isStepUp() {
    return this.code === 'admin.step_up.required' || this.code === 'mfa.step_up_required';
  }
  get isForbidden() {
    return this.status === 403 && !this.isStepUp && this.code !== 'admin.ip.not_allowed';
  }
  get isNotFound() {
    return this.status === 404;
  }
  /** 404 or 405 on a route the server does not have (yet): a missing feature, not a missing record. */
  get isMissingEndpoint() {
    return (this.status === 404 && !this.code) || this.status === 405 || this.status === 501;
  }
  get isConflict() {
    return this.status === 409;
  }
}

const KNOWN: Record<string, string> = {
  'auth.unauthorized': 'Your sign-in was not accepted. Please sign in again.',
  'auth.token_expired': 'Your session expired. Please sign in again.',
  'auth.token_reuse_detected': 'A security issue was detected with your session. Please sign in again.',
  'auth.session_revoked': 'Your session was ended. Please sign in again.',
  'auth.forbidden': 'Your roles do not allow this.',
  'admin.session.revoked': 'Your session was ended. Please sign in again.',
  'admin.session.expired': 'Your session expired. Please sign in again.',
  'admin.session.unknown': 'Your session is no longer recognised. Please sign in again.',
  'admin.session.jti_missing': 'Your session is not valid. Please sign in again.',
  'admin.ip.not_allowed': 'Admin access is not allowed from this network.',
  'admin.rate_limited': 'Too many sign-in attempts from here. Wait a minute and try again.',
  'admin.mfa.required': 'Your identity-provider sign-in did not include multi-factor authentication, which StyleMint admin requires.',
  'admin.acr.insufficient': 'Your identity-provider sign-in was not strong enough for StyleMint admin.',
  'admin.step_up.required': 'Confirm it is you with your authenticator code to continue.',
  'mfa.step_up_required': 'Confirm it is you with your authenticator code to continue.',
  'admin.mfa.invalid_code': 'That code is not right. Check your authenticator app and try again.',
  'admin.mfa.locked': 'Too many wrong codes. Two-step verification is locked for 15 minutes.',
  'admin.mfa.not_enrolled': 'Set up two-step verification first (My security).',
  'admin.mfa.already_enrolled': 'Two-step verification is already set up.',
  'admin.mfa.already_confirmed': 'Two-step verification is already confirmed.',
  'state.concurrency_conflict': 'Someone else changed this a moment ago. Reload and try again.',
  'state.invalid_transition': 'That action is not allowed in the item’s current state.',
  'resource.not_found': 'This item no longer exists.',
  'system.rate_limited': 'Too many requests. Please wait a moment and try again.',
  'system.internal_error': 'Something went wrong on the server.',
  'system.service_unavailable': 'A service this needs is unavailable right now. Try again shortly.',
};

/** Codes whose meaning the operator must act on in a specific way: our wording beats the server's. */
const PREFER_OWN = /^(auth\.|mfa\.|admin\.(account|session|mfa|acr|ip|rate_limited|step_up))/;

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export function parseErrorBody(status: number, body: unknown, retryAfter?: number): ApiError {
  const obj = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const code = pickString(obj, 'errorCode', 'ErrorCode');
  const correlationId = pickString(obj, 'correlationId', 'CorrelationId', 'traceId');

  let fieldErrors: Record<string, string[]> | undefined;
  const rawErrors = obj.errors ?? obj.Errors;
  if (Array.isArray(rawErrors)) {
    fieldErrors = {};
    for (const e of rawErrors as Record<string, unknown>[]) {
      const key = (e?.field ?? e?.Field ?? '_') as string;
      (fieldErrors[key] ??= []).push(String(e?.message ?? e?.Message ?? 'is not valid'));
    }
  } else if (rawErrors && typeof rawErrors === 'object') {
    fieldErrors = rawErrors as Record<string, string[]>;
  }

  // ErrorResponseVm carries the human sentence in `title`; ValidationProblemDetails' title is generic.
  const generic = /^One or more validation errors occurred\.?$|^Unauthorized$|^Forbidden$|^Too Many Requests$/i;
  let serverMessage = pickString(obj, 'message', 'Message', 'title', 'Title');
  if (serverMessage && generic.test(serverMessage)) serverMessage = undefined;

  const message =
    (code && PREFER_OWN.test(code) ? KNOWN[code] : undefined) ??
    serverMessage ??
    (code ? KNOWN[code] : undefined) ??
    (status === 401
      ? 'Your session ended. Please sign in again.'
      : status === 403
        ? 'Your roles do not allow this.'
        : status === 404
          ? 'Not found.'
          : status === 429
            ? KNOWN['system.rate_limited']!
            : status >= 500
              ? 'The server had a problem. Try again in a moment.'
              : 'The request was not accepted.');

  const details =
    fieldErrors && Object.keys(fieldErrors).length > 0
      ? Object.values(fieldErrors)
          .flat()
          .filter((m) => m && m !== message)
          .slice(0, 3)
          .join(' ')
      : '';
  return new ApiError({ status, code, correlationId, fieldErrors, retryAfter, message: details ? `${message} ${details}` : message });
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
