import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type ModerationQueueFilter = NonNullable<import('@/api/schema').paths['/v1/admin/moderation/queue']['get']['parameters']['query']>
type ModerationQueuePage   = components['schemas']['StyleMint.Shared.Core.PagedList`1[[StyleMint.Modules.Admin.Entity.Dtos.ModerationItemDto, StyleMint.Modules.Admin, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null]]']

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
