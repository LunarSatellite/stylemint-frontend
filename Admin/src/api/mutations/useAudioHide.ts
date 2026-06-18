import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { paths, components } from '@/api/schema'

type HideTrackVm = components['schemas']['StyleMint.Modules.Audio.Api.Controllers.V1.ViewModels.Tracks.HideTrackVm']
type Vars        = { trackId: string } & HideTrackVm

export function useAudioHide(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<void, unknown, Vars>({
    mutationFn: async ({ trackId, reason }) => {
      await api.post(`/v1/admin/audio/tracks/${trackId}/hide`, { reason })
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['audio', 'tracks'], exact: false })
      qc.invalidateQueries({ queryKey: qk.audioTrack(vars.trackId) })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
