import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { StoryArcState } from '@/lib/enums'
import type { StoryArcDto } from '@/api/schema'

interface ArcFilter { state?: StoryArcState[] }

export function useStoryArcList(filter: ArcFilter = {}) {
  return useQuery({
    queryKey: csQk.storyArcs.list(filter),
    queryFn: () =>
      api.get<StoryArcDto[]>('/v1/creator/story-arcs', { params: filter }).then((r) => r.data),
    staleTime: 30_000,
  })
}
