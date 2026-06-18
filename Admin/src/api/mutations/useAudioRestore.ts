import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { paths } from '@/api/schema'

type RestoreResponse = paths['/v1/admin/audio/tracks/{trackId}/restore']['post']['responses']['200']['content']['application/json']

export function useAudioRestore(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<RestoreResponse, unknown, { trackId: string }>({
    mutationFn: async ({ trackId }) => {
      const { data } = await api.post<RestoreResponse>(`/v1/admin/audio/tracks/${trackId}/restore`)
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['audio', 'tracks'], exact: false })
      qc.invalidateQueries({ queryKey: qk.audioTrack(vars.trackId) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
