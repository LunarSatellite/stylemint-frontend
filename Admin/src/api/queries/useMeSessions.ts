import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMeSessions() {
  return useQuery({
    queryKey: qk.meSessions(),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/me/sessions')
      return data
    },
    staleTime: 30_000,
  })
}
