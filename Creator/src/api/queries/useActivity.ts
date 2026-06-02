import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import type { CreatorActivityKind } from '@/lib/enums'
import type { PagedResult, CreatorActivityEntryDto } from '@/api/schema'

interface ActivityFilter { kinds?: CreatorActivityKind[] }

export function useActivity(filter: ActivityFilter = {}) {
  return useInfiniteQuery({
    queryKey: csQk.activity(filter),
    queryFn: ({ pageParam }) =>
      api
        .get<PagedResult<CreatorActivityEntryDto>>('/v1/creator/activity', {
          params: { ...filter, cursor: pageParam, pageSize: 25 },
        })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  })
}
