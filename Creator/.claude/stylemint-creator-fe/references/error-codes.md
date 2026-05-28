# Error Codes — stylemint-creator-fe

Switch on `errorCode` string. Never switch on HTTP status number — the same HTTP status can carry different error codes with different UX implications.

## Error Message Registry

```ts
// src/lib/errorMessages.ts
export const errorMessages: Record<string, string> = {
  'auth.unauthorized':          'Your session is invalid. Please log in.',
  'auth.token_expired':         'Your session expired. Please log in again.',
  'auth.token_reuse_detected':  'A security issue was detected. Please log in again.',
  'auth.forbidden':             'You do not have permission to do this.',
  'resource.not_found':         'This item no longer exists.',
  'state.invalid_transition':   'This action is not allowed at this time.',
  'state.concurrency_conflict': 'Someone else changed this. Refreshing…',
  'system.rate_limited':        'Too many requests. Please wait.',
  'system.internal_error':      'Something went wrong.',
  'validation.multiple_errors': 'Please fix the errors below.',
}
// state.duplicate is NOT in this registry — silently swallowed on recipe citation
```

## showErrorToast

```ts
// src/api/errors.ts
export function showErrorToast(err: unknown) {
  const errorCode = isAxiosError(err) ? err.response?.data?.errorCode : undefined
  const correlationId = isAxiosError(err) ? err.response?.data?.correlationId : undefined
  const message = (errorCode && errorMessages[errorCode]) ?? 'Something went wrong.'

  toast.error(message, {
    description: correlationId ? `Reference: ${correlationId}` : undefined,
  })
}
```

Every error toast must include `correlationId` for support tracing. Never show raw error messages from the server.

## Special Cases

### /analyze 429 — Soft Message

Do NOT call `showErrorToast`. Use a soft info toast:

```ts
if (code === 'system.rate_limited') {
  const retry = Number(err.response?.headers['retry-after']) || 30
  toast.info(`Still working on your briefing. Try again in ${retry}s.`)
  disableButtonFor(retry * 1000)
  return
}
```

This is not the user's fault. Never show the generic rate limit message for this endpoint.

### Recipe Citation 409 — Silent Swallow

```ts
onError: (err) => {
  if (err.response?.data?.errorCode === 'state.duplicate') return
  showErrorToast(err)
},
```

`state.duplicate` means the user already cited this recipe. It is expected and not an error worth surfacing.

### state.concurrency_conflict

After showing the toast, invalidate the affected query so the user sees fresh data:

```ts
onError: (err) => {
  if (err.response?.data?.errorCode === 'state.concurrency_conflict') {
    showErrorToast(err)
    queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
    return
  }
  showErrorToast(err)
},
```

### auth.token_reuse_detected / auth.token_expired

Call `useAuth.getState().clear()` and redirect to `/login`:

```ts
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.data?.errorCode
    if (code === 'auth.token_reuse_detected' || code === 'auth.token_expired') {
      useAuth.getState().clear()
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)
```
