import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto, BrandBriefState } from '@/api/schema'

interface UpdateBriefBody {
  title?:          string
  primaryGoal?:    number
  commissionRange?: { minPercent: number; maxPercent: number }
  boostBudgetAmount?:   number
  boostBudgetCurrency?: string
  rowVersion:      string
}

export function useUpdateBrief() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: BriefId; body: UpdateBriefBody }) =>
      api.patch<BrandBriefDto>(`/v1/vendor/briefs/${id}`, body).then((r) => r.data),

    onSuccess: (updated, { id }) => {
      qc.setQueryData(bsQk.briefs.detail(id), updated)
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      toast.success('Brief saved.')
    },

    onError: (error, { id }) => {
      const { errorCode, correlationId } = extractApiError(error)
      if (errorCode === 'state.concurrency_conflict') {
        qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
        toast.warning('Someone else changed this brief. Refreshing…')
        return
      }
      showErrorToast(errorCode, correlationId)
    },
  })
}
