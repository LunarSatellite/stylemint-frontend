import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { showErrorToast } from '@/api/errors'
import type { ReelStudioBriefingDto } from '@/api/schema'

export function useRefreshBriefing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      api.post<ReelStudioBriefingDto>(`/v1/creator/studio/briefings/${id}/refresh`).then((r) => r.data),

    onSuccess: (data) => {
      queryClient.setQueryData(csQk.studio.briefing(data.id), data)
    },

    onError: showErrorToast,
  })
}
