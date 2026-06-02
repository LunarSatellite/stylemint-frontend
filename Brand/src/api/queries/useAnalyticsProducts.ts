import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type AnalyticsWindow } from '@/api/queryKeys'
import type { VendorTopProductsPageDto } from '@/api/schema'

export function useAnalyticsProducts(window: AnalyticsWindow) {
  return useQuery({
    queryKey: bsQk.analytics.products(window),
    queryFn:  async () => {
      const { data } = await api.get<VendorTopProductsPageDto>('/v1/vendor/analytics/products', {
        params: { windowDays: window.windowDays },
      })
      return data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
