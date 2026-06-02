import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import type { VendorId } from '@/lib/brands'
import type { VendorBrandStudioPolicyDto } from '@/api/schema'

export function useVendorPolicy(vendorProfileId: VendorId) {
  return useQuery({
    queryKey: bsQk.policies.detail(vendorProfileId),
    queryFn:  async () => {
      const { data } = await api.get<VendorBrandStudioPolicyDto>(
        `/v1/admin/brand-studio/policies/${vendorProfileId}`,
      )
      return data
    },
    staleTime: 60_000,
  })
}
