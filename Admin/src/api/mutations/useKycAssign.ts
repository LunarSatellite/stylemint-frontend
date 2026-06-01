import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useKycAssign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; assigneeId: string }) => {
      const { data } = await api.post(`/v1/admin/kyc/${vars.id}/assign`, vars)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.kyc.detail(vars.id) })
      qc.invalidateQueries({ queryKey: ['kyc', 'queue'], exact: false })
    },
  })
}
