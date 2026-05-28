# Performance Guide — stylemint-creator-fe

This app must stay fast under high traffic: many concurrent users, large API payloads (briefings, analytics reports), long lists (activity timeline). These rules are non-negotiable for production quality.

---

## Route-Level Code Splitting

Every page is lazy-loaded. No page code is included in the initial bundle.

```tsx
// src/router.tsx
import { lazy, Suspense } from 'react'

const ReelStudioPage       = lazy(() => import('./pages/ReelStudioPage'))
const AnalyticsDashboard   = lazy(() => import('./pages/AnalyticsDashboardPage'))
const ActivityPage         = lazy(() => import('./pages/ActivityPage'))
// ... all pages

createBrowserRouter([
  {
    element: (
      <Suspense fallback={<AppShellSkeleton />}>
        <RequireAuth><AppShell /></RequireAuth>
      </Suspense>
    ),
    children: [
      { path: '/studio/:draftId', element: <ReelStudioPage /> },
      { path: '/analytics',       element: <AnalyticsDashboard /> },
      { path: '/activity',        element: <ActivityPage /> },
    ],
  },
])
```

The initial bundle must contain only: auth logic, the router shell, and `AppShell`. Everything else is a dynamic import.

---

## Heavy Features — Dynamic Import

Features with large dependencies (charts, rich editors) are dynamically imported even within a page:

```tsx
// Heavy charting component loaded on demand
const EarningsTrendChart = lazy(() => import('./EarningsTrendChart'))

function AnalyticsFullReport() {
  const [showChart, setShowChart] = useState(false)
  return (
    <div>
      <Button onClick={() => setShowChart(true)}>Show Earnings Trend</Button>
      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <EarningsTrendChart />
        </Suspense>
      )}
    </div>
  )
}
```

---

## React.Suspense Placement

Place `<Suspense>` at the **feature boundary**, not at the component level. One boundary per independently loadable section.

```tsx
// CORRECT — boundary at feature level
<Suspense fallback={<AnalyticsSectionSkeleton />}>
  <EarningsTrendChart />
</Suspense>

// WRONG — too granular, causes layout shift
<div>
  {items.map(item => (
    <Suspense key={item.id} fallback={<div />}>
      <ItemCard item={item} />
    </Suspense>
  ))}
</div>
```

---

## Virtualization — Required for Long Lists

Any list that can grow beyond 50 items **must** use TanStack Virtual. Never render all rows.

```tsx
// src/features/activity/ActivityTimeline.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function ActivityTimeline() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivity(filter)
  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse()
    if (!lastItem) return
    if (lastItem.index >= allItems.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, fetchNextPage, allItems.length])

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = allItems[row.index]
          return (
            <div
              key={row.key}
              style={{ position: 'absolute', top: row.start, left: 0, width: '100%', height: row.size }}
            >
              {item ? <ActivityItem item={item} /> : <ActivityItemSkeleton />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

## React.memo — When to Use It

Do **not** add `React.memo` by default. Apply it only when:
1. You have profiled with React DevTools and confirmed the component re-renders unnecessarily under real usage
2. The component is expensive to render (large lists, canvas, heavy SVG)
3. Props are genuinely stable between renders (primitive values or memoized references)

```tsx
// Only after profiling confirmed issue
export const ActivityItem = React.memo(function ActivityItem({ item }: { item: ActivityEvent }) {
  return <div>{item.title}</div>
})
```

---

## useMemo — Rules

Use `useMemo` only when:
- The computation is provably expensive (>1ms, benchmark it)
- The result is used as a dependency of another hook (`useEffect`, `useCallback`, `useMemo`)
- A new reference on every render would cause cascading re-renders

```ts
// CORRECT — stable reference prevents virtualizer restart
const allItems = useMemo(
  () => data?.pages.flatMap((p) => p.items) ?? [],
  [data?.pages]
)

// WRONG — formatPercent is O(1), memoization is overhead
const label = useMemo(() => formatPercent(score), [score])
```

---

## useCallback — Rules

Same as `useMemo`. Apply when the function is:
- Passed as a prop to a memoized child
- Used as a dependency in `useEffect` / `useMemo`

Do not wrap every event handler in `useCallback` "just in case".

---

## Large Payload Handling

Briefings and post-publish reports are large bodies. The `gcTime: 0` on these queries ensures they are removed from the cache when their component unmounts, avoiding memory bloat in long sessions.

Do not load these eagerly. Only fetch when the user navigates to the relevant page.

---

## Image Optimization

```tsx
// All images need explicit dimensions to prevent layout shift
<img
  src={reel.thumbnailUrl ?? '/placeholder-reel.png'}
  alt={reel.title}
  width={160}
  height={90}
  loading="lazy"       // below-the-fold images
  decoding="async"
/>

// Above-the-fold hero images
<img loading="eager" fetchPriority="high" ... />
```

---

## Bundle Analysis

```bash
npm run build -- --sourcemap
npx vite-bundle-visualizer   # or: npx source-map-explorer dist/assets/*.js
```

Run before every significant dependency addition. Target: initial JS bundle < 150kb gzipped.

---

## Web Vitals Targets

| Metric | Target |
|---|---|
| LCP | < 2.5s |
| FID / INP | < 100ms |
| CLS | < 0.1 |
| TTFB | < 800ms |

Instrument with `web-vitals` library and send to your analytics endpoint. Do not ship without vitals instrumentation.

---

## Prefetching on Hover

For likely-next navigations, prefetch on link hover:

```tsx
function StoryArcCard({ arc }: { arc: StoryArc }) {
  const queryClient = useQueryClient()

  const prefetch = () =>
    queryClient.prefetchQuery({
      queryKey: csQk.storyArcs.detail(arc.id),
      queryFn: () => fetchStoryArcDetail(arc.id),
      staleTime: 30_000,
    })

  return (
    <Link to={`/story-arcs/${arc.id}`} onMouseEnter={prefetch} onFocus={prefetch}>
      {arc.title}
    </Link>
  )
}
```

---

## Re-render Budget

Keep re-renders per interaction to ≤ 3 components. If more than 3 components re-render on a single user action, investigate with React DevTools Profiler before shipping.
