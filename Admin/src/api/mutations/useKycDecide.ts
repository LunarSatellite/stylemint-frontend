import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type KycDecideVars = { id: string; state: number; reason?: string }

export function useKycDecide(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: KycDecideVars) => {
      const { data } = await api.post(`/v1/admin/kyc/${vars.id}/decide`, vars)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.kyc.detail(vars.id) })
      qc.invalidateQueries({ queryKey: ['kyc', 'queue'], exact: false })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
