import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { ReelAnalyticsDto } from '@/api/schema'

interface Window { fromUtc: string; toUtc: string }

export function useReelAnalytics(reelId: string, window: Window) {
  return useQuery({
    queryKey: csQk.analytics.reel(reelId, window),
    queryFn: () =>
      api.get<ReelAnalyticsDto>(`/v1/creator/analytics/reels/${reelId}`, { params: window }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!reelId && !!window.fromUtc && !!window.toUtc,
  })
}
