import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { ModerationItemDto, AssignModerationVm } from '@/api/schema'

type ModerationItem = ModerationItemDto
type Vars = { id: string } & AssignModerationVm

export function useModerationAssign(options?: {
  onSuccess?: (data: ModerationItem) => void
  onError?:  (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<ModerationItem, unknown, Vars>({
    mutationFn: async ({ id, reviewerAdminId }) => {
      const { data } = await api.post<ModerationItem>(
        `/v1/admin/moderation/${id}/assign`,
        { reviewerAdminId },
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
