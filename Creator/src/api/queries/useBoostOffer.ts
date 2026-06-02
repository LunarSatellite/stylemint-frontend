import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { BoostOfferState } from '@/lib/enums'
import type { BoostOfferDto } from '@/api/schema'

export function useBoostOffer(id: string) {
  return useQuery({
    queryKey: csQk.boostOffers.detail(id),
    queryFn: () =>
      api.get<BoostOfferDto>(`/v1/creator/boost-offers/${id}`).then((r) => r.data),
    staleTime: 0,
    enabled: !!id,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      if (state === BoostOfferState.Accepted || state === BoostOfferState.Expired) return false
      return 60_000
    },
  })
}
