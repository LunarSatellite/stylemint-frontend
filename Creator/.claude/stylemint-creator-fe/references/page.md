# Page Authoring — stylemint-creator-fe

Every file in `src/pages/` is a thin lazy-loaded shell. Pages do not fetch data, own forms, or contain significant JSX — that belongs in `src/features/`.

---

## Invariants

```
All pages are lazy-loaded — no page code in the initial bundle
Every page uses <Suspense fallback={<AppShellSkeleton />}>
Pages never fetch data directly — delegate to a Container component
<ErrorBoundary> wraps every feature section — a crashing chart must not crash the page
```

---

## Lazy Loading

All pages must be registered with `React.lazy()` and wrapped in `<Suspense>`. This keeps the initial bundle under 150 kb gzipped.

```ts
// src/router.tsx
import { lazy, Suspense } from 'react'

const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'))
const ReelStudioPage          = lazy(() => import('./pages/ReelStudioPage'))
// ... all pages

createBrowserRouter([
  {
    element: (
      <Suspense fallback={<AppShellSkeleton />}>
        <RequireAuth><AppShell /></RequireAuth>
      </Suspense>
    ),
    children: [
      { path: '/analytics', element: <RequireCreatorRole><AnalyticsDashboardPage /></RequireCreatorRole> },
      // ...
    ],
  },
])
```

Never import a page component directly (non-lazy) unless it is `LoginPage` or `NotFoundPage`, which are always needed.

---

## Three-Layer Structure

```
Page       src/pages/AnalyticsDashboardPage.tsx   — lazy shell, router loader, Suspense boundary
Container  src/features/analytics/AnalyticsDashboard.tsx  — useQuery, loading/error states
View       src/features/analytics/AnalyticsDashboardView.tsx — pure render, no async
```

### Page layer

```tsx
// src/pages/AnalyticsDashboardPage.tsx
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AnalyticsDashboard } from '@/features/analytics/AnalyticsDashboard'
import { AnalyticsDashboardSkeleton } from '@/features/analytics/AnalyticsDashboardSkeleton'

export default function AnalyticsDashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AnalyticsDashboardSkeleton />}>
        <AnalyticsDashboard />
      </Suspense>
    </ErrorBoundary>
  )
}
```

### Container layer

```tsx
// src/features/analytics/AnalyticsDashboard.tsx
export function AnalyticsDashboard() {
  const { window } = useAnalyticsFilters()
  const { data, isLoading, isError, refetch } = useAnalyticsDashboard(window)

  if (isLoading) return <AnalyticsDashboardSkeleton />
  if (isError)   return <FeatureError message="Failed to load analytics" onRetry={refetch} />

  return <AnalyticsDashboardView data={data} />
}
```

### View layer

```tsx
// src/features/analytics/AnalyticsDashboardView.tsx
interface AnalyticsDashboardViewProps {
  data: AnalyticsDashboard
}

export function AnalyticsDashboardView({ data }: AnalyticsDashboardViewProps) {
  // Pure render — no useQuery, no async, no side effects
  return (
    <div className="space-y-6">
      <AnalyticsOverview metrics={data.overview} />
      <EarningsTrendChart series={data.earningsTrend} />
    </div>
  )
}
```

---

## Router Loaders — Prefetching

Use React Router loaders to prefetch above-the-fold data before the page mounts. Prevents a query waterfall on navigation.

```ts
// src/pages/ReelStudioPage.tsx
export async function reelStudioLoader({ params }: LoaderFunctionArgs) {
  await queryClient.prefetchQuery({
    queryKey: csQk.studio.briefing(params.draftId!),
    queryFn:  () => fetchBriefing(params.draftId!),
    staleTime: 86_400_000,
  })
  return null
}

// Register in router.tsx
{ path: '/studio/:draftId', element: <ReelStudioPage />, loader: reelStudioLoader }
```

Only prefetch the primary resource. Secondary data (e.g. charts that depend on the primary response) can waterfall naturally inside the feature.

---

## URL Params

Read path params and search params inside the Container, not the Page.

```tsx
// Container
import { useParams, useSearchParams } from 'react-router-dom'

export function StoryArcDetail() {
  const { id } = useParams<{ id: string }>()
  const { data } = useStoryArcDetail(id!)
  // ...
}
```

Validate that required params exist. If a param is missing or invalid, render `<NotFoundPage />` rather than crashing.

---

## ErrorBoundary Rules

Wrap every independently-failable section:

```tsx
export default function PostPublishPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PostPublishSkeleton />}>
        <PostPublishReport />
      </Suspense>
    </ErrorBoundary>
  )
}
```

For pages with multiple sections (e.g. AnalyticsDashboardPage), wrap each heavy section in its own `<ErrorBoundary>` so a crashing chart does not take down the whole page:

```tsx
<div className="space-y-6">
  <ErrorBoundary><AnalyticsOverview /></ErrorBoundary>
  <ErrorBoundary>
    <Suspense fallback={<ChartSkeleton />}>
      <EarningsTrendChart />
    </Suspense>
  </ErrorBoundary>
</div>
```

---

## Heavy Dependencies Inside Pages

Chart libraries (e.g. Recharts) are large. Dynamic-import them within the feature, not at the page level:

```ts
// src/features/analytics/EarningsTrendChart.tsx
const { LineChart, Line, XAxis } = await import('recharts')
```

Or use React.lazy at the feature component level with a local `<Suspense fallback={<ChartSkeleton />}>`.

---

## Page Inventory

| Page | Path | Notes |
|---|---|---|
| `LoginPage` | `/login` | Only unguarded page. Not lazy-loaded. |
| `ReelStudioPage` | `/studio/:draftId` | briefingLoading check in container |
| `StoryArcsPage` | `/story-arcs` | Filter state in URL params |
| `StoryArcDetailPage` | `/story-arcs/:id` | Optimistic accept/drop |
| `PostPublishPage` | `/reels/:reelId/report` | gcTime:0, large payload |
| `RecipesPage` | `/recipes` | Recipe citation sheet |
| `AnalyticsDashboardPage` | `/analytics` | Window filter in URL |
| `AnalyticsReportPage` | `/analytics/report` | Window filter in URL, client-side 365d block |
| `ReelAnalyticsPage` | `/analytics/reels/:reelId` | Deep-dive per reel |
| `ActivityPage` | `/activity` | TanStack Virtual + infinite scroll |
| `NotFoundPage` | `*` | No guard, no data fetching |

---

## Skeleton Components

Every page must have a matching skeleton used as both the Suspense fallback and the container-level loading state:

```
src/features/analytics/AnalyticsDashboardSkeleton.tsx
src/features/reel-studio/ReelStudioSkeleton.tsx
// etc.
```

The top-level fallback used by `<AppShell>` is `<AppShellSkeleton />` from `src/layouts/AppShell.tsx`.

---

## briefingLoading — Full-Screen Block

`ReelStudioPage` must check `briefingLoading` at the container level and render the blocking screen:

```tsx
// src/features/reel-studio/ReelStudio.tsx
export function ReelStudio() {
  const briefingLoading = useAuth((s) => s.briefingLoading)

  if (briefingLoading) return <BriefingLoadingScreen />

  // ... normal render
}
```

`<BriefingLoadingScreen />` renders full-screen, blocks all navigation via `useBlocker`, and has no cancel button.
