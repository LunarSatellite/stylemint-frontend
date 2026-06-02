import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { useAuth } from '@/auth/store'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import { asBriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'
import type { CampaignGoal } from '@/api/schema'

interface DraftBriefBody {
  primaryGoal: CampaignGoal
  title?:      string
}

export function useDraftBrief() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const setDraftingBrief = useAuth((s) => s.setDraftingBrief)

  return useMutation({
    mutationFn: (body: DraftBriefBody) =>
      api.post<BrandBriefDto>('/v1/vendor/briefs', body).then((r) => ({
        ...r.data,
        id: asBriefId(r.data.id),
      })),

    onMutate: () => setDraftingBrief(true),

    onSuccess: (drafted) => {
      qc.setQueryData(bsQk.briefs.detail(drafted.id), drafted)
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      navigate(`/briefs/${drafted.id}`)
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },

    onSettled: () => setDraftingBrief(false),
  })
}
