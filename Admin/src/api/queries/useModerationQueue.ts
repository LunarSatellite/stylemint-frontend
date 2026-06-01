import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type ModFilter = { page: number; pageSize: number; state?: number; search?: string }

export function useModerationQueue(filter: ModFilter) {
  return useQuery({
    queryKey: qk.moderation.queue(filter),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/moderation/queue', { params: filter })
      return data
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })
}
