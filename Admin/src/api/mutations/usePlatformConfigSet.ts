import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function usePlatformConfigSet(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { key: string; value: unknown }) => {
      const { data } = await api.patch('/v1/admin/platform-config', vars)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.config() })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
