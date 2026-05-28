# Error Codes — stylemint-admin-fe

Switch on `errorCode` string always. Never switch on HTTP status number.

## Error message registry

```ts
// src/api/errors.ts
export const errorMessages: Record<string, string> = {
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
```

## showErrorToast — always include correlationId

```ts
// src/components/CorrelationToast.tsx
export function showErrorToast(err: unknown) {
  const e = err as AxiosError<ErrorResponse>
  const code = e.response?.data?.errorCode ?? 'system.internal_error'
  const correlationId = e.response?.data?.correlationId
  toast.error(getErrorMessage(code), {
    description: correlationId ? `Ref: ${correlationId}` : undefined,
    duration: 8000,
  })
}
```

## 429 rate limit handling

```ts
if (code === 'system.rate_limited') {
  const retryAfter = Number(err.response?.headers['retry-after']) || 30
  disableButtonFor(retryAfter * 1000)
  toast.warning(`Too many requests. Try again in ${retryAfter}s.`)
}
```

Never auto-retry on 429. Always let the user re-trigger.

## concurrency_conflict handling

```ts
if (code === 'state.concurrency_conflict') {
  queryClient.invalidateQueries({ queryKey: affectedKey })
  toast.warning('Someone else changed this. Refreshing…')
}
```

## validation.multiple_errors

```ts
if (code === 'validation.multiple_errors') {
  const errors = e.response?.data?.errors as ValidationError[]
  errors.forEach(({ field, message }) => form.setError(field, { message }))
}
```
