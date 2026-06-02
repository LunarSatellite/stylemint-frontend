import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import { asBriefId } from '@/lib/brands'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'

export function useRetireBrief() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: BriefId; rowVersion: string }) =>
      api.post<BrandBriefDto>(`/v1/vendor/briefs/${id}/retire`, { rowVersion })
        .then((r) => ({ ...r.data, id: asBriefId(r.data.id) })),

    onSuccess: (retired, { id }) => {
      qc.setQueryData(bsQk.briefs.detail(id), retired)
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      toast.success('Brief retired.')
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
