import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { showErrorToast } from '@/api/errors'
import type { BoostOfferDto } from '@/api/schema'

export function useAcceptBoostOffer(reelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      api.post<BoostOfferDto>(`/v1/creator/boost-offers/${id}/accept`).then((r) => r.data),

    onError: showErrorToast,

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: csQk.boostOffers.detail(id) })
      queryClient.invalidateQueries({ queryKey: csQk.postPublish.report(reelId) })
    },
  })
}
