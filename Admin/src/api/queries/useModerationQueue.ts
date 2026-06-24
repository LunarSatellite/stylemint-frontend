import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { ModerationQueueFilter, PagedList, ModerationItemDto } from '@/api/schema'

export function useModerationQueue(filter: ModerationQueueFilter) {
  return useQuery<PagedList<ModerationItemDto>>({
    queryKey:        qk.moderation.queue(filter),
    queryFn:         async () => {
      const { data } = await api.get<PagedList<ModerationItemDto>>('/v1/admin/moderation/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}
