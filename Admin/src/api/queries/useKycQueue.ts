import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type {
  KycCreatorQueueFilter,
  KycVendorQueueFilter,
  KycReviewQueueFilter,
  PagedResult,
  CreatorApplicationDto,
  VendorApplicationDto,
  KycReviewItemDto,
} from '@/api/schema'

// ── Legacy queue queries (kept for backward-compat until fully migrated) ───────

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

// ── New unified KYC review queue (KycReviewItem) ───────────────────────────────

export function useKycReviewQueue(filter: KycReviewQueueFilter) {
  return useQuery<PagedResult<KycReviewItemDto>>({
    queryKey:        qk.kyc.queue(filter),
    queryFn:         async () => {
      const { data } = await api.get<PagedResult<KycReviewItemDto>>('/v1/admin/kyc/queue', { params: filter })
      return data
    },
    staleTime:       10_000,
    placeholderData: keepPreviousData,
  })
}

export function useKycReviewItem(kycItemId: string) {
  return useQuery<KycReviewItemDto>({
    queryKey:        qk.kyc.detail(kycItemId),
    queryFn:         async () => {
      const { data } = await api.get<KycReviewItemDto>(`/v1/admin/kyc/${kycItemId}`)
      return data
    },
    enabled:         !!kycItemId,
    staleTime:       10_000,
  })
}
