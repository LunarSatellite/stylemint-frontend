import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { showErrorToast } from '@/api/errors'
import type { CiteRecipeRequest, ReelRecipeCitationDto } from '@/api/schema'

export function useCiteRecipe(reelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CiteRecipeRequest) =>
      api.post<ReelRecipeCitationDto>(`/v1/creator/reels/${reelId}/recipe-citation`, body).then((r) => r.data),

    onError: (err) => {
      if (isAxiosError(err) && (err.response?.data as Record<string, string>)?.errorCode === 'state.duplicate') return
      showErrorToast(err)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: csQk.recipes.citations(reelId) })
    },
  })
}
