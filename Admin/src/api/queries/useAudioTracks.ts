import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { paths } from '@/api/schema'

type AudioTracksFilter   = NonNullable<paths['/v1/admin/audio/tracks']['get']['parameters']['query']>
type AudioTracksResponse = paths['/v1/admin/audio/tracks']['get']['responses']['200']['content']['application/json']

export function useAudioTracks(filter: AudioTracksFilter) {
  return useQuery<AudioTracksResponse>({
    queryKey:        qk.audio(filter),
    queryFn:         async () => {
      const { data } = await api.get('/v1/admin/audio/tracks', { params: filter })
      return data
    },
    staleTime:       30_000,
    placeholderData: keepPreviousData,
  })
}
