# Performance — stylemint-brand-fe

High-traffic FE checklist. Every pattern here is a hard rule, not a suggestion.

---

## Route-based code splitting

Every page is lazy-loaded. Zero eager page imports in `router.tsx`.

```ts
// router.tsx
import { lazy, Suspense } from 'react'

const BriefListPage      = lazy(() => import('./pages/BriefListPage'))
const BriefCreatePage    = lazy(() => import('./pages/BriefCreatePage'))
const BriefEditorPage    = lazy(() => import('./pages/BriefEditorPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const AnalyticsPage      = lazy(() => import('./pages/AnalyticsPage'))
const ProductAnalyticsPage  = lazy(() => import('./pages/ProductAnalyticsPage'))
const CreatorAnalyticsPage  = lazy(() => import('./pages/CreatorAnalyticsPage'))
const ActivityPage       = lazy(() => import('./pages/ActivityPage'))
const GoalTemplatesPage  = lazy(() => import('./pages/GoalTemplatesPage'))
const VendorPolicyPage   = lazy(() => import('./pages/VendorPolicyPage'))
const NotFoundPage       = lazy(() => import('./pages/NotFoundPage'))
```

Wrap the router outlet in `<Suspense fallback={<PageSkeleton />}>` inside `AppShell`.

`PageSkeleton` renders the full shell chrome (sidebar, topbar) with the content area as an animated shimmer. The chrome never flickers during navigation.

---

## Vite bundle chunking

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
        'vendor-query':    ['@tanstack/react-query', '@tanstack/react-virtual'],
        'vendor-echarts':  ['echarts', 'echarts-for-react'],
        'vendor-table':    ['@tanstack/react-table'],
        'vendor-form':     ['react-hook-form', 'zod'],
        'vendor-radix':    [
          '@radix-ui/react-dialog',
          '@radix-ui/react-dropdown-menu',
          '@radix-ui/react-select',
          '@radix-ui/react-tooltip',
          '@radix-ui/react-popover',
          // list every @radix-ui/* package used
        ],
        'vendor-utils':    ['date-fns', 'date-fns-tz', 'axios', 'clsx', 'tailwind-merge'],
      },
    },
  },
  chunkSizeWarningLimit: 500,   // kB — do not raise this limit, fix the chunk
}
```

`vendor-echarts` is intentionally separate — it's ~800 kB raw and loads only on analytics routes.
Run `npm run build -- --mode analyze` if any chunk exceeds the limit.

---

## Prefetch on hover

Trigger the lazy import when the user *hovers* a nav link — not on click. This costs zero bytes at load time and eliminates the spinner on most navigations.

```ts
// components/NavLink.tsx
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/briefs':     () => import('../pages/BriefListPage'),
  '/dashboard':  () => import('../pages/DashboardPage'),
  '/analytics':  () => import('../pages/AnalyticsPage'),
  '/activity':   () => import('../pages/ActivityPage'),
}

export function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <RouterNavLink to={to} onMouseEnter={() => prefetchMap[to]?.()}>
      {children}
    </RouterNavLink>
  )
}
```

---

## TanStack Virtual — mandatory for large lists

Any list or table that renders more than 50 rows **must** use `useVirtualizer`. This is not optional even in pagination-heavy screens — a cursor-paginated Activity feed can accumulate 500+ rows in memory.

```ts
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count:            items.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 72,    // match actual row height in px
    overscan:         10,
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: rowVirtualizer.getTotalSize() }} className="relative w-full">
        {rowVirtualizer.getVirtualItems().map((vItem) => (
          <div
            key={vItem.key}
            data-index={vItem.index}
            ref={rowVirtualizer.measureElement}
            style={{ transform: `translateY(${vItem.start}px)` }}
            className="absolute w-full"
          >
            <ActivityRow item={items[vItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

Use `measureElement` ref (not `estimateSize` alone) when row heights vary.

---

## Infinite scroll sentinel

Append a sentinel `<div>` at the bottom of the virtual list and observe it:

```ts
const sentinelRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const el = sentinelRef.current
  if (!el || !hasNextPage) return
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) fetchNextPage() },
    { rootMargin: '200px' }
  )
  observer.observe(el)
  return () => observer.disconnect()
}, [hasNextPage, fetchNextPage])
```

`rootMargin: '200px'` pre-fetches before the user reaches the bottom.

---

## React.memo — when to apply

- **Do**: memo individual row components that receive stable props (id, index, callbacks)
- **Do not**: preemptively memo containers, pages, or providers
- **Rule**: only add `memo` after the React DevTools Profiler confirms wasted renders

Prefer stable callbacks with `useCallback` at query/mutation hooks instead of inside render.

---

## Image & asset optimization

| Asset | Rule |
|---|---|
| SVG icons | Import as React components via `?react` (Vite SVGR) — no `<img src>` |
| Product/creator images | `<img loading="lazy" decoding="async" />` |
| Above-the-fold hero | `<img loading="eager" fetchpriority="high" />` |
| Fonts | `font-display: swap` in CSS; subset to Latin + Devanagari only |
| No base64 images | Never embed raster images in CSS or JS |

---

## Web Worker — analytics aggregation

For windows > 90 days, weekly aggregation runs off the main thread (see SKILL.md analytics section). Key lifecycle rules:

```ts
useEffect(() => {
  const worker = new Worker(
    new URL('../workers/analyticsAggregator.worker.ts', import.meta.url),
    { type: 'module' }
  )
  worker.postMessage({ points: rawData, windowDays })
  worker.onmessage = (e) => setAggregated(e.data)
  return () => worker.terminate()   // always terminate on unmount
}, [rawData, windowDays])
```

---

## Bundle analysis workflow

```bash
# install once
npm install --save-dev vite-bundle-visualizer

# run before any PR that touches imports
ANALYZE=true npm run build

# vite.config.ts — conditional plugin
import { visualizer } from 'rollup-plugin-visualizer'
plugins: [
  ...,
  process.env.ANALYZE && visualizer({ open: true, gzipSize: true, brotliSize: true }),
].filter(Boolean)
```

Gate: no PR merges if it increases the initial JS payload (sum of non-async chunks) by > 20 kB gzip.

---

## TanStack Query — cache efficiency under high traffic

| Setting | Value | Reason |
|---|---|---|
| `staleTime` (dashboard, analytics) | 60 000 ms | Avoid re-fetching on every tab focus |
| `staleTime` (brief detail) | 30 000 ms | Balance freshness and request volume |
| `gcTime` (brief detail) | **0** | Large payload — evict immediately on unmount |
| `refetchOnWindowFocus` | default (true) | Fine for most; override to `false` only for analytics |
| `retry` | 1 | Fail fast on 4xx; one retry for transient 5xx |

```ts
// src/api/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && (error.response?.status ?? 0) < 500) return false
        return failureCount < 1
      },
    },
  },
})
```

Never retry on 4xx. The user needs to see the error, not wait through 3 retries.
