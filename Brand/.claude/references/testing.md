# Testing — stylemint-brand-fe

## Stack

Vitest 2 · @testing-library/react 16 · @testing-library/user-event 14 ·
MSW 2 · @playwright/test 1.x · @faker-js/faker

---

## Vitest setup

```ts
// vitest.setup.ts
import '@testing-library/jest-dom'
import { server } from './src/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

`onUnhandledRequest: 'error'` — any unmocked API call in a unit test is an immediate test failure, not a silent pass.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 70, functions: 70, branches: 60 },
      exclude: ['src/api/schema.ts', 'src/mocks/**', 'src/workers/**', 'src/env.ts'],
    },
  },
})
```

---

## MSW handler organization

```
src/mocks/
├── server.ts                   # setupServer(...allHandlers)
├── browser.ts                  # setupWorker(...allHandlers) — Storybook/dev
├── handlers/
│   ├── index.ts                # [...briefHandlers, ...dashboardHandlers, ...]
│   ├── briefs.ts
│   ├── dashboard.ts
│   ├── analytics.ts
│   ├── activity.ts
│   ├── goalTemplates.ts
│   └── policy.ts
└── factories/
    ├── brief.factory.ts
    ├── dashboard.factory.ts
    ├── analytics.factory.ts
    └── activity.factory.ts
```

### Handler pattern

```ts
// handlers/briefs.ts
import { http, HttpResponse } from 'msw'
import { buildBrief } from '../factories/brief.factory'

export const briefHandlers = [
  http.get('/v1/vendor/briefs', () =>
    HttpResponse.json({ items: [buildBrief()], nextCursor: null })
  ),
  http.get('/v1/vendor/briefs/:id', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params.id as string }))
  ),
  http.post('/v1/vendor/briefs', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(buildBrief({ title: body.title as string }), { status: 201 })
  }),
  http.patch('/v1/vendor/briefs/:id', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params.id as string, rowVersion: 2 }))
  ),
]
```

### Factory pattern

```ts
// factories/brief.factory.ts
import { faker } from '@faker-js/faker'
import { BrandBriefState } from '@/lib/enums'
import type { BrandBriefDto } from '@/api/schema'

export const buildBrief = (overrides: Partial<BrandBriefDto> = {}): BrandBriefDto => ({
  id:            faker.string.uuid(),
  state:         BrandBriefState.Draft,
  rowVersion:    1,
  title:         faker.commerce.productName(),
  goalType:      1,
  targetAudience: faker.lorem.words(3),
  roiProjection: null,
  benchmark:     null,
  createdAt:     new Date().toISOString(),
  updatedAt:     new Date().toISOString(),
  ...overrides,
})
```

Factories produce minimal valid DTOs. Tests override only the fields relevant to the scenario.

---

## QueryClientWrapper

Always use a fresh client per test. Never share state between tests.

```ts
// test-utils/QueryClientWrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function QueryClientWrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}
```

---

## Component tests

```ts
// features/brief-authoring/__tests__/BriefStatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { BriefStatusBadge } from '../BriefStatusBadge'
import { BrandBriefState } from '@/lib/enums'

it('shows Locked label for locked state', () => {
  render(<BriefStatusBadge state={BrandBriefState.Locked} />)
  expect(screen.getByText('Locked')).toBeInTheDocument()
})

it('shows Draft label for draft state', () => {
  render(<BriefStatusBadge state={BrandBriefState.Draft} />)
  expect(screen.getByText('Draft')).toBeInTheDocument()
})
```

No `describe` nesting beyond one level. Test what the user sees, not internal implementation details.

---

## Query hook tests

```ts
// api/queries/__tests__/useBriefDetail.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'
import { buildBrief } from '@/mocks/factories/brief.factory'
import { useBriefDetail } from '../useBriefDetail'
import { QueryClientWrapper } from '@/test-utils/QueryClientWrapper'

it('returns brief detail on success', async () => {
  const brief = buildBrief({ id: 'abc-123' })
  server.use(
    http.get('/v1/vendor/briefs/abc-123', () => HttpResponse.json(brief))
  )
  const { result } = renderHook(() => useBriefDetail('abc-123'), {
    wrapper: QueryClientWrapper,
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual(brief)
})

it('exposes error on 404', async () => {
  server.use(
    http.get('/v1/vendor/briefs/not-found', () =>
      HttpResponse.json({ errorCode: 'resource.not_found' }, { status: 404 })
    )
  )
  const { result } = renderHook(() => useBriefDetail('not-found'), {
    wrapper: QueryClientWrapper,
  })
  await waitFor(() => expect(result.current.isError).toBe(true))
})
```

---

## Mutation tests — two required paths

For every mutation, test: (1) `onSuccess` path including invalidation, and (2) `state.concurrency_conflict` error path.

```ts
// api/mutations/__tests__/useUpdateBrief.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'
import { buildBrief } from '@/mocks/factories/brief.factory'
import { useUpdateBrief } from '../useUpdateBrief'
import { QueryClientWrapper } from '@/test-utils/QueryClientWrapper'

it('invalidates brief detail on success', async () => {
  const updated = buildBrief({ id: 'abc', rowVersion: 2, title: 'New Title' })
  server.use(
    http.patch('/v1/vendor/briefs/abc', () => HttpResponse.json(updated))
  )
  const { result } = renderHook(() => useUpdateBrief(), { wrapper: QueryClientWrapper })
  act(() => result.current.mutate({ id: 'abc', body: { title: 'New Title', rowVersion: 1 } }))
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})

it('handles concurrency_conflict with invalidation', async () => {
  server.use(
    http.patch('/v1/vendor/briefs/abc', () =>
      HttpResponse.json({ errorCode: 'state.concurrency_conflict' }, { status: 409 })
    )
  )
  const { result } = renderHook(() => useUpdateBrief(), { wrapper: QueryClientWrapper })
  act(() => result.current.mutate({ id: 'abc', body: { title: 'x', rowVersion: 1 } }))
  await waitFor(() => expect(result.current.isError).toBe(true))
})
```

---

## Analytics Worker tests

```ts
// workers/__tests__/analyticsAggregator.test.ts
import { describe, it, expect } from 'vitest'

it('returns raw points for window <= 90 days', async () => {
  const worker = new Worker(new URL('../analyticsAggregator.worker.ts', import.meta.url))
  const points = Array.from({ length: 90 }, (_, i) => ({ date: `2025-01-${i+1}`, value: i }))
  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data)
    worker.postMessage({ points, windowDays: 90 })
  })
  worker.terminate()
  expect(result).toEqual(points)
})
```

---

## Playwright — E2E

### Directory layout

```
playwright/
├── playwright.config.ts
├── auth.setup.ts               # Login once, save storageState
├── fixtures/
│   └── authed.ts               # extend test with authed page
└── tests/
    ├── briefs.spec.ts
    ├── dashboard.spec.ts
    └── analytics.spec.ts
```

### Auth state re-use

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'vendor',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/vendor.json' },
      dependencies: ['setup'],
    },
  ],
})

// auth.setup.ts
import { test as setup } from '@playwright/test'
setup('vendor login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', process.env.E2E_VENDOR_EMAIL!)
  await page.fill('[name=password]', process.env.E2E_VENDOR_PASSWORD!)
  await page.click('[type=submit]')
  await page.waitForURL('/dashboard')
  await page.context().storageState({ path: 'playwright/.auth/vendor.json' })
})
```

### Test pattern

```ts
// tests/briefs.spec.ts
import { test, expect } from '@playwright/test'

test('vendor can create a brief', async ({ page }) => {
  await page.goto('/briefs/new')
  await page.fill('[name=title]', 'Summer Campaign')
  await page.click('[data-testid=submit-brief]')
  await expect(page.locator('[data-testid=brief-editor]')).toBeVisible()
})
```

Use `data-testid` on interactive elements that Playwright targets. Never target by CSS class.

---

## What to test — coverage guide

| Layer | Test type | Priority |
|---|---|---|
| Formatters (`formatters.ts`) | Vitest unit | High — pure functions, deterministic |
| Query hooks (success + error) | Vitest + MSW | High — cache/staleTime logic |
| Mutation hooks (success + concurrency_conflict) | Vitest + MSW | High — invalidation map |
| State badge components | Vitest + Testing Library | Medium |
| Analytics Worker (90d vs 365d) | Vitest | High — main-thread safety |
| Full brief create → lock flow | Playwright | High — critical path |
| Admin goal-template supersede flow | Playwright | Medium |
| Enums | Not tested — they are constants | — |
| `schema.ts` | Not tested — generated | — |
