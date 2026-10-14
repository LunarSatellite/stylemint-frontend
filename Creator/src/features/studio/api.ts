import { api, ApiError } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Creator Studio tools (CreatorStudio module: drafts, analyze/briefings, coaching, launchpad, recipes tab,
 * stitched-reel suggestions, story arcs, nudges; ReelRecipes module: recipe citation on a reel).
 *
 * - `/analyze` answering 429 is the AI taking too long (Retry-After: 30) — not the creator's fault.
 * - `drop-party-prompt` and `coaching/insight` answer 204 (empty) when there is nothing.
 * - Citing a recipe the reel already cites answers `state.duplicate`/same-recipe 200 — treat as success.
 * - Times, scores: briefing scores are 0–1; post-time recommendations render in their own `timeZone`.
 */

export interface StudioDraft {
  id: string;
  caption: string | null;
  hashtags: string[];
  taggedProductIds: string[];
  platform: string | null;
  status: 'draft';
  createdAt: string;
}

export interface DraftInput {
  caption?: string | null;
  hashtags?: string[] | null;
  platform?: string | null;
}

export interface Briefing {
  id: string;
  reelDraftId: string;
  hookScore: number;
  body: {
    hookAlternatives: { startAtMs: number; endAtMs: number; score: number; thumbnailUrl: string }[];
    audioSuggestions: { musicTrackRefId: string; trackTitle: string; artist: string; externalListenUrl: string | null; score: number; rationale: string }[];
    captionVariants: { text: string; engagementScoreEstimate?: number; tone: string }[];
    hashtagsReach: string[];
    hashtagsNiche: string[];
    postTimeRecommendations: { suggestedAtUtc: string; timeZone: string; audienceActivityScore: number; rationale: string }[];
    predictedAudience: {
      primaryAgeBucket: string;
      primaryRegions: string[];
      primaryGenderTilt: string;
      interestThemes: string[];
      estimatedReachLow: number;
      estimatedReachHigh: number;
    };
    shelfLifePeakHours: number;
    shelfLifeTailHours: number;
  };
  explanationByKey: Record<string, string>;
  computedUtc: string;
}

export interface CoachingTip {
  category: string;
  tip: string;
  exampleText: string | null;
  priority: number;
  evidenceSummary?: string;
  isGeneralGuidance: boolean;
}

export interface CoachingInsight {
  headline: string;
  detail: string;
  actionItem: string;
  impactPercent?: number;
  weekStartDate: string;
}

export interface Launchpad {
  journey: {
    currentPhase: string;
    totalReelsPublished: number;
    totalFollowers: number;
    totalPartnerships: number;
    completedMilestones: { key: string; name: string; achievedAt: string }[];
    nextMilestoneProgress: Record<string, number>;
  };
  milestones: { key: string; name: string; description: string; completionPercent: number; isCompleted: boolean }[];
  lessons: { id: string; title: string; category: string; content: string; readingTimeMinutes: number; difficultyLevel: number; unlockPhase: string }[];
  forecast: { projectedMonthLabel: string; recommendation: string } | null;
}

export const JOURNEY_PHASES = ['Seed', 'Sprout', 'Bloom', 'Harvest', 'Empire'] as const;

export interface RecipeCard {
  recipeId: string;
  recipeVersion: number;
  title: string;
  songTitle: string;
  songArtist: string;
  intendedDurationSeconds: number;
  thumbnailUrl: string | null;
  fromBrand: boolean;
}

export interface CollabSuggestion {
  otherCreatorId: string;
  otherCreatorHandle: string;
  sharedProductId: string;
  sharedProductName: string;
  matchReason: string;
}

export interface DropPartyPrompt {
  vendorAccountId: string;
  vendorName: string;
  highPerformingReelCount: number;
  suggestionText: string;
}

export interface TagNudge {
  reelId: string;
  suggestedProductId: string;
  productName: string;
  reason: string;
}

export const StitchedState = { Issued: 1, Acknowledged: 2, Dismissed: 3 } as const;
export interface StitchedSuggestion {
  id: string;
  sourceReelId: string;
  candidateReelId: string;
  state: number;
  issuedUtc: string;
  expiresUtc: string;
  candidateReelTitle: string | null;
  candidateReelThumbnailUrl: string | null;
  candidateCreatorDisplayName: string | null;
}

export const StoryArcState = { Suggested: 1, Active: 2, Completed: 3, Dropped: 4 } as const;
export const storyArcStateLabel: Record<number, string> = { 1: 'Suggested', 2: 'In progress', 3: 'Completed', 4: 'Dropped' };
export const storyArcStateColor: Record<number, string> = { 1: 'blue', 2: 'forest', 3: 'gray', 4: 'gray' };
export interface StoryArc {
  id: string;
  title: string;
  themeSlug: string;
  state: number;
  targetReelCount: number;
  reelsPublishedCount: number;
  commissionBoostPercent: number;
  proposedUtc: string;
  startedUtc: string | null;
  completedUtc: string | null;
  dropReason: string | null;
}

export const RecipeAdherence = { Strict: 1, Adapted: 2, Inspired: 3 } as const;
export const adherenceLabel: Record<number, string> = { 1: 'Followed it exactly', 2: 'Adapted it', 3: 'Inspired by it' };
export interface RecipeCitation {
  id: string;
  reelId: string;
  recipeId: string;
  recipeVersion: number;
  adherence: number;
  citedUtc: string;
}

/** 204 (no body) means "nothing to show". */
const orNull = <T,>(v: T | undefined | '') => (v === undefined || v === '' ? null : v);

export const studioApi = {
  drafts: async () => (await api.get<PagedResult<StudioDraft>>('/v1/creator/studio/drafts')).items,
  createDraft: (d: DraftInput) => api.post<StudioDraft>('/v1/creator/studio/drafts', d),
  updateDraft: (id: string, d: DraftInput) => api.put<StudioDraft>(`/v1/creator/studio/drafts/${id}`, d),
  deleteDraft: (id: string) => api.del<void>(`/v1/creator/studio/drafts/${id}`),
  analyze: (reelDraftId: string) => api.post<Briefing>('/v1/creator/studio/analyze', { reelDraftId }),
  refreshBriefing: (id: string) => api.post<Briefing>(`/v1/creator/studio/briefings/${id}/refresh`),
  coachingTips: (draftId: string) => api.get<CoachingTip[]>('/v1/creator/studio/coaching/tips', { draftId }),
  insight: async () => orNull(await api.get<CoachingInsight | undefined>('/v1/creator/studio/coaching/insight')),
  launchpad: () => api.get<Launchpad>('/v1/creator/studio/launchpad'),
  recipes: () => api.get<{ fromTheBrand: RecipeCard[]; generic: RecipeCard[] }>('/v1/creator/studio/recipes', { max: 12 }),
  collabSuggestions: () => api.get<CollabSuggestion[]>('/v1/creator/studio/collab-suggestions', { limit: 10 }),
  dropPartyPrompt: async () => orNull(await api.get<DropPartyPrompt | undefined>('/v1/creator/studio/drop-party-prompt')),
  tagNudges: (limit = 5) => api.get<TagNudge[]>('/v1/creator/studio/tag-nudges', { limit }),
  stitchedForReel: (reelId: string) => api.get<StitchedSuggestion[]>(`/v1/creator/stitched-reel-suggestions/by-reel/${reelId}`),
  acknowledgeStitched: (id: string) => api.post<StitchedSuggestion>(`/v1/creator/stitched-reel-suggestions/${id}/acknowledge`),
  dismissStitched: (id: string) => api.post<StitchedSuggestion>(`/v1/creator/stitched-reel-suggestions/${id}/dismiss`, {}),
  storyArcs: () => api.get<StoryArc[]>('/v1/creator/story-arcs'),
  acceptStoryArc: (id: string) => api.post<StoryArc>(`/v1/creator/story-arcs/${id}/accept`),
  dropStoryArc: (id: string, reason: string | null) => api.post<StoryArc>(`/v1/creator/story-arcs/${id}/drop`, reason ? { reason } : {}),
  /** ReelRecipes citation: one per reel; Idempotency-Key is required (the client always sends one). */
  citeRecipe: (reelId: string, recipeId: string, recipeVersion: number, adherence: number) =>
    api.post<RecipeCitation>(`/v1/creator/reels/${reelId}/cite-recipe`, { recipeId, recipeVersion, adherence }),
  uncite: (reelId: string) => api.del<void>(`/v1/creator/reels/${reelId}/cite-recipe`),
};

/** The AI taking too long is not the creator's fault: say so softly and suggest a wait. */
export function analyzeSoftMessage(e: unknown): string | null {
  if (e instanceof ApiError && (e.status === 429 || e.code === 'system.rate_limited')) {
    const wait = e.retryAfterSeconds ?? 30;
    return `Still working on your briefing — try again in about ${wait} seconds.`;
  }
  return null;
}

/** Already cited → nothing to tell the creator. */
export const isDuplicateCitation = (e: unknown) => e instanceof ApiError && (e.code === 'state.duplicate');
