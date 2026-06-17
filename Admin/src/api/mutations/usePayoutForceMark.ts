import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp'

export function usePayoutForceMark(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutationWithStepUp(
    async (vars: { id: string; state: 'paid' | 'failed'; reason: string }) => {
      const endpoint = vars.state === 'paid' ? 'force-paid' : 'force-failed'
      const { data } = await api.post(`/v1/admin/payouts/${vars.id}/${endpoint}`, { reason: vars.reason })
      return data
    },
    {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['payouts'], exact: false })
        options?.onSuccess?.()
      },
    },
  )
}
