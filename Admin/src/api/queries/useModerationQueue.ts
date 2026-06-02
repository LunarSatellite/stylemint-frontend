import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { ModerationQueueFilter, ModerationQueuePage } from '@/types/moderation'

export function useModerationQueue(filter: ModerationQueueFilter) {
  return useQuery<ModerationQueuePage>({
    queryKey:        qk.moderation.queue(filter),
    queryFn:         async () => {
      const { data } = await api.get<ModerationQueuePage>('/v1/admin/moderation/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}
