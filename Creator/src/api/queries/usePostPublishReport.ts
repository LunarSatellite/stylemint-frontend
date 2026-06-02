import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { PostPublishReportDto } from '@/api/schema'

export function usePostPublishReport(reelId: string) {
  return useQuery({
    queryKey: csQk.postPublish.report(reelId),
    queryFn: () =>
      api.get<PostPublishReportDto>(`/v1/creator/reels/${reelId}/post-publish-report`).then((r) => r.data),
    staleTime: 300_000,
    gcTime: 0,
    enabled: !!reelId,
  })
}
