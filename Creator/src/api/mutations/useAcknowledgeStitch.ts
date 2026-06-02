import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { showErrorToast } from '@/api/errors'
import type { StitchedReelSuggestionDto } from '@/api/schema'

export function useAcknowledgeStitch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      api.post<StitchedReelSuggestionDto>(`/v1/creator/stitched-reel-suggestions/${id}/acknowledge`).then((r) => r.data),

    onError: showErrorToast,

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: csQk.stitched.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['cs', 'stitched', 'by-reel'] })
    },
  })
}
