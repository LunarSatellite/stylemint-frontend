import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'sonner'

export function createTestWrapper(initialPath = '/') {
  const qc = new QueryClient({
    defaultOptions: {
      queries:   { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialPath]}>
          {children}
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

export { render, screen, waitFor, within, act } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
