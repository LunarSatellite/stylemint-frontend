import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type KycQueueFilter = NonNullable<import('@/api/schema').paths['/v1/admin/kyc/queue']['get']['parameters']['query']>
type KycQueuePage   = components['schemas']['StyleMint.Shared.Core.PagedList`1[[StyleMint.Modules.Admin.Entity.Dtos.KycReviewItemDto, StyleMint.Modules.Admin, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null]]']

export function useKycQueue(filter: KycQueueFilter) {
  return useQuery<KycQueuePage>({
    queryKey:        qk.kyc.queue(filter),
    queryFn:         async () => {
      const { data } = await api.get('/v1/admin/kyc/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}
