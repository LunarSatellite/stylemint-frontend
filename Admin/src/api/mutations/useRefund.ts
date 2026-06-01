import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useRefund(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async (vars: { orderId: string; amount: number; reason: string }) => {
      const { data } = await api.post('/v1/admin/refunds', vars)
      return data
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
