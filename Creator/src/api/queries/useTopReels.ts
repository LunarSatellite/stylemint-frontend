import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { TopReelsSort } from '@/lib/enums'
import type { TopReelDto } from '@/api/schema'

interface TopReelsQuery { fromUtc: string; toUtc: string; sortBy?: TopReelsSort; limit?: number }

export function useTopReels(query: TopReelsQuery) {
  return useQuery({
    queryKey: csQk.analytics.topReels(query),
    queryFn: () =>
      api.get<TopReelDto[]>('/v1/creator/analytics/top-reels', { params: query }).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!query.fromUtc && !!query.toUtc,
  })
}
