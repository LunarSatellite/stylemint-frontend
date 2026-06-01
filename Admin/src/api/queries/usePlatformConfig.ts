import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function usePlatformConfig() {
  return useQuery({
    queryKey: qk.config(),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/platform-config')
      return data
    },
    staleTime: 60_000,
  })
}
