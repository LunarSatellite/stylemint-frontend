import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/me')
      return data
    },
    staleTime: 30_000,
  })
}
