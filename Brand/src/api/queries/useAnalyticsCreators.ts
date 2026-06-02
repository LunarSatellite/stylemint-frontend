import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type AnalyticsWindow } from '@/api/queryKeys'
import type { VendorCreatorPerformancePageDto } from '@/api/schema'

export function useAnalyticsCreators(window: AnalyticsWindow) {
  return useQuery({
    queryKey: bsQk.analytics.creators(window),
    queryFn:  async () => {
      const { data } = await api.get<VendorCreatorPerformancePageDto>('/v1/vendor/analytics/creators', {
        params: { windowDays: window.windowDays },
      })
      return data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
