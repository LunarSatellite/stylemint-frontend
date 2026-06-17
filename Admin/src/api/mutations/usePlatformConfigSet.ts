import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

type SetConfigVars = { key: string; valueJson: string; description?: string }

export function usePlatformConfigSet(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, valueJson, description }: SetConfigVars) => {
      const { data } = await api.put(`/v1/admin/platform-config/${key}`, { valueJson, description })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.config() })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
