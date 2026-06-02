import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { CreatorAnalyticsFullReportDto } from '@/api/schema'

interface Window { fromUtc: string; toUtc: string }

export function useAnalyticsReport(window: Window) {
  return useQuery({
    queryKey: csQk.analytics.report(window),
    queryFn: () =>
      api.get<CreatorAnalyticsFullReportDto>('/v1/creator/analytics/report', { params: window }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!window.fromUtc && !!window.toUtc,
  })
}
