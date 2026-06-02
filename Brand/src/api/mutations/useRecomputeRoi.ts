import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto, RoiProjectionSummary } from '@/api/schema'

export function useRecomputeRoi() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: BriefId) =>
      api.post<{ roiProjection: RoiProjectionSummary }>(`/v1/vendor/briefs/${id}/recompute-roi`)
        .then((r) => r.data),

    onSuccess: ({ roiProjection }, id) => {
      qc.setQueryData<BrandBriefDto>(
        bsQk.briefs.detail(id),
        (prev) => prev ? { ...prev, roiProjection } : prev,
      )
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },
  })
}
