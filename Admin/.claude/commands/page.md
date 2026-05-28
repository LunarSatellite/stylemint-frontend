# /page — Scaffold a new page and register it in the router

Create a page component and register the route for `$ARGUMENTS`.

---

## Rules

1. Read `.claude/references/folder-structure.md` for file placement.
2. Pages go in `src/pages/` — thin wrappers only, no data fetching.
3. After creating the file, register the route in `src/router.tsx`.
4. Wrap with `RequireRole` if the feature is restricted to specific roles.

---

## Page template

```tsx
// src/pages/<FeatureName>Page.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FeatureContainer } from '@/features/<feature-name>/<FeatureName>Container'

export default function <FeatureName>Page() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary"><Feature Title></h1>
        <FeatureContainer />
      </div>
    </ErrorBoundary>
  )
}
```

---

## PageErrorFallback template

```tsx
// src/components/PageErrorFallback.tsx
export function PageErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-text-muted">
      <p className="text-lg">Something went wrong loading this page.</p>
      <button
        onClick={() => window.location.reload()}
        className="text-primary underline text-sm"
      >
        Reload
      </button>
    </div>
  )
}
```

---

## Router registration

Add inside the `RequireAuth` children array in `src/router.tsx`:

```ts
// unrestricted route
{ path: '/feature-path', element: <FeaturePage /> },

// role-restricted route
{
  path: '/feature-path',
  element: (
    <RequireRole roles={['SuperAdmin', 'RoleName']}>
      <FeaturePage />
    </RequireRole>
  ),
},
```

Import the page at the top of `router.tsx`:
```ts
import FeaturePage from '@/pages/FeaturePage'
```

---

## Page with URL params

```tsx
// src/pages/FeatureDetailPage.tsx
import { useParams } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FeatureDetailContainer } from '@/features/<feature>/FeatureDetailContainer'

export default function FeatureDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6">
        <FeatureDetailContainer id={id} />
      </div>
    </ErrorBoundary>
  )
}
```

Router entry:
```ts
{ path: '/feature/:id', element: <FeatureDetailPage /> },
```

---

## Invariants

- Pages are thin — no `useQuery`, no `useMutation`, no business logic
- Always wrap in `<ErrorBoundary fallback={<PageErrorFallback />}>`
- Role-restricted pages always use `<RequireRole>` in the router, not inside the page component
- Use `default export` for page components
- Background: `bg-bg-primary` (set by AppShell, do not re-set on the page)
