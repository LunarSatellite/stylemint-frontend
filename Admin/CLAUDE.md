# stylemint-admin-fe

Internal desktop SPA for Style Mint operators. Consumes `/v1/admin/*`.
Desktop only — 1280px minimum width. No mobile support.

---

## CLAUDE.md vs Memory

**CLAUDE.md** is primary — rules, invariants, and conventions go here. Loaded every conversation, checked into git, seen by the whole team. Hard constraints I must follow.

**Memory** is secondary — captures mistakes made, feedback given, and the *why* behind rules. Personal to the user, not the project. A backup reinforcement layer.

Rule: if something is worth enforcing → **put it in CLAUDE.md**. Memory alone is not sufficient for project rules.

**Before writing any code**, read the relevant reference file:
- Architecture + design decisions → `.claude/references/architecture.md` ← start here
- Performance patterns + bundle config → `.claude/references/performance.md`
- Folder layout → `.claude/references/folder-structure.md`
- Auth + MFA flows → `.claude/references/auth-flow.md`
- Query keys + staleTime → `.claude/references/query-keys.md`
- Error codes + messages → `.claude/references/error-codes.md`
- Enums → `.claude/references/enums.md`
- Design tokens → `.claude/references/design-tokens.md`

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 data routers ·
TanStack Query v5 · Zustand · axios · React Hook Form + Zod ·
shadcn/ui (Radix + Tailwind) · TanStack Table v8 · TanStack Virtual ·
date-fns + date-fns-tz · sonner · lucide-react · qrcode.react ·
clsx + tailwind-merge · openapi-typescript · Vitest · Playwright

---

## Environment

```ts
// src/env.ts — throws on startup if any variable is missing
export const env = {
  apiBaseUrl:     import.meta.env.VITE_API_BASE_URL as string,
  ssoAuthority:   import.meta.env.VITE_SSO_AUTHORITY as string,
  ssoClientId:    import.meta.env.VITE_SSO_CLIENT_ID as string,
  ssoRedirectUri: import.meta.env.VITE_SSO_REDIRECT_URI as string,
}
for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`Missing env variable: ${k}`)
}
```

---

## Type generation

```bash
npm run codegen
# openapi-typescript http://localhost:5020/swagger/v1/swagger.json -o src/api/schema.ts
```

Commit `src/api/schema.ts` to git. Never regenerate in CI. Import types as:
`import type { components } from '@/api/schema'`

---

## Axios interceptor chain

Every request automatically gets: Bearer token, Idempotency-Key (mutations),
Accept-Language, and 401 routing by `errorCode` (not HTTP status).

```ts
// src/api/client.ts
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token && !config.url?.endsWith('/auth/sso'))
    config.headers.Authorization = `Bearer ${token}`
  if (['post','patch','put','delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})
api.interceptors.response.use(res => res, async (err) => {
  const code = err.response?.data?.errorCode
  if (err.response?.status === 401) {
    if (code === 'auth.token_reuse_detected') {
      useAuth.getState().clear()
      window.location.assign('/login?reason=security')
      return Promise.reject(err)
    }
    if (code === 'auth.session_revoked') {
      useAuth.getState().clear()
      window.location.assign('/login?reason=revoked')
      return Promise.reject(err)
    }
    const ok = await trySilentRefresh()
    if (!ok) { useAuth.getState().clear(); window.location.assign('/login?reason=expired') }
  }
  return Promise.reject(err)
})
```

---

## Zustand auth store

```ts
// src/auth/store.ts
export const useAuth = create<AuthState>((set) => ({
  token: null, claims: null,
  setToken: (token) => set({ token, claims: parseJwt(token) }),
  clear: () => set({ token: null, claims: null }),
}))
```

Token in memory only. Never localStorage. Never cookies.

---

## State — what goes where

| Data                  | Store           |
|-----------------------|-----------------|
| Auth token + claims   | Zustand         |
| Step-up dialog open   | Zustand         |
| Everything else       | TanStack Query  |

---

## Step-up MFA

These 8 endpoints require step-up — always use `useMutationWithStepUp`:
`DELETE /auth/mfa/totp` · `POST|DELETE /admins/{id}/roles/{role}` ·
`POST /admins/{id}/disable` · `POST /admins/{id}/enable` ·
`POST /admins/{id}/sessions/revoke-all` · `DELETE /admins/{id}/mfa` ·
`POST /payouts/{id}/force-paid` · `POST /payouts/{id}/force-failed`

```ts
export function useMutationWithStepUp<TData, TVars>(fn, options?) {
  const openStepUp = useStepUpDialog((s) => s.open)
  return useMutation({
    mutationFn: async (vars: TVars) => {
      try { return await fn(vars) }
      catch (err: any) {
        if (err?.response?.data?.errorCode === 'mfa.step_up_required') {
          await openStepUp()
          return await fn(vars)
        }
        throw err
      }
    },
    onSuccess: options?.onSuccess,
  })
}
```

`<StepUpDialog/>` renders once in `AppShell`. Never per-page or per-feature.

---

## Mutation lifecycle

Every mutation follows this order:
1. Interceptor attaches `Idempotency-Key` automatically
2. `onSuccess` → invalidate narrowest query keys → success toast
3. `onError mfa.step_up_required` → `useMutationWithStepUp` handles it
4. `onError state.concurrency_conflict` → invalidate query → toast "Refreshing…"
5. `onError system.rate_limited` → read `Retry-After` → disable button → toast
6. All other errors → `showErrorToast(err)` — always includes `correlationId`

---

## Optimistic updates — KYC and moderation queues

```ts
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: qk.kyc.queue(filter) })
  const prev = queryClient.getQueryData(qk.kyc.queue(filter))
  queryClient.setQueryData(qk.kyc.queue(filter), old => updateItemState(old, vars))
  return { prev }
},
onError: (_e, _v, ctx) => queryClient.setQueryData(qk.kyc.queue(filter), ctx?.prev),
onSettled: () => queryClient.invalidateQueries({ queryKey: qk.kyc.queue(filter) }),
```

---

## Component structure

Every feature folder has three files:
- **Container** — calls hooks, owns data, handles actions
- **Presentation** — receives props, renders only (no `useQuery`/`useMutation`)
- **Form** — React Hook Form + Zod, calls mutation

---

## Permissions

Never check role strings inline. Always use `permissions.*()`:

```ts
// src/lib/permissions.ts
export const permissions = {
  canReviewKyc:       (r) => r.some(x => ['SuperAdmin','KycReviewer'].includes(x)),
  canModerateContent: (r) => r.some(x => ['SuperAdmin','ContentMod'].includes(x)),
  canManagePayouts:   (r) => r.some(x => ['SuperAdmin','PayoutsOps'].includes(x)),
  canManageAdmins:    (r) => r.includes('SuperAdmin'),
  canManageFlags:     (r) => r.some(x => ['SuperAdmin','SupportAgent'].includes(x)),
}
```

---

## Audit log — virtualization

Use `VirtualTable` (TanStack Virtual, 48px fixed row height). Never `DataTable`.
Debounce all filter inputs 300ms before firing queries.

---

## Error boundaries

Two levels — page and feature widget. Never wrap AppShell itself.

```tsx
<ErrorBoundary fallback={<PageErrorFallback />}>
  <FeatureSection />
  <ErrorBoundary fallback={<WidgetErrorFallback label="Stats" />}>
    <StatsWidget />
  </ErrorBoundary>
</ErrorBoundary>
```

---

## Hard invariants

- JWT in memory only — never `localStorage`, never cookies
- Switch on `errorCode` string — never on HTTP status number
- Step-up endpoints use `useMutationWithStepUp` — never plain `useMutation`
- `auth.token_reuse_detected` → security warning redirect, not expired message
- After login: check `hasTotp` — if false, redirect `/settings/mfa/setup` before anything
- `schema.ts` committed to git — never regenerate in CI
- Never create manual API type files anywhere — all API shapes come from `schema.ts` via `components['schemas']['...']`
- `src/types/` is for frontend-only types (UI state, component props) — never API DTOs or anything that mirrors a backend contract
- If the backend Swagger is unavailable, flag it and wait — never work around it by writing manual types
- Never import Radix primitives in features — only via `src/components/ui/`
- Permissions checked via `permissions.*()` — never inline role string checks
- KYC and moderation `staleTime` is 10 000 ms — do not increase
- `<StepUpDialog/>` renders once in AppShell only
- `initBroadcastLogout()` called once in `main.tsx` only
- Never `dangerouslySetInnerHTML` anywhere
- Audit log `payloadJson` renders as text, never HTML
- Never hardcode hex colors — use CSS variables from design tokens

### Enums
- Never use magic numbers for enum values — always use constants (`KycState.Pending` not `1`)
- Never re-declare enum values locally — always import from `@/lib/enums`

### Query keys + staleTime
- Never construct query key arrays inline — always use `qk.*()` from `src/api/queryKeys.ts`
- `staleTime: 0` is forbidden on any query — minimum is 10 000 ms for KYC/moderation, 30 000 ms default
- Never call `invalidateQueries` without a specific key — always use the narrowest `qk.*()` key

### Performance
- Every page in `router.tsx` must be lazy-loaded with `lazy()` + `Suspense` — no exceptions
- Never add `React.memo`, `useMemo`, or `useCallback` without React DevTools Profiler evidence
- All filter and search inputs must use `useDebounce(300)` before passing values to a query

### Error handling
- Never auto-retry on 429 — read `Retry-After`, disable the button, let the user re-trigger
- `validation.multiple_errors` → call `form.setError()` per field — never a generic toast
- All unhandled mutation errors must call `showErrorToast(err)` — never silent, never `console.error`

### Component boundaries
- `useQuery` or `useMutation` inside a presentation component is forbidden — containers only
- Server data must never be stored in Zustand — TanStack Query is the only server-state store

### Imports + folder rules
- All internal imports use the `@/` alias — never relative paths like `../../`
- No barrel `index.ts` inside `features/` — import directly from the file

---

## Custom Slash Commands

| Command       | Purpose                                              |
|---------------|------------------------------------------------------|
| `/component`  | Scaffold container + presentation + form triple      |
| `/query`      | Scaffold a TanStack Query `useQuery` hook            |
| `/mutation`   | Scaffold a mutation hook (with step-up MFA if needed)|
| `/page`       | Scaffold a page + register in router                 |
| `/form`       | Scaffold React Hook Form + Zod form                  |
| `/table`      | Scaffold DataTable or VirtualTable                   |
| `/test`       | Write Vitest + RTL tests for a component or hook     |
| `/perf`       | Audit and fix performance issues                     |
| `/guard`      | Scaffold RequireAuth / RequireRole guard             |
