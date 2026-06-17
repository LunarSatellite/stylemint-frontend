import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

type RefundVars = {
  paymentIntentId: string
  amount: number
  currency: string
  reason: string
}

export function useRefund(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async ({ paymentIntentId, amount, currency, reason }: RefundVars) => {
      const { data } = await api.post(`/v1/admin/payments/${paymentIntentId}/refund`, { amount, currency, reason })
      return data
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
