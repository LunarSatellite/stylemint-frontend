import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { CreatorAnalyticsOverviewDto } from '@/api/schema'

interface Window { fromUtc: string; toUtc: string }

export function useAnalyticsOverview(window: Window) {
  return useQuery({
    queryKey: csQk.analytics.overview(window),
    queryFn: () =>
      api.get<CreatorAnalyticsOverviewDto>('/v1/creator/analytics/overview', { params: window }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!window.fromUtc && !!window.toUtc,
  })
}
