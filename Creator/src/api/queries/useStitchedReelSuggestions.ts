import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { StitchedReelSuggestionDto } from '@/api/schema'

export function useStitchedReelSuggestions(reelId: string) {
  return useQuery({
    queryKey: csQk.stitched.byReel(reelId),
    queryFn: () =>
      api.get<StitchedReelSuggestionDto[]>(`/v1/creator/stitched-reel-suggestions/by-reel/${reelId}`).then((r) => r.data),
    staleTime: 30_000,
    enabled: !!reelId,
  })
}
