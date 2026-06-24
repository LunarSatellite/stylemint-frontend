import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'
import type { AuthAdminSessionDto } from '@/api/schema'

export function useSsoLogin() {
  return useMutation({
    mutationFn: async (idToken: string) => {
      const { data } = await api.post<AuthAdminSessionDto>('/v1/admin/auth/sso', { idToken })
      return data
    },
    onSuccess: (data) => {
      useAuth.getState().setToken(data.accessToken!, (data.roles ?? []) as number[])
    },
  })
}
