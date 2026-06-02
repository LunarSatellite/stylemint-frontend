import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type AnalyticsWindow } from '@/api/queryKeys'
import type { ProductId } from '@/lib/brands'
import type { VendorProductAnalyticsDto } from '@/api/schema'

export function useProductAnalytics(productId: ProductId, window: AnalyticsWindow) {
  return useQuery({
    queryKey: bsQk.analytics.product(productId, window),
    queryFn:  async () => {
      const { data } = await api.get<VendorProductAnalyticsDto>(
        `/v1/vendor/products/${productId}/analytics`,
        { params: { windowDays: window.windowDays } },
      )
      return data
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
