# Error Codes — stylemint-brand-fe

Switch on `errorCode` string. Never switch on HTTP status number.

```ts
export const errorMessages: Record<string, string> = {
  'auth.unauthorized':           'Your session is invalid. Please log in.',
  'auth.token_expired':          'Your session expired. Please log in again.',
  'auth.token_reuse_detected':   'A security issue was detected. Please log in again.',
  'auth.forbidden':              'You do not have permission to do this.',
  'resource.not_found':          'This item no longer exists.',
  'state.invalid_transition':    'This action is not allowed in the current state.',
  'state.concurrency_conflict':  'Someone else changed this. Refreshing…',
  'rule.commission_out_of_range':'Commission exceeds the vendor ceiling.',
  'system.rate_limited':         'Too many requests. Please wait.',
  'system.internal_error':       'Something went wrong.',
  'validation.multiple_errors':  'Please fix the errors below.',
}
```

Every error toast must include `correlationId` for support tracing.
