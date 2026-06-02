import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { StoryArcDto } from '@/api/schema'

export function useStoryArcDetail(id: string) {
  return useQuery({
    queryKey: csQk.storyArcs.detail(id),
    queryFn: () =>
      api.get<StoryArcDto>(`/v1/creator/story-arcs/${id}`).then((r) => r.data),
    staleTime: 30_000,
    enabled: !!id,
  })
}
