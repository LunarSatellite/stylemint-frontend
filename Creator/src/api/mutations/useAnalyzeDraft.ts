import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { useAuth } from '@/auth/store'
import { showErrorToast } from '@/api/errors'
import type { AnalyzeDraftRequest, ReelStudioBriefingDto } from '@/api/schema'

export function useAnalyzeDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (values: AnalyzeDraftRequest) =>
      api.post<ReelStudioBriefingDto>('/v1/creator/studio/analyze', values).then((r) => r.data),

    onMutate: () => {
      useAuth.getState().setBriefingLoading(true)
    },

    onSuccess: (data) => {
      queryClient.setQueryData(csQk.studio.briefing(data.id), data)
      navigate(`/studio/${data.reelDraftId}`)
    },

    onError: (err) => {
      if (isAxiosError(err)) {
        const code = (err.response?.data as Record<string, string>)?.errorCode
        if (code === 'system.rate_limited') {
          const retry = Number(err.response?.headers['retry-after']) || 30
          toast.info(`Still working on your briefing. Try again in ${retry}s.`)
          return
        }
      }
      showErrorToast(err)
    },

    onSettled: () => {
      useAuth.getState().setBriefingLoading(false)
    },
  })
}
