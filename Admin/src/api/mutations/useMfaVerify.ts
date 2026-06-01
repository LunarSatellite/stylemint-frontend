import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'

export function useMfaVerify(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async (vars: { code: string }) => {
      const { data } = await api.post('/v1/admin/me/mfa/totp/verify', vars)
      return data as { accessToken: string }
    },
    onSuccess: ({ accessToken }) => {
      useAuth.getState().setToken(accessToken)
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
