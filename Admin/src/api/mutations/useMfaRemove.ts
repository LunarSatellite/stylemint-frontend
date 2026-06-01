import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMfaRemove(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/v1/admin/me/mfa/totp')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meMfa() })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
