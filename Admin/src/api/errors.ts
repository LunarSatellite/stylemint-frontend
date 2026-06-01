import type { AxiosError } from 'axios'
import { toast } from 'sonner'

interface ErrorResponse {
  errorCode: string
  message: string
  correlationId?: string
  errors?: { field: string; message: string }[]
}

const errorMessages: Record<string, string> = {
  'auth.unauthorized':             'Your session is invalid. Please log in again.',
  'auth.token_expired':            'Your session expired. Please log in again.',
  'auth.token_reuse_detected':     'A security issue was detected. Please log in again.',
  'auth.session_revoked':          'Your session was ended. Please log in again.',
  'auth.forbidden':                'You do not have permission to do this.',
  'admin.account.disabled':        'This account has been disabled.',
  'admin.account.not_provisioned': 'This account is not set up for admin access.',
  'mfa.required':                  'MFA is required to continue.',
  'mfa.step_up_required':          'Please verify your identity to continue.',
  'mfa.totp.invalid_code':         'That code is incorrect. Please try again.',
  'mfa.totp.locked':               'Too many attempts. Please wait 15 minutes.',
  'state.concurrency_conflict':    'Someone else changed this. Refreshing…',
  'state.invalid_transition':      'This action is not allowed in the current state.',
  'resource.not_found':            'This item no longer exists.',
  'system.rate_limited':           'Too many requests. Please wait.',
  'system.internal_error':         'Something went wrong.',
  'validation.multiple_errors':    'Please fix the errors below.',
}

export function getErrorMessage(code: string): string {
  return errorMessages[code] ?? 'An unexpected error occurred.'
}

export function showErrorToast(err: unknown) {
  const e = err as AxiosError<ErrorResponse>
  const code = e.response?.data?.errorCode ?? 'system.internal_error'
  const correlationId = e.response?.data?.correlationId
  toast.error(getErrorMessage(code), {
    description: correlationId ? `Ref: ${correlationId}` : undefined,
    duration: 8000,
  })
}
