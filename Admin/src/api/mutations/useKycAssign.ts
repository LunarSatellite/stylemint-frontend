import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { KycReviewItemDto, AssignKycVm } from '@/api/schema'

type KycReviewItem = KycReviewItemDto
type Vars = { id: string } & AssignKycVm

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
