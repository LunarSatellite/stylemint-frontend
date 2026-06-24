import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { PrivacyDashboardDto } from '@/api/schema'

export function usePrivacyDashboard() {
  return useQuery<PrivacyDashboardDto>({
    queryKey: qk.privacyDashboard(),
    queryFn: async () => {
      const { data } = await api.get<PrivacyDashboardDto>('/v1/admin/privacy/dashboard')
      return data
    },
    staleTime: 60_000,
  })
}
