import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { PostReportDto } from '@/api/schema'

export function useSocialFeedReports(take = 50) {
  return useQuery<PostReportDto[]>({
    queryKey: qk.socialFeedReports(take),
    queryFn:  async () => {
      const { data } = await api.get('/v1/admin/social-feed/reports', { params: { take } })
      return data
    },
    staleTime: 30_000,
  })
}
