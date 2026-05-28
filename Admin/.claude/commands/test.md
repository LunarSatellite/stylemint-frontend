# /test — Write Vitest + React Testing Library tests

Write tests for `$ARGUMENTS`.

---

## Rules

1. Vitest as test runner. React Testing Library for component tests.
2. Test files live alongside source: `<Component>.test.tsx` or `<hook>.test.ts`.
3. Query by accessible role/label/text — never by CSS class or test-id unless unavoidable.
4. Mock `@/api/client` axios instance — never make real HTTP calls.
5. Use `msw` (Mock Service Worker) for integration-style tests where realistic responses matter.

---

## Test file structure

```tsx
// src/features/<feature>/<Component>.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTestWrapper } from '@/test/utils'

// system under test
import { FeatureComponent } from './FeatureComponent'

describe('FeatureComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    render(<FeatureComponent />, { wrapper: createTestWrapper() })
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders data after fetch', async () => {
    render(<FeatureComponent />, { wrapper: createTestWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Expected value')).toBeInTheDocument()
    })
  })

  it('calls mutation on submit', async () => {
    const user = userEvent.setup()
    render(<FeatureComponent />, { wrapper: createTestWrapper() })

    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByText('Saved successfully')).toBeInTheDocument()
    })
  })
})
```

---

## Test wrapper (create once in `src/test/utils.tsx`)

```tsx
// src/test/utils.tsx
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'sonner'

export function createTestWrapper(initialPath = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClient>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[initialPath]}>
            {children}
            <Toaster />
          </MemoryRouter>
        </QueryClientProvider>
      </QueryClient>
    )
  }
}

// Re-export RTL utilities so tests import from one place
export { render, screen, waitFor, within, act } from '@testing-library/react'
export { userEvent }
```

---

## Mocking axios

```ts
// src/test/mocks/api.ts
import { vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    patch:  vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

// in test:
import { api } from '@/api/client'
vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], total: 0 } })
```

---

## Custom hook test

```ts
// src/api/queries/useResource.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { api } from '@/api/client'
import { createTestWrapper } from '@/test/utils'
import { useResource } from './useResource'

vi.mock('@/api/client')

describe('useResource', () => {
  it('fetches and returns data', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ id: '1', name: 'Test' }] })

    const { result } = renderHook(
      () => useResource({ page: 1, pageSize: 20 }),
      { wrapper: createTestWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].name).toBe('Test')
  })

  it('surfaces error on API failure', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(
      () => useResource({ page: 1, pageSize: 20 }),
      { wrapper: createTestWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

---

## Form validation test

```tsx
it('shows validation error when name is empty', async () => {
  const user = userEvent.setup()
  render(<FeatureForm />, { wrapper: createTestWrapper() })

  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(await screen.findByText('Name is required')).toBeInTheDocument()
  expect(vi.mocked(api.post)).not.toHaveBeenCalled()
})
```

---

## Permission-gated component test

```tsx
import { useAuth } from '@/auth/store'

it('hides action button when user lacks permission', () => {
  useAuth.setState({ claims: { roles: ['Readonly'] } })
  render(<AdminActions />, { wrapper: createTestWrapper() })
  expect(screen.queryByRole('button', { name: /disable/i })).not.toBeInTheDocument()
})
```

---

## Invariants

- `retry: false` on QueryClient in tests — prevents false timeouts
- Never import from `@testing-library/react` directly in tests — use `@/test/utils`
- Prefer `findBy*` (async) over `waitFor(() => getBy*)` for simpler assertions
- Never use `getByTestId` unless no semantic query is possible
- Auth store state can be set via `useAuth.setState(...)` — no need to mock the entire store
- Clean up mocks in `beforeEach(() => vi.clearAllMocks())`
