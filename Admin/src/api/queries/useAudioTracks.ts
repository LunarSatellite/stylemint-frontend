import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { AudioTracksFilter, PagedResult, MusicTrackRefDto } from '@/api/schema'

export function useAudioTracks(filter: AudioTracksFilter) {
  return useQuery<PagedResult<MusicTrackRefDto>>({
    queryKey:        qk.audio(filter),
    queryFn:         async () => {
      const { data } = await api.get<PagedResult<MusicTrackRefDto>>('/v1/admin/audio/tracks', { params: filter })
      return data
    },
    staleTime:       30_000,
    placeholderData: keepPreviousData,
  })
}
