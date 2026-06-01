import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function usePayoutHold(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const { data } = await api.post(`/v1/admin/payouts/${vars.id}/hold`, vars)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payouts'], exact: false })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
