import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'

export function useSsoLogin() {
  return useMutation({
    mutationFn: async (idToken: string) => {
      const { data } = await api.post('/v1/admin/auth/sso', { idToken })
      return data as { accessToken: string }
    },
    onSuccess: ({ accessToken }) => {
      useAuth.getState().setToken(accessToken)
    },
  })
}
