import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type BriefListFilter } from '@/api/queryKeys'
import { asBriefId } from '@/lib/brands'
import type { PagedResult, BrandBriefDto } from '@/api/schema'

async function fetchBriefList(filter: BriefListFilter, cursor?: string) {
  const params: Record<string, unknown> = { pageSize: 25 }
  if (filter.state?.length) params['state'] = filter.state
  if (cursor) params['cursor'] = cursor

  const { data } = await api.get<PagedResult<BrandBriefDto>>('/v1/vendor/briefs', { params })
  return {
    ...data,
    items: data.items.map((b) => ({ ...b, id: asBriefId(b.id) })),
  }
}

export function useBriefList(filter: BriefListFilter = {}) {
  return useInfiniteQuery({
    queryKey:         bsQk.briefs.list(filter),
    queryFn:          ({ pageParam }) => fetchBriefList(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}
