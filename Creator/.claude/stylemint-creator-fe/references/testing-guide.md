# Testing Guide — stylemint-creator-fe

Stack: **Vitest** + **React Testing Library** for unit/integration tests · **MSW** for API mocking · **Playwright** for E2E.

---

## What to Test

| Layer | Test with | Goal |
|---|---|---|
| Utility functions (`formatters.ts`, `errorMessages.ts`) | Vitest unit tests | Pure logic correctness |
| Custom hooks (`useServerAnchoredCountdown`, etc.) | Vitest + `renderHook` | Hook contracts |
| Query/mutation hooks | Vitest + MSW | Correct data transformation, error paths |
| Feature components | RTL integration tests | User-visible behavior, not implementation |
| Critical user flows | Playwright E2E | Full path: login → action → result |

## What NOT to Test

- Third-party library behavior (TanStack Query internals, Zustand, RHF)
- Rendering output pixel-by-pixel (snapshot tests for JSX are fragile and valueless)
- Private implementation details (internal state, private methods)
- Trivial wrappers that are just markup

---

## Vitest Config

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/api/schema.ts', 'src/test/**'],
    },
  },
})
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom'
import { server } from './msw-server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

---

## MSW — API Mocking

```ts
// src/test/msw-server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
```

```ts
// src/test/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/v1/creator/studio/briefings/:id', ({ params }) =>
    HttpResponse.json(buildBriefing({ id: params.id as string }))
  ),
  http.post('/v1/creator/studio/analyze', () =>
    HttpResponse.json(buildAnalyzeResult())
  ),
]
```

Test-specific overrides go in the test file itself using `server.use(...)`. This isolates error/edge cases.

---

## Testing a Query Hook

```ts
// src/api/queries/useBriefing.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/test-utils'
import { useBriefing } from './useBriefing'
import { server } from '@/test/msw-server'
import { http, HttpResponse } from 'msw'

describe('useBriefing', () => {
  it('returns briefing data on success', async () => {
    const { result } = renderHook(() => useBriefing('briefing-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('briefing-1')
  })

  it('returns error on 404', async () => {
    server.use(
      http.get('/v1/creator/studio/briefings/:id', () =>
        HttpResponse.json({ errorCode: 'resource.not_found' }, { status: 404 })
      )
    )
    const { result } = renderHook(() => useBriefing('not-found'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

```ts
// src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}
```

---

## Testing a Component

Test user behavior, not implementation. Use accessible queries (role, label, text).

```tsx
// src/features/reel-studio/HookScoreBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { HookScoreBadge } from './HookScoreBadge'

describe('HookScoreBadge', () => {
  it('displays formatted score', () => {
    render(<HookScoreBadge score={0.87} label="Hook Score" />)
    expect(screen.getByText('Hook Score')).toBeInTheDocument()
    expect(screen.getByText('87.0%')).toBeInTheDocument()
  })
})
```

```tsx
// Testing a mutation flow
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalyzeDraftForm } from './AnalyzeDraftForm'

it('shows loading state while analyzing', async () => {
  const user = userEvent.setup()
  render(<AnalyzeDraftForm />, { wrapper: createWrapper() })

  await user.type(screen.getByLabelText('Caption'), 'My great reel caption')
  await user.click(screen.getByRole('button', { name: /analyze/i }))

  expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled()
  await waitFor(() => expect(screen.queryByRole('button', { name: /analyzing/i })).not.toBeInTheDocument())
})
```

---

## Testing the 429 Soft Message

```ts
it('shows soft message on /analyze 429', async () => {
  server.use(
    http.post('/v1/creator/studio/analyze', () =>
      HttpResponse.json(
        { errorCode: 'system.rate_limited' },
        { status: 429, headers: { 'retry-after': '30' } }
      )
    )
  )
  // ... trigger mutation, assert toast.info was called with soft message
})
```

---

## Playwright E2E

```ts
// e2e/reel-studio.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Reel Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('creator@example.com')
    await page.getByLabel('Password').fill('test-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/analytics')
  })

  test('analyze flow shows loading screen and navigates to briefing', async ({ page }) => {
    await page.goto('/studio/draft-123')
    await page.getByLabel('Caption').fill('Watch till the end!')
    await page.getByRole('button', { name: 'Analyze Draft' }).click()

    await expect(page.getByText('Analyzing your draft…')).toBeVisible()
    await expect(page).toHaveURL(/\/studio\/reel-/, { timeout: 20_000 })
  })
})
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## Test File Naming

```
src/features/reel-studio/HookScoreBadge.tsx       → HookScoreBadge.test.tsx
src/api/queries/useBriefing.ts                     → useBriefing.test.ts
src/lib/formatters.ts                              → formatters.test.ts
e2e/                                               → reel-studio.spec.ts
```

---

## Coverage Targets

| Area | Target |
|---|---|
| Utility functions | 100% |
| Custom hooks | ≥ 90% |
| Query/mutation hooks | ≥ 80% |
| Feature components (critical paths) | ≥ 70% |
| E2E (happy path per feature) | 1 spec minimum |
