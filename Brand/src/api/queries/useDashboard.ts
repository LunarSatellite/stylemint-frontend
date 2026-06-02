import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import type { VendorDashboardSnapshot } from '@/api/schema'

export function useDashboard(windowDays = 30) {
  return useQuery({
    queryKey: bsQk.dashboard(windowDays),
    queryFn:  async () => {
      const { data } = await api.get<VendorDashboardSnapshot>('/v1/vendor/dashboard', {
        params: { windowDays },
      })
      return data
    },
    staleTime: 60_000,
  })
}
