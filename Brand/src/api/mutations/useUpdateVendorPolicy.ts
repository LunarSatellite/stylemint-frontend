import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import type { VendorId } from '@/lib/brands'
import type { VendorBrandStudioPolicyDto } from '@/api/schema'

interface UpdatePolicyBody {
  monthlyLlmCallQuota?:     number
  commissionCeilingPercent?: number
  defaultCurrencyCode?:     string
  rowVersion:               string
}

export function useUpdateVendorPolicy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ vendorProfileId, body }: { vendorProfileId: VendorId; body: UpdatePolicyBody }) =>
      api.patch<VendorBrandStudioPolicyDto>(
        `/v1/admin/brand-studio/policies/${vendorProfileId}`,
        body,
      ).then((r) => r.data),

    onSuccess: (updated, { vendorProfileId }) => {
      qc.setQueryData(bsQk.policies.detail(vendorProfileId), updated)
      toast.success('Vendor policy updated.')
    },

    onError: (error, { vendorProfileId }) => {
      const { errorCode, correlationId } = extractApiError(error)
      if (errorCode === 'state.concurrency_conflict') {
        qc.invalidateQueries({ queryKey: bsQk.policies.detail(vendorProfileId) })
        toast.warning('Policy was updated by someone else. Refreshing…')
        return
      }
      showErrorToast(errorCode, correlationId)
    },
  })
}
