import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type PrivacyDashboardDto = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.PrivacyDashboardDto']

export function usePrivacyDashboard() {
  return useQuery<PrivacyDashboardDto>({
    queryKey: qk.privacyDashboard(),
    queryFn: async () => {
      const { data } = await api.get<PrivacyDashboardDto>('/v1/admin/privacy-dashboard')
      return data
    },
    staleTime: 60_000,
  })
}
