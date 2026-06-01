import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useFeatureFlagUpsert(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { key: string; enabled: boolean; description?: string }) => {
      const { data } = await api.put(`/v1/admin/feature-flags/${vars.key}`, vars)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.flags() })
      qc.invalidateQueries({ queryKey: qk.flag(vars.key) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
