import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { KycCreatorQueueFilter, KycVendorQueueFilter, PagedResult, CreatorApplicationDto, VendorApplicationDto } from '@/api/schema'

export function useKycCreatorQueue(filter: KycCreatorQueueFilter) {
  return useQuery<PagedResult<CreatorApplicationDto>>({
    queryKey:        qk.kyc.creatorQueue(filter),
    queryFn:         async () => {
      const { data } = await api.get<PagedResult<CreatorApplicationDto>>('/v1/admin/kyc/creator/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}

export function useKycVendorQueue(filter: KycVendorQueueFilter) {
  return useQuery<PagedResult<VendorApplicationDto>>({
    queryKey:        qk.kyc.vendorQueue(filter),
    queryFn:         async () => {
      const { data } = await api.get<PagedResult<VendorApplicationDto>>('/v1/admin/kyc/vendor/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}
