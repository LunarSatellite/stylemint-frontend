import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type ModerationItem          = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.ModerationItemDto']
type DecideModerationRequest = components['schemas']['StyleMint.Modules.Admin.Api.Controllers.V1.ViewModels.Moderation.DecideModerationVm']

type Vars = { id: string } & DecideModerationRequest

export function useModerationDecide(options?: {
  onSuccess?: (data: ModerationItem) => void
  onError?:  (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<ModerationItem, unknown, Vars>({
    mutationFn: async ({ id, action, decisionNote }) => {
      const { data } = await api.post<ModerationItem>(
        `/v1/admin/moderation/${id}/decide`,
        { action, decisionNote },
      )
      return data
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: qk.moderation.detail(vars.id) })
      qc.invalidateQueries({ queryKey: ['mod', 'queue'], exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
