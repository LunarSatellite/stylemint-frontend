import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMfaConfirm(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { code: string }) => {
      const { data } = await api.post('/v1/admin/me/mfa/totp/confirm', vars)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meMfa() })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
