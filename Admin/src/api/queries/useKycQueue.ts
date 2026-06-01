import { useQuery } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type KycQueueFilter = { page: number; pageSize: number; state?: number; search?: string }

export function useKycQueue(filter: KycQueueFilter) {
  return useQuery({
    queryKey: qk.kyc.queue(filter),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/kyc/queue', { params: filter })
      return data
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })
}
