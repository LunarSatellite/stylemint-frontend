---
name: stylemint-brand-fe
description: |
  Use this skill whenever working in the stylemint-brand-studio-frontend repo
  or building any vendor-facing feature for Style Mint. Trigger on: brief
  authoring, brief PATCH mutations, brief state transitions (lock, fork,
  retire), ROI recompute, vendor dashboard widgets, analytics charts, activity
  timeline, goal template management, vendor policy editor, query hooks,
  mutation hooks, routing, error handling, enums, formatters, or any component
  in this SPA. Also trigger when wiring vendor API endpoints, debugging
  concurrency conflicts, implementing the dirtyFields PATCH pattern, building
  ECharts canvas charts, scaffolding anything new in the brand studio
  frontend, writing tests, optimizing bundle/performance, or applying
  component conventions. Always use this skill before writing any code in
  this repo.
---

# stylemint-brand-fe

Vendor-facing SPA. Consumes `/v1/vendor/*` and `/v1/admin/brand-studio/*`.
Vendor role gates vendor surfaces. Admin role gates admin surfaces.

**Before writing any code**, read the relevant reference file:
- Architecture & design thinking → `references/architecture.md` ← **start here for any new feature**
- Auth, token, guards, interceptors → `references/auth.md`
- Folder layout → `references/folder-structure.md`
- Query keys + staleTime → `references/query-keys.md`
- Error codes + messages → `references/error-codes.md`
- Enums → `references/enums.md`
- Design tokens → `references/design-tokens.md`
- Testing patterns → `references/testing.md`
- Performance & code splitting → `references/performance.md`
- Component conventions & TypeScript → `references/component-conventions.md`

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 data routers ·
TanStack Query v5 · TanStack Virtual v3 · Zustand · axios · React Hook Form + Zod ·
Radix UI + Tailwind + clsx + tailwind-merge · TanStack Table v8 ·
ECharts Canvas via echarts-for-react · date-fns + date-fns-tz ·
sonner · lucide-react · openapi-typescript · Vitest 2 · MSW 2 · Playwright

---

## Environment

```ts
export const env = { apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string }
for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`Missing env variable: ${k}`)
}
```

---

## Type generation

```bash
npm run codegen  # → src/api/schema.ts
```

Commit `src/api/schema.ts`. Never regenerate in CI.

---

## Axios interceptor chain

```ts
api.interceptors.request.use((config) => {
  const { token, vendorAccountId } = useAuth.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post','patch','put','delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  if (vendorAccountId)   // only when multi-team vendor
    config.headers['X-Vendor-Account-Id'] = vendorAccountId
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})
```

Never send `X-Vendor-Account-Id` unless `vendorAccountId !== null` in Zustand.

---

## Zustand auth store

```ts
export const useAuth = create<AuthState>((set) => ({
  token: null, claims: null,
  vendorAccountId: null,         // only other persistent state
  draftingBrief: false,          // true during LLM draft (2-5s)
  setToken: (token) => set({ token, claims: parseJwt(token) }),
  setVendorAccountId: (id) => set({ vendorAccountId: id }),
  setDraftingBrief: (v) => set({ draftingBrief: v }),
  clear: () => set({ token: null, claims: null, vendorAccountId: null }),
}))
```

Token in memory only. Never localStorage. Never cookies.

---

## Auth token refresh + cross-tab logout

### Silent refresh

Refresh the JWT at 80% of its TTL — never on 401.

```ts
// auth/silentRefresh.ts
export function scheduleSilentRefresh(expiresAt: number) {
  const delay = (expiresAt - Date.now()) * 0.8
  return setTimeout(async () => {
    try {
      const { token } = await refreshToken()
      useAuth.getState().setToken(token)
      scheduleSilentRefresh(parseJwt(token).exp * 1000)
    } catch {
      useAuth.getState().clear()
      broadcastLogout()
    }
  }, delay)
}
```

Start the timer after every successful login and every successful silent refresh.

### BroadcastChannel logout

```ts
// auth/broadcastLogout.ts
const channel = new BroadcastChannel('sm_auth')

export const broadcastLogout = () => channel.postMessage({ type: 'logout' })

export function subscribeBroadcastLogout(onLogout: () => void) {
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'logout') onLogout()
  }
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}
```

Subscribe in `main.tsx`. On logout message: clear Zustand, navigate to `/login`.

---

## State — what goes where

| Data | Store |
|---|---|
| Auth token + claims | Zustand |
| Resolved vendor account ID | Zustand |
| `draftingBrief` loading flag | Zustand |
| Everything else | TanStack Query |

Brief body is large — `gcTime: 0` on brief detail to drop on unmount.

---

## Brief authoring — critical patterns

### LLM draft — no optimistic update

`POST /v1/vendor/briefs` triggers an LLM (2–5s). Result is unknown. Never use `onMutate` optimistic update.

```ts
// useDraftBrief.ts
onMutate: () => useAuth.getState().setDraftingBrief(true),
onSettled: () => useAuth.getState().setDraftingBrief(false),
onSuccess: (data) => {
  queryClient.setQueryData(bsQk.briefs.detail(data.id), data)
  navigate(`/briefs/${data.id}`)
},
```

When `draftingBrief === true` → render full-screen loading state + block navigation via `useBlocker`.

### Partial PATCH with dirtyFields

Only send changed fields. Never send the full form object.

```ts
const { formState: { dirtyFields }, reset } = useForm({ defaultValues: brief })

const patch = Object.fromEntries(
  Object.entries(data).filter(([k]) => dirtyFields[k as keyof typeof data])
)
if (Object.keys(patch).length === 0) return  // nothing changed

updateBrief({ id: brief.id, body: { ...patch, rowVersion: brief.rowVersion } })
// On success: reset(updatedBrief) to clear dirty state
```

### rowVersion concurrency

Every PATCH/lock/fork/retire sends `rowVersion`. On `409 state.concurrency_conflict`:

```ts
onError: (err) => {
  if (err.response?.data?.errorCode === 'state.concurrency_conflict') {
    queryClient.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
    toast.info('Brief updated by someone else — refreshing.')
  }
}
```

### ROI recompute — setQueryData not refetch

`/recompute-roi` returns only `RoiProjectionSummary`. Patch in place:

```ts
onSuccess: (roiProjection) => {
  queryClient.setQueryData(bsQk.briefs.detail(id),
    (prev: BrandBriefDto | undefined) => prev ? { ...prev, roiProjection } : prev
  )
}
```

### Brief state guards

```ts
const canEdit = brief.state === BrandBriefState.Draft
const canLock = brief.state === BrandBriefState.Draft
const canFork = brief.state !== BrandBriefState.Draft
```

### Benchmark null rule

`benchmark === null` → hide the card entirely. No empty state. No "n/a". This leaks the privacy floor.

```tsx
{dashboard.benchmark !== null && <BenchmarkWidget data={dashboard.benchmark} />}
```

---

## Analytics — performance

### Always ECharts, never Recharts

ECharts renders Canvas. Recharts renders SVG and degrades above ~500 nodes.
Brand Studio analytics can have 365 daily data points.

```ts
import ReactECharts from 'echarts-for-react'
// Canvas renderer — always. Never SVG.
```

### Web Worker for 90+ day windows

Aggregate daily → weekly off the main thread:

```ts
// src/workers/analyticsAggregator.worker.ts
self.onmessage = (e) => {
  const { points, windowDays } = e.data
  self.postMessage(windowDays <= 90 ? points : aggregateToWeekly(points))
}
```

Create once on mount, terminate on unmount.

---

## Cursor pagination — Activity & large lists

Never use offset pagination for lists that can grow indefinitely.

```ts
// src/api/queries/useActivity.ts
export const useActivity = (filter: ActivityFilter) =>
  useInfiniteQuery({
    queryKey:         bsQk.activity(filter),
    queryFn:          ({ pageParam }) => fetchActivity({ ...filter, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  })

// Flatten pages for rendering
const items = data?.pages.flatMap((p) => p.items) ?? []
const hasMore = !!data?.pages.at(-1)?.nextCursor
```

Trigger `fetchNextPage` via an Intersection Observer sentinel at the bottom of the list.

---

## Mutation lifecycle

1. Interceptor attaches `Idempotency-Key` automatically
2. `onSuccess` → invalidate narrowest keys → success toast
3. `onError state.concurrency_conflict` → invalidate + toast "Refreshing…"
4. `onError system.rate_limited` → `Retry-After` → disable button → toast
5. All other errors → `showErrorToast(err)` with `correlationId`

---

## Error boundaries

Page level and widget level. Dashboard widgets each get their own boundary.

```tsx
<ErrorBoundary fallback={<PageErrorFallback />}>
  <ErrorBoundary fallback={<WidgetErrorFallback label="Benchmark" />}>
    <BenchmarkWidget />
  </ErrorBoundary>
</ErrorBoundary>
```

---

## Formatters

```ts
const TZ = 'Asia/Kathmandu'
export const formatDateTime = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy, HH:mm')
export const formatMoney    = (amount: number, currency: string) =>
  new Intl.NumberFormat('ne-NP', { style:'currency', currency, minimumFractionDigits:2 }).format(amount)
export const formatPercent  = (f: number) => f == null ? '—' : `${(f*100).toFixed(1)}%`
export const formatDelta    = (d: number | null) => d == null ? '—' : `${d>=0?'+':''}${(d*100).toFixed(1)}%`
```

All commission/rate/fraction fields are `[0,1]`. Multiply by 100 for display. `deltaPercent === null` → `'—'`.

---

## Hard invariants

### Auth & security
- JWT in memory only — never `localStorage`, never cookies
- `X-Vendor-Account-Id` sent only when `vendorAccountId !== null`
- Never `dangerouslySetInnerHTML` — use DOMPurify if sanitized HTML is unavoidable
- Never hardcode secrets or tokens in source

### Data & API
- Brief PATCH sends only `dirtyFields` — never the full object
- Every PATCH/lock/fork/retire includes `rowVersion` in the body
- Switch on `errorCode` string — never on HTTP status number
- Commission/rate fields are `[0,1]` — display ×100, send as-is
- `deltaPercent === null` → `'—'`, never `0%`
- `schema.ts` committed to git — never regenerate in CI
- Analytics window > 365 days → block form submission client-side

### UI rendering
- `benchmark === null` → hide card entirely, no placeholder
- LLM draft has no optimistic update — use `draftingBrief` flag + `useBlocker`
- ROI recompute uses `setQueryData` — never query invalidation
- Brief detail `gcTime: 0` — drop large payload on unmount
- ECharts Canvas always — never Recharts for trend charts
- Web Worker aggregates daily→weekly when `windowDays > 90`
- Never hardcode hex colors — use CSS variables from design tokens
- ECharts color options use design tokens — never hardcoded hex

### Performance
- Every page module is `lazy()` — no eager page imports in `router.tsx`
- Lists or tables rendering > 50 rows **must** use `useVirtualizer`
- Activity and any growing list uses `useInfiniteQuery` with cursor — never offset
- Prefetch next likely route on hover via dynamic `import()`
- Run `npm run build -- --mode analyze` before merging any PR that touches imports

### TypeScript
- All entity IDs from the API are branded types — never raw `string`
- Cast to branded type once at the API boundary (query hook), propagate throughout
- Exhaustive switches on discriminated unions use a `never` assertion in the default branch
