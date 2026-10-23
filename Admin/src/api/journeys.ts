/**
 * Collaborative journey reels — D:\Stylemint\wt\journey-reels-contract.md v1 §5 "Admin".
 * `AdminSubjectPolicy`: reads SuperAdmin / ContentMod / SupportAgent / Readonly, ending SuperAdmin / ContentMod.
 * Numeric enums. Every route answers a bare 404 until the backend branch is deployed (`isMissingEndpoint`).
 */
import { http } from './client';
import { toPage, type Page } from './paging';

export const JOURNEY_STATE: Record<number, string> = { 1: 'Active', 2: 'Ended' };
export const JOURNEY_ENDED = 2;
export const STEP_STATE: Record<number, string> = { 1: 'Invited', 2: 'Active', 3: 'Left', 4: 'Removed', 5: 'Declined' };
export const STEP_STATE_TONE: Record<number, string> = { 1: 'amber', 2: 'forest', 3: 'gray', 4: 'signal', 5: 'gray' };
export const HIDDEN_REASON: Record<number, string> = {
  0: 'Visible',
  1: 'Awaiting reel',
  2: 'Reel not published',
  3: 'Reel moderated',
  4: 'Reel missing',
  5: 'Journey ended',
};
export const ENDED_BY: Record<number, string> = { 1: 'Owner', 2: 'Admin' };

export interface AdminJourneyStep {
  id: string;
  index: number;
  state: number;
  vendorAccountId: string;
  vendorName: string;
  vendorLogoUrl: string | null;
  reelId: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  isVisible: boolean;
  hiddenReason: number;
  inviteNote: string | null;
  invitedUtc: string | null;
  acceptedUtc: string | null;
  closedUtc?: string | null;
}

export interface AdminJourney {
  id: string;
  title: string | null;
  city: string | null;
  state: number;
  ownerVendorAccountId: string;
  ownerName: string;
  ownerLogoUrl: string | null;
  isLive: boolean;
  visibleStepCount: number;
  maxSteps: number;
  /** Open steps (businesses in the journey now). */
  memberCount?: number;
  endedUtc: string | null;
  endedBy: number | null;
  endReason: string | null;
  createdUtc: string;
  updatedUtc: string;
  /** Open steps (Invited + Active), in order. */
  steps: AdminJourneyStep[];
  /** Every step ever (detail): open by position, then closed by `closedUtc`. */
  allSteps?: AdminJourneyStep[];
}

export interface JourneyQuery {
  q?: string;
  state?: string;
  vendorAccountId?: string;
  page: number;
  pageSize: number;
}

export const journeyTitle = (j: Pick<AdminJourney, 'title' | 'ownerName'>) => j.title?.trim() || `${j.ownerName} journey`;

/** The end reason the server accepts: 3–500 characters. */
export const validEndReason = (reason: string) => {
  const r = reason.trim();
  return r.length >= 3 && r.length <= 500;
};

const enc = encodeURIComponent;

export const journeysAdminApi = {
  list: async (f: JourneyQuery, signal?: AbortSignal): Promise<Page<AdminJourney>> =>
    toPage<AdminJourney>(
      await http.get(
        '/v1/admin/journeys',
        {
          q: f.q || undefined,
          state: f.state || undefined,
          vendorAccountId: f.vendorAccountId || undefined,
          page: f.page,
          pageSize: Math.min(100, f.pageSize),
        },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
  get: (id: string, signal?: AbortSignal) => http.get<AdminJourney>(`/v1/admin/journeys/${enc(id)}`, undefined, signal),
  end: (id: string, reason: string) => http.post<AdminJourney>(`/v1/admin/journeys/${enc(id)}/end`, { reason }),
};
