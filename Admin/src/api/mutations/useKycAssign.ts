import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type KycReviewItem    = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.KycReviewItemDto']
type AssignKycRequest = components['schemas']['StyleMint.Modules.Admin.Api.Controllers.V1.ViewModels.Kyc.AssignKycVm']

type Vars = { id: string } & AssignKycRequest

export function useKycAssign(options?: { onSuccess?: (data: KycReviewItem) => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<KycReviewItem, unknown, Vars>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await api.post<KycReviewItem>(`/v1/admin/kyc/${id}/assign`, body)
      return data
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: qk.kyc.detail(vars.id) })
      qc.invalidateQueries({ queryKey: ['kyc', 'queue'], exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
