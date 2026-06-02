import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk, type ActivityFilter } from '@/api/queryKeys'
import type { PagedResult, VendorActivityEntryDto } from '@/api/schema'

async function fetchActivity(filter: ActivityFilter, cursor?: string) {
  const params: Record<string, unknown> = { pageSize: 25 }
  if (filter.kind?.length) params['kind'] = filter.kind
  if (cursor) params['cursor'] = cursor

  const { data } = await api.get<PagedResult<VendorActivityEntryDto>>('/v1/vendor/activity', { params })
  return data
}

export function useActivity(filter: ActivityFilter = {}) {
  return useInfiniteQuery({
    queryKey:         bsQk.activity(filter),
    queryFn:          ({ pageParam }) => fetchActivity(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  })
}
