import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type AnalyticsWindow } from '@/api/queryKeys'
import type { PartnershipId } from '@/lib/brands'
import type { VendorCreatorAnalyticsDto } from '@/api/schema'

export function useCreatorAnalytics(partnershipId: PartnershipId, window: AnalyticsWindow) {
  return useQuery({
    queryKey: bsQk.analytics.creatorByPartnership(partnershipId, window),
    queryFn:  async () => {
      const { data } = await api.get<VendorCreatorAnalyticsDto>(
        `/v1/vendor/partnerships/${partnershipId}/creator-analytics`,
        { params: { windowDays: window.windowDays } },
      )
      return data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
