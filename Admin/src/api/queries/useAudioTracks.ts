import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';
import type { CursorList } from '../types';

/** Shape from `MusicTrackRefDto`. */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  durationSecondsApprox: number | null;
  tempoBpm: number | null;
  genre: string | null;
  mood: string | null;
  language: string | null;
  isInstrumental: boolean;
  citedInReelCount: number;
  avgCitedReelCompletionRate: number | null;
  state: number;
  hiddenReason: string | null;
  createdUtc: string;
  updatedUtc: string | null;
  rowVersion: string;
  links: unknown[] | null;
}

export interface AudioTrackFilter {
  state?: string;
  cursor?: string;
  pageSize?: number;
}

/** Audio keys are local to this module; nothing else invalidates them. */
export const audioKeys = {
  all: () => ['audio'] as const,
  tracks: (f: AudioTrackFilter) => ['audio', 'tracks', f] as const,
  brokenLinks: (cursor?: string) => ['audio', 'links-broken', cursor ?? null] as const,
};

export function useAudioTracks(filter: AudioTrackFilter) {
  return useQuery({
    queryKey: audioKeys.tracks(filter),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CursorList<MusicTrack>>('/v1/admin/audio/tracks', {
        params: { state: filter.state, cursor: filter.cursor, pageSize: filter.pageSize ?? 25 },
        signal,
      });
      return data;
    },
    staleTime: staleTime.flags,
  });
}

/**
 * Tracks whose every source link the daily health check found broken.
 *
 * This is a work queue, not a report: each row is a track that has
 * stopped surfacing in the app until somebody fixes or retires it.
 */
export function useBrokenAudioLinks(cursor?: string) {
  return useQuery({
    queryKey: audioKeys.brokenLinks(cursor),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CursorList<MusicTrack>>(
        '/v1/admin/audio/links-broken-queue',
        { params: { cursor, pageSize: 25 }, signal },
      );
      return data;
    },
    // Short: this is a queue several people may work at once.
    staleTime: staleTime.kycQueue,
  });
}
