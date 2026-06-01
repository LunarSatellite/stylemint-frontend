import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/auth/store'
import { queryClient } from '@/api/queryClient'

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/v1/admin/auth/logout'),
    onSettled: () => {
      useAuth.getState().clear()
      queryClient.clear()
      window.location.assign('/login')
    },
  })
}
