import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type KycQueueFilter = components['schemas']['KycQueueParams']
type KycQueuePage   = components['schemas']['KycReviewItemDtoPagedList']

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
