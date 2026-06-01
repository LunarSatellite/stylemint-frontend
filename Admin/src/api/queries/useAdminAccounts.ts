import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type AdminFilter = { page: number; pageSize: number; search?: string; state?: number }

export function useAdminAccounts(filter: AdminFilter) {
  return useQuery({
    queryKey: qk.admins(filter),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/admins', { params: filter })
      return data
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useAdminAccount(id: string) {
  return useQuery({
    queryKey: qk.admin(id),
    queryFn: async () => {
      const { data } = await api.get(`/v1/admin/admins/${id}`)
      return data
    },
    staleTime: 30_000,
    enabled: Boolean(id),
  })
}
