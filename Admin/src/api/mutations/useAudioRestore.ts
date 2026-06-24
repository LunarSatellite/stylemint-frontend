import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { MusicTrackRefDto } from '@/api/schema'

export function useAudioRestore(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<MusicTrackRefDto, unknown, { trackId: string }>({
    mutationFn: async ({ trackId }) => {
      const { data } = await api.post<MusicTrackRefDto>(`/v1/admin/audio/tracks/${trackId}/restore`)
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
