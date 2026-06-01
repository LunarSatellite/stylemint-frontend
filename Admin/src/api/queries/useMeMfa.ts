import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMeMfa() {
  return useQuery({
    queryKey: qk.meMfa(),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/me/mfa')
      return data as { hasTotp: boolean; totpLocked: boolean; lockedUntilUtc: string | null }
    },
    staleTime: 30_000,
  })
}
