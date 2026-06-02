# Architecture — StyleMint Creator Frontend

Creator-facing SPA. Consumes `/v1/creator/*`. Creator role required on all authenticated routes.

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 · TanStack Query v5 · Zustand · axios · React Hook Form + Zod · Radix UI + Tailwind · TanStack Virtual · date-fns-tz · sonner · lucide-react · Vitest · Playwright

---

## Folder Structure

```
src/
├── api/
│   ├── client.ts                          # axios instance + interceptors
│   ├── schema.ts                          # GENERATED — commit to git, never CI-regen
│   ├── idempotency.ts                     # newIdempotencyKey() via crypto.randomUUID()
│   ├── errors.ts                          # showErrorToast(err)
│   ├── queryKeys.ts                       # csQk factory for all query key patterns
│   ├── queries/
│   │   ├── useBriefing.ts                 # staleTime: 24h, gcTime: 0
│   │   ├── useStoryArcList.ts
│   │   ├── useStoryArcDetail.ts
│   │   ├── usePostPublishReport.ts        # staleTime: 5m, gcTime: 0
│   │   ├── useRecipesTab.ts
│   │   ├── useRecipeCitations.ts
│   │   ├── useStitchedReelSuggestions.ts
│   │   ├── useBoostOffer.ts               # dynamic refetchInterval
│   │   ├── useActivity.ts                 # useInfiniteQuery + cursor pagination
│   │   ├── useAnalyticsDashboard.ts
│   │   ├── useAnalyticsOverview.ts
│   │   ├── useAnalyticsReport.ts
│   │   ├── useTopReels.ts
│   │   └── useReelAnalytics.ts
│   └── mutations/
│       ├── useAnalyzeDraft.ts             # 15s flow, briefingLoading, soft 429 toast
│       ├── useRefreshBriefing.ts
│       ├── useAcceptStoryArc.ts
│       ├── useDropStoryArc.ts
│       ├── useCiteRecipe.ts               # 409 duplicate → silent swallow
│       ├── useAcknowledgeStitch.ts
│       ├── useDismissStitch.ts
│       └── useAcceptBoostOffer.ts
├── auth/
│   ├── store.ts                           # Zustand: token, claims, briefingLoading
│   ├── broadcastLogout.ts                 # BroadcastChannel multi-tab logout
│   ├── guards.tsx                         # RequireAuth, RequireCreatorRole
│   └── parseClaims.ts
├── components/
│   ├── ui/                                # Radix UI wrappers — always import from here
│   ├── ErrorBoundary.tsx
│   ├── ExplanationTooltip.tsx             # only way to render explanationByKey strings
│   └── MoneyDisplay.tsx
├── features/
│   ├── reel-studio/
│   ├── story-arcs/
│   ├── post-publish/
│   ├── recipes/
│   ├── stitched-reels/
│   ├── boost-offers/
│   ├── activity/                          # TanStack Virtual + useInfiniteQuery
│   └── analytics/
├── hooks/
│   └── useServerAnchoredCountdown.ts
├── layouts/
│   └── AppShell.tsx                       # nav + skip link
├── pages/                                 # all lazy-loaded via React.lazy()
├── lib/
│   ├── enums.ts
│   ├── errorMessages.ts
│   ├── formatters.ts
│   └── utils.ts                           # cn()
├── env.ts                                 # Zod-validated import.meta.env
├── router.tsx
└── main.tsx
```

---

## Route Tree

All routes except `/login` are wrapped in `<RequireAuth><AppShell /></RequireAuth>`. Protected routes also require `<RequireCreatorRole>`.

```ts
createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/analytics" replace /> },
      { path: '/studio/:draftId',         element: <RequireCreatorRole><ReelStudioPage /></RequireCreatorRole> },
      { path: '/story-arcs',              element: <RequireCreatorRole><StoryArcsPage /></RequireCreatorRole> },
      { path: '/story-arcs/:id',          element: <RequireCreatorRole><StoryArcDetailPage /></RequireCreatorRole> },
      { path: '/reels/:reelId/report',    element: <RequireCreatorRole><PostPublishPage /></RequireCreatorRole> },
      { path: '/recipes',                 element: <RequireCreatorRole><RecipesPage /></RequireCreatorRole> },
      { path: '/analytics',               element: <RequireCreatorRole><AnalyticsDashboardPage /></RequireCreatorRole> },
      { path: '/analytics/report',        element: <RequireCreatorRole><AnalyticsReportPage /></RequireCreatorRole> },
      { path: '/analytics/reels/:reelId', element: <RequireCreatorRole><ReelAnalyticsPage /></RequireCreatorRole> },
      { path: '/activity',                element: <RequireCreatorRole><ActivityPage /></RequireCreatorRole> },
      { path: '*',                        element: <NotFoundPage /> },
    ],
  },
])
```

All pages use `React.lazy()` + `<Suspense fallback={<AppShellSkeleton />}>`. No page code in the initial bundle.

---

## Data Flow

### API Client (`src/api/client.ts`)

Request interceptor attaches JWT, `Idempotency-Key` (mutating requests), and `Accept-Language`.  
Response interceptor clears token and redirects to `/login` on `auth.token_expired` / `auth.token_reuse_detected`.

### Query Keys (`src/api/queryKeys.ts`)

`csQk` factory generates type-safe keys for all requests:

```ts
csQk.studio.briefing(id)          // ['cs','studio','briefing',id]
csQk.storyArcs.list(filter)       // ['cs','arcs','list',filter]
csQk.postPublish.report(reelId)   // ['cs','pp','report',reelId]
csQk.boostOffers.detail(id)       // ['cs','boost-offers','detail',id]
csQk.activity(filter)             // ['cs','activity',filter]
csQk.analytics.dashboard(window)  // ['cs','analytics','dashboard',window]
```

### staleTime + gcTime Reference

| Query | staleTime | gcTime | Reason |
|---|---|---|---|
| Briefing | 24h | **0** | Large payload — drop on unmount |
| Post-publish report | 5m | **0** | Large payload — drop on unmount |
| Story arc list/detail | 30s | default | |
| Analytics (all) | 1m | default | |
| Activity | 15s | default | Infinite query |
| Boost offer | dynamic | default | Stops polling on Accepted/Expired |
| Recipes tab | 1m | default | |

### Mutation Pattern

```ts
onMutate:  // cancel in-flight, save previous state, apply optimistic update
onError:   // restore previous state
onSettled: // invalidate related queries
```

Special cases — see CLAUDE.md Hard Invariants.

---

## State Management Decision Tree

1. **Server data** → TanStack Query. Never duplicate in Zustand.
2. **Ephemeral UI (one component)** → `useState` / `useReducer`
3. **Shared UI (multiple components)** → Zustand slice
4. **Form state** → React Hook Form + Zod
5. **Shareable filter/tab state** → URL search params via `useSearchParams`

### Auth Store (`src/auth/store.ts`)

```ts
interface AuthState {
  token: string | null        // JWT in memory only
  claims: JwtClaims | null
  briefingLoading: boolean    // true during 15s analyze flow
  setToken: (token: string) => void
  setBriefingLoading: (v: boolean) => void
  clear: () => void
}
```

Outside React: `useAuth.getState().token`. In components: `useAuth((s) => s.token)`.

On logout, all stores with user-specific state must reset:

```ts
useAuth.subscribe(
  (s) => s.token,
  (token) => { if (!token) useMyStore.setState({ /* reset */ }) }
)
```

---

## Component Architecture

### Naming Conventions

| Artifact | Convention |
|---|---|
| Component file | PascalCase (`HookScoreBadge.tsx`) |
| Hook file | `use` prefix camelCase (`useServerAnchoredCountdown.ts`) |
| Query hook | `use` + resource noun (`useBriefing.ts`) |
| Mutation hook | `use` + verb noun (`useAnalyzeDraft.ts`) |
| Feature folder | kebab-case (`reel-studio/`) |
| Test file | same name + `.test.tsx` |

### Props Pattern

```tsx
export interface HookScoreBadgeProps {
  score: number      // raw [0,1] from API
  label: string
  className?: string
}

export function HookScoreBadge({ score, label, className }: HookScoreBadgeProps) {
  return <div className={cn('px-3 py-1', className)}>{formatPercent(score)}</div>
}
```

Never use `React.FC` — it adds implicit `children` and obscures return type.

### Loading & Error States

Every async component handles all three states explicitly:

```tsx
if (isLoading) return <StoryArcDetailSkeleton />
if (isError)   return <FeatureError message="Failed to load" onRetry={refetch} />
return <StoryArcDetailView arc={data} />
```

Wrap feature sections in `<ErrorBoundary>` — a crashing chart must not crash the page.

### Split Rules

Split when: >120 lines JSX, independently testable chunk, duplicated in >1 place, distinct loading/error state. Not just to reduce line count.

---

## Analyze Draft — 15-Second Flow

```ts
onMutate:  () => useAuth.getState().setBriefingLoading(true)
onSettled: () => useAuth.getState().setBriefingLoading(false)
onSuccess: (data) => {
  queryClient.setQueryData(csQk.studio.briefing(data.id), data)
  navigate(`/studio/${data.reelDraftId}`)
}
onError: (err) => {
  if (code === 'system.rate_limited') {
    // soft message — never generic toast — see Hard Invariants
    toast.info(`Still working on your briefing. Try again in ${retry}s.`)
    return
  }
  showErrorToast(err)
}
```

When `briefingLoading === true`: render `<BriefingLoadingScreen />` full-screen, block navigation with `useBlocker`, no cancel button.

---

## Optimistic Update Pattern

```ts
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: csQk.storyArcs.detail(id) })
  const previous = queryClient.getQueryData(csQk.storyArcs.detail(id))
  queryClient.setQueryData(csQk.storyArcs.detail(id), (old) => ({
    ...old, state: StoryArcState.Dropped,
  }))
  return { previous, id }
},
onError: (_err, id, ctx) => {
  if (ctx?.previous) queryClient.setQueryData(csQk.storyArcs.detail(id), ctx.previous)
},
onSettled: (_data, _err, id) => {
  queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
},
```

---

## Axios Interceptor (full)

```ts
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post','patch','put','delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})

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

---

## Performance

- All pages: `React.lazy()` + `<Suspense>` — no page code in initial bundle
- Large dependency features (charts): dynamic import within the page
- Long lists (>50 items): TanStack Virtual — never render all rows
- Large payloads (briefing, post-publish report): `gcTime: 0` — drop on unmount
- `React.memo` / `useMemo` / `useCallback`: only after profiling confirms need
- Prefetch above-the-fold data in React Router loaders to avoid waterfalls
- Initial JS bundle target: **<150kb gzipped**

---

## Security Summary

- JWT in memory only (never localStorage / sessionStorage / cookies)
- `dangerouslySetInnerHTML` never allowed — no exceptions
- All external links: `rel="noopener noreferrer"` + `target="_blank"`
- URL scheme validation before use in `<img src>`, `<a href>`, `window.open`
- Open redirect: validate against `SAFE_PATHS` whitelist before navigating
- CSP header required — no `unsafe-eval`
- `import.meta.env.VITE_*` accessed only through `src/env.ts` (Zod-validated)

---

## Accessibility Summary

- Interactive elements: `<button>` or `<a>` only — never `onClick` on `<div>`
- Every input: visible `<label>` or `aria-label`
- Form errors: `aria-invalid` + `aria-describedby` + `role="alert"`
- Loading states: `role="status"` + `aria-live="polite"`
- Skip link as first focusable element in `AppShell`
- All `<img>`: `alt` required; decorative uses `alt=""` + `aria-hidden="true"`
- `prefers-reduced-motion` respected via global CSS
- Color: all tokens meet WCAG AA contrast — never add custom colors outside token system
