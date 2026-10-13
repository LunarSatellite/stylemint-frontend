import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Community: stories (SocialFeed), live shopping (SocialGraph `/v1/live-commerce`), drop parties (SocialGraph),
 * audio library (Audio). Media for a story is staged first with `POST /v1/social/media` (field `file`).
 *
 * - Live: `/v1/live-commerce` (validated, has a "mine" list). Its `status` is a STRING, unlike other enums.
 * - Drop parties: only live parties are listed by the server and there is no "my parties" list, so parties
 *   scheduled here are remembered in this browser (`rememberParty`) and re-read by id.
 * - Audio links out (`primaryListenUrl` / `listenUrl`); there is no in-app playback.
 */

/** The site caps request bodies at 25 MB (nginx), below the API's own 60 MB video limit. */
export const SITE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

export interface MediaUpload {
  url: string;
  thumbnailUrl?: string | null;
  contentType: string;
  kind: number;
  durationSeconds?: number | null;
}

export const StoryMediaType = { Image: 1, Video: 2 } as const;
export interface Story {
  id: string;
  mediaType: number;
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  durationSeconds: number | null;
  postedUtc: string;
  expiresUtc: string;
  viewCount: number;
  replyCount: number;
}

export type LiveStatus = 'Scheduled' | 'Live' | 'Ended' | 'Cancelled';
export const liveStatusColor: Record<string, string> = { Scheduled: 'blue', Live: 'signal', Ended: 'gray', Cancelled: 'gray' };
export interface LiveSession {
  id: string;
  title: string;
  status: LiveStatus | string;
  scheduledStartUtc: string;
  actualStartUtc: string | null;
  endedUtc: string | null;
  streamKey: string | null;
  peakViewerCount: number;
  totalViewerCount: number;
  featuredProductIds: string[];
  recordingUrl: string | null;
}

export const DropPartyState = { Scheduled: 1, Live: 2, Ended: 3, Cancelled: 4 } as const;
export const dropPartyStateLabel: Record<number, string> = { 1: 'Scheduled', 2: 'Live now', 3: 'Ended', 4: 'Cancelled' };
export const dropPartyStateColor: Record<number, string> = { 1: 'blue', 2: 'signal', 3: 'gray', 4: 'gray' };
export interface DropParty {
  id: string;
  creatorProfileId: string;
  vendorProfileId: string;
  reelId: string;
  title: string;
  description: string;
  startsUtc: string;
  duration: string;
  joinCode: string;
  state: number;
  attendeeCount: number;
  cancellationReason: string | null;
}
export interface ScheduleDropParty {
  creatorProfileId: string;
  vendorProfileId: string;
  reelId: string;
  title: string;
  description: string;
  startsUtc: string;
  durationMinutes: number;
}

export const audioProviderLabel: Record<number, string> = { 1: 'YouTube', 2: 'Spotify', 3: 'SoundCloud', 4: 'TikTok Sound', 99: 'Other' };
export interface AudioCard {
  musicTrackRefId: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  tempoBpm: number | null;
  durationDisplay: string;
  primaryListenProvider: number;
  primaryListenUrl: string;
  primaryListenDisplayLabel: string;
  primaryListenTimestampHint: string;
  alternateListenLinks: { provider: number; url: string; displayLabel: string }[];
  reasonSummaryLine: string;
  topReasons: string[];
  usage: { citedInReelCount: number; avgCompletionRate: number };
  crossPlatformTips: { platform: number; tip: string; deepLinkUrl: string | null }[];
}
export interface AudioTrend {
  id: string;
  provider: number;
  externalTrackIdentifier: string;
  momentumScore: number;
  regionCode: string | null;
  capturedUtc: string;
  listenUrl: string | null;
}

const PARTIES_KEY = 'sm.creator.dropParties';

/** Drop parties this browser scheduled (the server has no "my parties" list). */
export function rememberedParties(): string[] {
  try {
    const raw = localStorage.getItem(PARTIES_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
  } catch {
    return [];
  }
}
export function rememberParty(id: string, forget = false) {
  try {
    const next = rememberedParties().filter((x) => x !== id);
    if (!forget) next.unshift(id);
    localStorage.setItem(PARTIES_KEY, JSON.stringify(next.slice(0, 20)));
  } catch {
    /* storage blocked: the party is still on the server */
  }
}

export const communityApi = {
  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<MediaUpload>('/v1/social/media', form);
  },
  myStories: (accountId: string) => api.get<Story[]>(`/v1/stories/by-author/${accountId}`),
  createStory: (body: { mediaType: number; mediaUrl: string; thumbnailUrl?: string | null; caption?: string | null; durationSeconds?: number | null }) =>
    api.post<Story>('/v1/stories', body),
  deleteStory: (id: string) => api.del<void>(`/v1/stories/${id}`),
  myLive: () => api.get<LiveSession[]>('/v1/live-commerce/mine'),
  scheduleLive: (title: string, scheduledStartUtc: string, featuredProductIds: string[]) =>
    api.post<LiveSession>('/v1/live-commerce', { title, scheduledStartUtc, featuredProductIds }),
  startLive: (id: string, streamKey: string) => api.post<LiveSession>(`/v1/live-commerce/${id}/start`, { streamKey }),
  endLive: (id: string) => api.post<LiveSession>(`/v1/live-commerce/${id}/end`),
  liveParties: () => api.get<DropParty[]>('/v1/drop-parties'),
  party: (id: string) => api.get<DropParty>(`/v1/drop-parties/${id}`),
  scheduleParty: (body: ScheduleDropParty) => api.post<DropParty>('/v1/drop-parties', body),
  goLive: (id: string) => api.post<DropParty>(`/v1/drop-parties/${id}/go-live`),
  endParty: (id: string) => api.post<DropParty>(`/v1/drop-parties/${id}/end`),
  cancelParty: (id: string, reason: string) => api.post<DropParty>(`/v1/drop-parties/${id}/cancel`, { reason }),
  addPartyProduct: (id: string, productVariantId: string, quantityReserved: number, commissionRateForParty: number) =>
    api.post(`/v1/drop-parties/${id}/exclusive-products`, { productVariantId, quantityReserved, commissionRateForParty }),
  audioRecommendations: (reelDurationSeconds: number | null) =>
    api.post<AudioCard[]>('/v1/creator/audio/recommendations', { take: 12, ...(reelDurationSeconds ? { reelDurationSeconds } : {}) }),
  audioInteraction: (musicTrackRefId: string, kind: 1 | 2 | 3) => api.post<void>('/v1/creator/audio/interactions', { musicTrackRefId, kind }),
  audioTrends: (cursor: string | null, provider?: number) =>
    api.get<PagedResult<AudioTrend>>('/v1/creator/audio/trends', { cursor: cursor ?? undefined, pageSize: 25, provider }),
};

/** "01:30:00" → 90 */
export function timeSpanMinutes(ts: string): number {
  const m = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})/.exec(ts);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/** Before uploading: type and the 25 MB site limit (10 MB for images). */
export function checkMedia(file: File): string | null {
  if (!MEDIA_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP photo, or an MP4 or MOV video.';
  if (file.type.startsWith('image/') && file.size > IMAGE_MAX_BYTES) return 'Photos must be under 10 MB.';
  if (file.size > SITE_UPLOAD_MAX_BYTES) return 'Videos must be under 25 MB to upload from the web.';
  return null;
}
