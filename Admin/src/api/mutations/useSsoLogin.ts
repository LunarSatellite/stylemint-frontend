import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'
import type { components } from '@/api/schema'

type SsoLoginDto = components['schemas']['StyleMint.Modules.Admin.Service.AdminAuthService.Dtos.AdminSessionDto']

export function useSsoLogin() {
  return useMutation({
    mutationFn: async (idToken: string) => {
      const { data } = await api.post<SsoLoginDto>('/v1/admin/auth/sso', { idToken })
      return data
    },
    onSuccess: (data) => {
      useAuth.getState().setToken(data.accessToken!, (data.roles ?? []) as number[])
    },
  })
}
