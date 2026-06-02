import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { asBriefId } from '@/lib/brands'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'

export function useBriefDetail(id: BriefId) {
  return useQuery({
    queryKey: bsQk.briefs.detail(id),
    queryFn:  async () => {
      const { data } = await api.get<BrandBriefDto>(`/v1/vendor/briefs/${id}`)
      return { ...data, id: asBriefId(data.id) }
    },
    staleTime: 30_000,
    gcTime:    0,
  })
}
