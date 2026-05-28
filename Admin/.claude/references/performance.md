# Performance — stylemint-admin-fe

Decisions about *when* to apply patterns live in `architecture.md`.
This file covers *how* to implement them correctly.

---

## Core Web Vitals targets

| Metric                    | Target    |
|---------------------------|-----------|
| LCP                       | < 2.5 s   |
| FID                       | < 100 ms  |
| CLS                       | < 0.1     |
| TTI                       | < 3.5 s   |
| Main bundle (gzipped)     | < 200 KB  |

---

## Bundle analysis

Run before and after any major dependency change:

```bash
npx vite-bundle-visualizer
# or for source-map analysis:
npm run build -- --sourcemap
npx source-map-explorer dist/assets/*.js
```

Red flags to look for:
- Any single chunk > 100 KB gzipped
- The same package appearing in two chunks (duplicate)
- `date-fns` locale files bundled in full (use `{ locale }` imports only)
- Dev-only packages (`vitest`, `@testing-library/*`) appearing in production output

---

## Vite manual chunk splitting

Splits vendor libraries into separate cacheable files so a code change does not
bust the entire vendor cache:

```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':  ['@tanstack/react-query'],
          'vendor-table':  ['@tanstack/react-table', '@tanstack/react-virtual'],
          'vendor-form':   ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-charts': ['recharts'],
          'vendor-ui':     [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
          ],
        },
      },
    },
  },
})
```

---

## Route-level code splitting

Every page is lazy-loaded. No exceptions. Apply in `src/router.tsx`:

```tsx
import { lazy, Suspense } from 'react'

const KycQueuePage       = lazy(() => import('@/pages/KycQueuePage'))
const KycDetailPage      = lazy(() => import('@/pages/KycDetailPage'))
const AuditLogPage       = lazy(() => import('@/pages/AuditLogPage'))
const AdminAccountsPage  = lazy(() => import('@/pages/AdminAccountsPage'))
// ... all pages

// PageSkeleton shown during chunk load
function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-surface-2" />
      <div className="h-64 rounded bg-surface-1" />
    </div>
  )
}

// In router children:
{
  path: '/kyc',
  element: (
    <Suspense fallback={<PageSkeleton />}>
      <KycQueuePage />
    </Suspense>
  ),
},
```

---

## Memoization — correct usage

Only apply after a React DevTools Profiler measurement shows unnecessary renders.

### `React.memo` — presentation components inside long lists

```tsx
// AuditLogRow renders hundreds of times during virtual scroll
export const AuditLogRow = React.memo(function AuditLogRow({
  entry,
}: {
  entry: AuditEntry
}) {
  return (
    <tr className="border-b border-[var(--surface-border)]">
      <td className="px-4 py-3 font-mono text-xs text-text-muted">
        {formatDate(entry.timestamp)}
      </td>
      <td className="px-4 py-3 text-text-primary">{entry.actor}</td>
      <td className="px-4 py-3 text-text-secondary">{entry.action}</td>
    </tr>
  )
})
```

### `useMemo` — expensive client-side derivation only

```ts
// Only justified when filtering/sorting thousands of items without server support
const filtered = useMemo(
  () => flags.filter((f) => f.key.includes(search)),
  [flags, search]
)
```

### `useCallback` — only when passed to a memoized child

```ts
// Only add useCallback if the child is wrapped in React.memo
const handleDecide = useCallback(
  (vars: KycDecideRequest) => mutation.mutate(vars),
  [mutation]
)
```

**Never add any of the above "just in case."** They add overhead and hide intent.

---

## Virtualization — TanStack Virtual

For audit log and any unbounded list. Row height is fixed at 48 px — do not change this.

```tsx
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const ROW_HEIGHT = 48

export function VirtualizedList({ items }: { items: AuditEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vItem) => (
          <div
            key={vItem.key}
            style={{
              position: 'absolute',
              top: vItem.start,
              height: ROW_HEIGHT,
              width: '100%',
            }}
          >
            <AuditLogRow entry={items[vItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Debounce hook

300 ms on all filter and search inputs. Defined once in `src/hooks/use-debounce.ts`:

```ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
```

Usage in filter containers:

```ts
const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)

// debouncedSearch — not search — goes into the query filter
const { data } = useAdminAccounts({ search: debouncedSearch, page, pageSize })
```

---

## Image loading

```tsx
<img
  src={item.imageUrl}
  alt={item.name}
  loading="lazy"
  decoding="async"
  width={80}
  height={80}
  className="object-cover rounded"
/>
```

Always provide explicit `width` and `height` to prevent CLS (layout shift).

---

## Re-render audit workflow

When a component re-renders too often:

1. Open React DevTools → Profiler → Record
2. Perform the triggering action
3. Look for components highlighted in red/orange
4. Check: is the prop reference changing on every parent render?
5. Fix at the source — stabilise the reference, not the child

Never add `memo` to the child to paper over an unstable parent.
