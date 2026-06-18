import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { paths } from '@/api/schema'

type CreatorQueueFilter   = NonNullable<paths['/v1/admin/kyc/creator/queue']['get']['parameters']['query']>
type VendorQueueFilter    = NonNullable<paths['/v1/admin/kyc/vendor/queue']['get']['parameters']['query']>
type CreatorQueueResponse = paths['/v1/admin/kyc/creator/queue']['get']['responses']['200']['content']['application/json']
type VendorQueueResponse  = paths['/v1/admin/kyc/vendor/queue']['get']['responses']['200']['content']['application/json']

export function useKycCreatorQueue(filter: CreatorQueueFilter) {
  return useQuery<CreatorQueueResponse>({
    queryKey:        qk.kyc.creatorQueue(filter),
    queryFn:         async () => {
      const { data } = await api.get('/v1/admin/kyc/creator/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}

export function useKycVendorQueue(filter: VendorQueueFilter) {
  return useQuery<VendorQueueResponse>({
    queryKey:        qk.kyc.vendorQueue(filter),
    queryFn:         async () => {
      const { data } = await api.get('/v1/admin/kyc/vendor/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}
