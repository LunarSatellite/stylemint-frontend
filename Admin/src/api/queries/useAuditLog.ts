import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type AuditFilter = { search?: string; actorId?: string; action?: string }

export function useAuditLog(filter: AuditFilter) {
  return useInfiniteQuery({
    queryKey: qk.audit(filter),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get('/v1/admin/audit', {
        params: { ...filter, page: pageParam, pageSize: 50 },
      })
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (last: any) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    staleTime: 60_000,
  })
}
