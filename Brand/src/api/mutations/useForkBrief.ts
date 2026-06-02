import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import { asBriefId } from '@/lib/brands'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'

export function useForkBrief() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: BriefId; rowVersion: string }) =>
      api.post<BrandBriefDto>(`/v1/vendor/briefs/${id}/fork`, { rowVersion })
        .then((r) => ({ ...r.data, id: asBriefId(r.data.id) })),

    onSuccess: (forked) => {
      qc.setQueryData(bsQk.briefs.detail(forked.id), forked)
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      toast.success('Brief forked. Editing the new version.')
      navigate(`/briefs/${forked.id}`)
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },
  })
}
