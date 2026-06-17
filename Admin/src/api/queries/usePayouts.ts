import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type PayoutFilter = { cursor?: string; pageSize: number }

export function usePayouts(filter: PayoutFilter) {
  return useQuery({
    queryKey: qk.payouts(filter),
    queryFn: async () => {
      const { data } = await api.get('/v1/payouts', { params: filter })
      return data
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
