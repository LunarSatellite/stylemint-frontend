import type { AxiosError } from 'axios';

/**
 * The server's own error vocabulary, in English an operator can act on.
 *
 * Everything switches on `errorCode`, never on the HTTP status. A 401
 * can mean "log in again", "a token was replayed" or "your session was
 * ended by someone else", and those three want different screens; the
 * status says only that all three are 401.
 */
export interface ApiErrorBody {
  errorCode?: string;
  message?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

export const errorMessages: Record<string, string> = {
  'auth.unauthorized': 'Your session is invalid. Please log in again.',
  'auth.token_expired': 'Your session expired. Please log in again.',
  'auth.token_reuse_detected': 'A security issue was detected. Please log in again.',
  'auth.session_revoked': 'Your session was ended. Please log in again.',
  'auth.forbidden': 'You do not have permission to do this.',
  'admin.account.disabled': 'This account has been disabled.',
  'admin.account.not_provisioned': 'This account is not set up for admin access.',
  'mfa.required': 'MFA is required to continue.',
  'mfa.step_up_required': 'Please verify your identity to continue.',
  'mfa.totp.invalid_code': 'That code is incorrect. Please try again.',
  'mfa.totp.locked': 'Too many attempts. Please wait 15 minutes.',
  'state.concurrency_conflict': 'Someone else changed this. Refreshing…',
  'state.invalid_transition': 'This action is not allowed in the current state.',
  'resource.not_found': 'This item no longer exists.',
  'system.rate_limited': 'Too many requests. Please wait.',
  'system.internal_error': 'Something went wrong.',
  'validation.multiple_errors': 'Please fix the errors below.',
};

export function getErrorMessage(code: string | undefined): string {
  if (!code) return 'An unexpected error occurred.';
  return errorMessages[code] ?? 'An unexpected error occurred.';
}

export function errorCodeOf(err: unknown): string | undefined {
  return (err as AxiosError<ApiErrorBody> | undefined)?.response?.data?.errorCode;
}

export function correlationIdOf(err: unknown): string | undefined {
  return (err as AxiosError<ApiErrorBody> | undefined)?.response?.data?.correlationId;
}

/**
 * Seconds to wait after a 429, from the server's own header.
 *
 * Defaulted rather than guessed at the call site, and never used to
 * retry automatically: a console that retries a rate-limited write on
 * the operator's behalf is a console that submits the write twice.
 */
export function retryAfterSeconds(err: unknown, fallback = 30): number {
  const header = (err as AxiosError | undefined)?.response?.headers?.['retry-after'];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}
