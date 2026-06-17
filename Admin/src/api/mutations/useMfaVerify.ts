import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useMfaVerify(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async (vars: { code: string }) => {
      await api.post('/v1/admin/auth/mfa/totp/verify', vars)
    },
    onSuccess: () => {
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
