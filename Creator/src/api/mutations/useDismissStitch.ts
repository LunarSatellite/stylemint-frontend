import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { showErrorToast } from '@/api/errors'
import type { DismissStitchedReelRequest, StitchedReelSuggestionDto } from '@/api/schema'

export function useDismissStitch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: DismissStitchedReelRequest }) =>
      api.post<StitchedReelSuggestionDto>(`/v1/creator/stitched-reel-suggestions/${id}/dismiss`, body ?? {}).then((r) => r.data),

    onError: showErrorToast,

    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: csQk.stitched.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['cs', 'stitched', 'by-reel'] })
    },
  })
}
