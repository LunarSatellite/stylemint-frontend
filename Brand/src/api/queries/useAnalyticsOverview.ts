import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type AnalyticsWindow } from '@/api/queryKeys'
import type { VendorAnalyticsOverviewDto } from '@/api/schema'

export function useAnalyticsOverview(window: AnalyticsWindow) {
  return useQuery({
    queryKey: bsQk.analytics.overview(window),
    queryFn:  async () => {
      const { data } = await api.get<VendorAnalyticsOverviewDto>('/v1/vendor/analytics/overview', {
        params: { windowDays: window.windowDays },
      })
      return data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
