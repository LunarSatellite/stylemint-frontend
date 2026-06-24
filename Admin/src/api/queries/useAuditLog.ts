import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type AuditFilter = {
  adminAccountId?: string
  action?:         string
  targetKind?:     string
  targetId?:       string
  fromUtc?:        string
  toUtc?:          string
}

export function useAuditLog(filter: AuditFilter) {
  return useInfiniteQuery({
    queryKey: qk.audit(filter),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get('/v1/admin/audit', {
        params: { ...filter, pageNumber: pageParam, pageSize: 50 },
      })
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (last: any) =>
      last.pageNumber * last.pageSize < last.totalCount ? last.pageNumber + 1 : undefined,
    staleTime: 60_000,
  })
}
