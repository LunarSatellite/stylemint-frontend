import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useMfaEnroll(options?: { onSuccess?: (data: { qrCodeUri: string; secret: string }) => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/v1/admin/me/mfa/totp/enroll')
      return data as { qrCodeUri: string; secret: string }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
