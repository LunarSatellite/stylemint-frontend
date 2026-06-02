import type { CreatorActivityKind, StoryArcState, TopReelsSort } from '@/lib/enums'

interface ArcFilter { state?: StoryArcState[] }
interface RecipeFilter { productVariantIds?: string[]; categoryIds?: string[] }
interface ActivityFilter { kinds?: CreatorActivityKind[]; cursor?: string }
interface AnalyticsWindow { fromUtc: string; toUtc: string }
interface TopReelsQuery { fromUtc: string; toUtc: string; sortBy?: TopReelsSort; limit?: number }

export const csQk = {
  studio: {
    briefing:        (id: string)       => ['cs', 'studio', 'briefing', id] as const,
    briefingByDraft: (dId: string)      => ['cs', 'studio', 'briefing-by-draft', dId] as const,
  },
  storyArcs: {
    list:   (f: ArcFilter)              => ['cs', 'arcs', 'list', f] as const,
    detail: (id: string)               => ['cs', 'arcs', 'detail', id] as const,
  },
  postPublish: {
    report: (reelId: string)            => ['cs', 'pp', 'report', reelId] as const,
  },
  recipes: {
    tab:       (f: RecipeFilter)        => ['cs', 'recipes', 'tab', f] as const,
    citations: (reelId: string)         => ['cs', 'recipes', 'citations', reelId] as const,
  },
  stitched: {
    byReel: (reelId: string)            => ['cs', 'stitched', 'by-reel', reelId] as const,
    detail: (id: string)               => ['cs', 'stitched', 'detail', id] as const,
  },
  boostOffers: {
    detail: (id: string)               => ['cs', 'boost-offers', 'detail', id] as const,
  },
  activity:    (f: ActivityFilter)      => ['cs', 'activity', f] as const,
  analytics: {
    topReels:  (q: TopReelsQuery)       => ['cs', 'analytics', 'top-reels', q] as const,
    dashboard: (w: AnalyticsWindow)     => ['cs', 'analytics', 'dashboard', w] as const,
    overview:  (w: AnalyticsWindow)     => ['cs', 'analytics', 'overview', w] as const,
    report:    (w: AnalyticsWindow)     => ['cs', 'analytics', 'report', w] as const,
    reel:      (id: string, w: AnalyticsWindow) => ['cs', 'analytics', 'reel', id, w] as const,
  },
}
