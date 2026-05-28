# Query Keys + staleTime — stylemint-creator-fe

## csQk Factory

```ts
// src/api/queryKeys.ts
export const csQk = {
  studio: {
    briefing:        (id: string)       => ['cs','studio','briefing',id] as const,
    briefingByDraft: (dId: string)      => ['cs','studio','briefing-by-draft',dId] as const,
  },
  storyArcs: {
    list:   (f: ArcFilter)             => ['cs','arcs','list',f] as const,
    detail: (id: string)               => ['cs','arcs','detail',id] as const,
  },
  postPublish: {
    report: (reelId: string)           => ['cs','pp','report',reelId] as const,
  },
  recipes: {
    tab:       (f: RecipeFilter)       => ['cs','recipes','tab',f] as const,
    citations: (reelId: string)        => ['cs','recipes','citations',reelId] as const,
  },
  stitched: {
    byReel: (reelId: string)           => ['cs','stitched','by-reel',reelId] as const,
    detail: (id: string)               => ['cs','stitched','detail',id] as const,
  },
  boostOffers: {
    detail: (id: string)               => ['cs','boost-offers','detail',id] as const,
  },
  activity:    (f: ActivityFilter)     => ['cs','activity',f] as const,
  analytics: {
    topReels:  (q: TopReelsQuery)      => ['cs','analytics','top-reels',q] as const,
    dashboard: (w: Window)             => ['cs','analytics','dashboard',w] as const,
    overview:  (w: Window)             => ['cs','analytics','overview',w] as const,
    report:    (w: Window)             => ['cs','analytics','report',w] as const,
    reel:      (id: string, w: Window) => ['cs','analytics','reel',id,w] as const,
  },
}
```

## staleTime + gcTime Table

| Query | staleTime | gcTime | Notes |
|---|---|---|---|
| Briefing | 86 400 000 ms (24h) | **0** | Large body — drop on unmount |
| Post-publish report | 300 000 ms (5m) | **0** | Large body — drop on unmount |
| Story arc list/detail | 30 000 ms | default | |
| Analytics (all) | 60 000 ms | default | |
| Activity | 15 000 ms | default | Cursor-paginated via useInfiniteQuery |
| Boost offer | dynamic — see SKILL.md | default | Stops polling on Accepted or Expired |
| Recipes tab | 60 000 ms | default | |

## Mutation → Invalidation Map

| Mutation | Effect |
|---|---|
| POST `/studio/analyze` | `setQueryData(csQk.studio.briefing(id), result)` — no invalidate |
| POST `/briefings/{id}/refresh` | invalidate `csQk.studio.briefing(id)` |
| POST `/story-arcs/{id}/accept` or `/drop` | invalidate `csQk.storyArcs.detail(id)` + `csQk.storyArcs.list(*)` |
| POST `/reels/{id}/recipe-citation` | invalidate `csQk.recipes.citations(reelId)` |
| POST `/stitched-reel-suggestions/{id}/acknowledge` or `/dismiss` | invalidate `csQk.stitched.detail(id)` + `csQk.stitched.byReel(*)` |
| POST `/boost-offers/{id}/accept` | invalidate `csQk.boostOffers.detail(id)` + `csQk.postPublish.report(reelId)` |

## TanStack Query v5 Patterns

```ts
// Standard query hook
export function useBriefing(id: string) {
  return useQuery({
    queryKey: csQk.studio.briefing(id),
    queryFn: () => api.get<Briefing>(`/v1/creator/studio/briefings/${id}`).then(r => r.data),
    staleTime: 86_400_000,
    gcTime: 0,
    enabled: !!id,
  })
}

// Infinite query (activity timeline)
export function useActivity(filter: ActivityFilter) {
  return useInfiniteQuery({
    queryKey: csQk.activity(filter),
    queryFn: ({ pageParam }) =>
      api.get<ActivityPage>('/v1/creator/activity', { params: { ...filter, cursor: pageParam } })
         .then(r => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  })
}
```

## Prefetching (Router loaders)

Use `queryClient.prefetchQuery` in React Router loaders for above-the-fold data. Do not waterfall page-level queries.

```ts
// src/pages/ReelStudioPage.tsx loader
export async function reelStudioLoader({ params }: LoaderFunctionArgs) {
  await queryClient.prefetchQuery({
    queryKey: csQk.studio.briefing(params.draftId!),
    queryFn: () => fetchBriefing(params.draftId!),
    staleTime: 86_400_000,
  })
  return null
}
```
