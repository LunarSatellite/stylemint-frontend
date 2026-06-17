import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type AdminSessionDto = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.AdminSessionDto']

export function useAdminSessions(adminAccountId: string) {
  return useQuery<AdminSessionDto[]>({
    queryKey: qk.adminSessions(adminAccountId),
    queryFn: async () => {
      const { data } = await api.get<AdminSessionDto[]>(`/v1/admin/admins/${adminAccountId}/sessions`)
      return data
    },
    staleTime: 30_000,
  })
}
