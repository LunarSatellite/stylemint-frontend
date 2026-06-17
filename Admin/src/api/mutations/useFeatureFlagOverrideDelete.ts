import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type DeleteOverrideVars = {
  key: string
  roleKind?: 'Customer' | 'Creator' | 'Vendor'
  accountId?: string
}

export function useFeatureFlagOverrideDelete(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: DeleteOverrideVars) => {
      const { key, ...body } = vars
      const { data } = await api.delete(`/v1/admin/feature-flags/${key}/overrides`, { data: body })
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.flag(vars.key) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
