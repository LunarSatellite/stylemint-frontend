import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type AdminMfaStatusDto = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.AdminMfaStatusDto']

export function useMeMfa() {
  return useQuery<AdminMfaStatusDto>({
    queryKey: qk.meMfa(),
    queryFn: async () => {
      const { data } = await api.get<AdminMfaStatusDto>('/v1/admin/me/mfa')
      return data
    },
    staleTime: 30_000,
  })
}
