import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type ModDecideVars = { id: string; state: number; reason?: string }

export function useModerationDecide(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: ModDecideVars) => {
      const { data } = await api.post(`/v1/admin/moderation/${vars.id}/decide`, vars)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.moderation.detail(vars.id) })
      qc.invalidateQueries({ queryKey: ['mod', 'queue'], exact: false })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
