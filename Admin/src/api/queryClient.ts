import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: unknown) => {
        const status = (err as any)?.response?.status
        if ([401, 403, 404].includes(status)) return false
        return count < 2
      },
      staleTime: 30_000,
    },
  },
})
