import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useFeatureFlagOverride(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { key: string; userId: string; enabled: boolean }) => {
      const { data } = await api.post(`/v1/admin/feature-flags/${vars.key}/overrides`, vars)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.flag(vars.key) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
