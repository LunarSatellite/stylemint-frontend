import { api, ApiError, messageOf } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Collaborative journey reels (journey-reels-contract v1, §4 vendor endpoints). A journey is an ordered chain of
 * reels from different businesses; the owner creates it with its own published reel as step 1 and invites others.
 * Every endpoint 404s with no errorCode until the backend branch is deployed → "being set up".
 */

export const JourneyState = { Active: 1, Ended: 2 } as const;
export const StepState = { Invited: 1, Active: 2, Left: 3, Removed: 4, Declined: 5 } as const;
export const JourneyRole = { Owner: 1, Member: 2, Invitee: 3 } as const;
export const HiddenReason = { None: 0, AwaitingReel: 1, ReelNotPublished: 2, ReelModerated: 3, ReelMissing: 4, JourneyEnded: 5 } as const;

export const roleLabel: Record<number, string> = { 1: 'Owner', 2: 'Member', 3: 'Invited' };

export const hiddenReasonLabel: Record<number, string> = {
  0: 'Visible',
  1: 'Waiting for their reel',
  2: 'Reel not published',
  3: 'Reel taken down by a moderator',
  4: 'Reel no longer exists',
  5: 'Journey ended',
};

export const vendorCategoryLabel: Record<number, string> = { 0: 'Seller', 1: 'Hotel', 2: 'Travel agency', 3: 'Bank' };

export interface JourneyStep {
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
}

export interface VendorJourney {
  id: string;
  title: string | null;
  city: string | null;
  state: number;
  ownerVendorAccountId: string;
  ownerName: string;
  ownerLogoUrl: string | null;
  myRole: number;
  myStepId: string | null;
  isLive: boolean;
  visibleStepCount: number;
  maxSteps: number;
  endedUtc: string | null;
  endedBy: number | null;
  endReason: string | null;
  createdUtc: string;
  updatedUtc: string;
  steps: JourneyStep[];
}

export interface JourneyVendor {
  vendorAccountId: string;
  businessName: string;
  logoUrl: string | null;
  city: string | null;
  category: number;
  isVerified: boolean;
}

export interface JourneyReelOption {
  reelId: string;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAtUtc: string | null;
  journeyCount: number;
  canUse: boolean;
  reason: string | null;
}

export const JOURNEYS_KEY = ['journeys'] as const;
/** A journey becomes visible in the feed with at least this many visible steps (server `MinVisibleSteps`). */
export const MIN_VISIBLE_STEPS = 2;
export const TITLE_MAX = 80;
export const CITY_MAX = 80;
export const NOTE_MAX = 280;

const enc = encodeURIComponent;
const base = '/v1/vendor/journeys';

export const journeysApi = {
  list: (filter: { role?: number; state?: number } = {}) =>
    api.get<PagedResult<VendorJourney>>(base, { role: filter.role, state: filter.state }),
  get: (id: string) => api.get<VendorJourney>(`${base}/${enc(id)}`),
  create: (body: { title: string | null; city: string | null; reelId: string }) => api.post<VendorJourney>(base, body),
  update: (id: string, body: { title: string | null; city: string | null }) => api.put<VendorJourney>(`${base}/${enc(id)}`, body),
  invite: (id: string, body: { vendorAccountId: string; note: string | null }) => api.post<VendorJourney>(`${base}/${enc(id)}/invites`, body),
  accept: (id: string, stepId: string, reelId: string) => api.post<VendorJourney>(`${base}/${enc(id)}/steps/${enc(stepId)}/accept`, { reelId }),
  decline: (id: string, stepId: string) => api.post<void>(`${base}/${enc(id)}/steps/${enc(stepId)}/decline`),
  replaceReel: (id: string, stepId: string, reelId: string) => api.put<VendorJourney>(`${base}/${enc(id)}/steps/${enc(stepId)}/reel`, { reelId }),
  leave: (id: string) => api.post<void>(`${base}/${enc(id)}/leave`),
  reorder: (id: string, stepIds: string[]) => api.put<VendorJourney>(`${base}/${enc(id)}/order`, { stepIds }),
  removeStep: (id: string, stepId: string) => api.del<VendorJourney>(`${base}/${enc(id)}/steps/${enc(stepId)}`),
  end: (id: string) => api.post<VendorJourney>(`${base}/${enc(id)}/end`),
  searchVendors: (q: string, limit = 20) => api.get<JourneyVendor[]>(`${base}/vendors`, { q, limit }),
  myReels: (journeyId?: string | null, limit = 100) => api.get<JourneyReelOption[]>(`${base}/my-reels`, { journeyId: journeyId ?? undefined, limit }),
};

/** "Kathmandu → Pokhara weekend", or "{owner} journey" when untitled (contract §2). */
export function journeyTitle(j: Pick<VendorJourney, 'title' | 'ownerName'>): string {
  return j.title?.trim() || `${j.ownerName} journey`;
}

/** Title and city are optional, ≤ 80 characters each (contract §1). */
export function validateJourneyText(title: string, city: string): string | null {
  if (title.trim().length > TITLE_MAX) return `Keep the title to ${TITLE_MAX} characters.`;
  if (city.trim().length > CITY_MAX) return `Keep the city to ${CITY_MAX} characters.`;
  return null;
}

/** The step ids in the new order after moving one step up (-1) or down (+1). Unchanged when it cannot move. */
export function moveStep(stepIds: string[], stepId: string, delta: -1 | 1): string[] {
  const from = stepIds.indexOf(stepId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= stepIds.length) return stepIds;
  const next = [...stepIds];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** Move a step to another position (drag and drop). */
export function placeStep(stepIds: string[], stepId: string, toIndex: number): string[] {
  const from = stepIds.indexOf(stepId);
  if (from < 0) return stepIds;
  const next = stepIds.filter((id) => id !== stepId);
  const at = Math.max(0, Math.min(next.length, toIndex));
  next.splice(at, 0, stepId);
  return next;
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** What the seller may do on this journey, from their role and the journey state. */
export function journeyPermissions(j: VendorJourney) {
  const active = j.state === JourneyState.Active;
  const owner = j.myRole === JourneyRole.Owner;
  const myStep = j.steps.find((s) => s.id === j.myStepId) ?? null;
  return {
    active,
    owner,
    myStep,
    canEdit: active && owner,
    canInvite: active && owner && j.steps.length < j.maxSteps,
    canReorder: active && owner && j.steps.length > 1,
    canEnd: active && owner,
    canLeave: active && j.myRole === JourneyRole.Member,
    canRespond: active && j.myRole === JourneyRole.Invitee && myStep?.state === StepState.Invited,
    canReplaceReel: active && myStep?.state === StepState.Active && j.myRole !== JourneyRole.Invitee,
    canRemove: (s: JourneyStep) => active && owner && s.vendorAccountId !== j.ownerVendorAccountId && s.id !== j.myStepId,
  };
}

const ERROR_TEXT: Record<string, string> = {
  'journey.not_found': 'This journey is no longer available to your business.',
  'journey.step_not_found': 'That step is no longer part of the journey. Reload and try again.',
  'journey.ended': 'This journey has ended; it cannot be changed.',
  'journey.reel_not_eligible': 'Pick one of your own published reels.',
  'journey.reel_limit': 'That reel is already in 3 journeys. Pick another reel.',
  'journey.step_limit': 'This journey already has the most steps it can have.',
  'journey.owned_limit': 'You already run 20 active journeys. End one before starting another.',
  'journey.vendor_not_eligible': 'That business cannot be invited.',
  'journey.already_member': 'That business is already in this journey.',
  'journey.invalid_step_state': 'That step has changed meanwhile. Reload and try again.',
  'journey.owner_step_locked': 'The owner’s own step cannot be removed; end the journey instead.',
  'journey.order_mismatch': 'The steps changed meanwhile. Reload and try again.',
  'state.concurrency_conflict': 'Someone changed this journey at the same moment. Reload and try again.',
};

/** A seller-friendly message for a journey write failure. */
export function journeyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && ERROR_TEXT[error.code]) return ERROR_TEXT[error.code]!;
  return messageOf(error);
}
