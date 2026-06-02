import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { CreatorDashboardDto } from '@/api/schema'

interface Window { fromUtc: string; toUtc: string }

export function useAnalyticsDashboard(window: Window) {
  return useQuery({
    queryKey: csQk.analytics.dashboard(window),
    queryFn: () =>
      api.get<CreatorDashboardDto>('/v1/creator/analytics/dashboard', { params: window }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!window.fromUtc && !!window.toUtc,
  })
}
