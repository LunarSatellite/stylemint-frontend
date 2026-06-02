import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { ReelStudioBriefingDto } from '@/api/schema'

export function useBriefing(id: string) {
  return useQuery({
    queryKey: csQk.studio.briefing(id),
    queryFn: () =>
      api.get<ReelStudioBriefingDto>(`/v1/creator/studio/briefings/${id}`).then((r) => r.data),
    staleTime: 86_400_000,
    gcTime: 0,
    enabled: !!id,
  })
}
