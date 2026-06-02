import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { ReelRecipeCitationDto } from '@/api/schema'

export function useRecipeCitations(reelId: string) {
  return useQuery({
    queryKey: csQk.recipes.citations(reelId),
    queryFn: () =>
      api.get<ReelRecipeCitationDto[]>(`/v1/creator/reels/${reelId}/recipe-citations`).then((r) => r.data),
    staleTime: 60_000,
    enabled: !!reelId,
  })
}
