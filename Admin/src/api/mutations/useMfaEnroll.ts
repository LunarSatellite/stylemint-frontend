import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type AdminMfaEnrollmentDto = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.AdminMfaEnrollmentDto']

export function useMfaEnroll(options?: { onSuccess?: (data: AdminMfaEnrollmentDto) => void; onError?: (e: unknown) => void }) {
  return useMutation({
    mutationFn: async (vars?: { label?: string }) => {
      const { data } = await api.post<AdminMfaEnrollmentDto>('/v1/admin/auth/mfa/totp/enroll', vars ?? {})
      return data
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
