# Folder Structure — stylemint-creator-fe

```
src/
├── api/
│   ├── client.ts
│   ├── schema.ts              # GENERATED — commit, never regenerate in CI
│   ├── idempotency.ts
│   ├── errors.ts
│   ├── queryKeys.ts           # csQk factory
│   ├── queries/
│   │   ├── useBriefing.ts              # staleTime:24h, gcTime:0
│   │   ├── useStoryArcList.ts
│   │   ├── useStoryArcDetail.ts
│   │   ├── usePostPublishReport.ts     # staleTime:5m, gcTime:0
│   │   ├── useRecipesTab.ts
│   │   ├── useRecipeCitations.ts
│   │   ├── useStitchedReelSuggestions.ts
│   │   ├── useBoostOffer.ts            # dynamic refetchInterval
│   │   ├── useActivity.ts              # useInfiniteQuery + cursor
│   │   ├── useAnalyticsDashboard.ts
│   │   ├── useAnalyticsOverview.ts
│   │   ├── useAnalyticsReport.ts
│   │   ├── useTopReels.ts
│   │   └── useReelAnalytics.ts
│   └── mutations/
│       ├── useAnalyzeDraft.ts          # 15s flow + setBriefingLoading + soft 429
│       ├── useRefreshBriefing.ts
│       ├── useAcceptStoryArc.ts
│       ├── useDropStoryArc.ts
│       ├── useCiteRecipe.ts            # 409 duplicate → silently swallow
│       ├── useAcknowledgeStitch.ts
│       ├── useDismissStitch.ts
│       └── useAcceptBoostOffer.ts
├── auth/
│   ├── store.ts               # token + claims + briefingLoading
│   ├── broadcastLogout.ts
│   ├── guards.tsx             # RequireAuth, RequireCreatorRole
│   └── parseClaims.ts
├── components/
│   ├── ui/                    # Radix + Tailwind wrappers — never import Radix in features
│   ├── ErrorBoundary.tsx
│   ├── CorrelationToast.tsx
│   ├── ExplanationTooltip.tsx # only way to render explanationByKey
│   └── MoneyDisplay.tsx
├── features/
│   ├── reel-studio/
│   │   ├── ReelStudio.tsx              # container + briefingLoading check
│   │   ├── BriefingLoadingScreen.tsx
│   │   ├── HookScoreBadge.tsx
│   │   ├── HookCarousel.tsx
│   │   ├── AudioSuggestionCards.tsx    # externalListenUrl handoff only
│   │   ├── CaptionVariants.tsx
│   │   ├── HashtagSection.tsx
│   │   ├── PostTimeCards.tsx           # formatInAudienceTz — not formatDateTime
│   │   ├── PredictedAudienceCard.tsx
│   │   └── ShelfLifeTimeline.tsx
│   ├── story-arcs/
│   │   ├── StoryArcList.tsx
│   │   ├── StoryArcCard.tsx
│   │   ├── StoryArcDetail.tsx
│   │   └── StoryArcProgress.tsx
│   ├── post-publish/
│   │   ├── PostPublishReport.tsx
│   │   ├── TopMomentsSection.tsx       # formatMs for atMs timestamps
│   │   ├── CommentThemesSection.tsx
│   │   ├── ConvertingSegmentsSection.tsx
│   │   ├── NextStepsSection.tsx
│   │   └── AudienceEvolutionSection.tsx
│   ├── recipes/
│   │   ├── RecipesTab.tsx
│   │   ├── RecipeCard.tsx
│   │   └── RecipeCitationSheet.tsx
│   ├── stitched-reels/
│   │   ├── StitchedReelSuggestionCard.tsx  # null safety on all denormalized fields
│   │   └── StitchedReelList.tsx
│   ├── boost-offers/
│   │   ├── BoostOfferBanner.tsx
│   │   └── BoostCountdown.tsx              # useServerAnchoredCountdown
│   ├── activity/
│   │   ├── ActivityTimeline.tsx            # TanStack Virtual + useInfiniteQuery
│   │   └── ActivityFilters.tsx
│   └── analytics/
│       ├── AnalyticsDashboard.tsx
│       ├── AnalyticsOverview.tsx
│       ├── AnalyticsFullReport.tsx
│       ├── EarningsTrendChart.tsx
│       ├── ConversionFunnel.tsx
│       ├── TopReelsList.tsx
│       ├── AudienceDemographics.tsx
│       ├── BestPostingTimes.tsx
│       └── ReelDeepDive.tsx
├── hooks/
│   └── useServerAnchoredCountdown.ts   # shared across all timed features
├── layouts/
│   └── AppShell.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── ReelStudioPage.tsx
│   ├── StoryArcsPage.tsx
│   ├── StoryArcDetailPage.tsx
│   ├── PostPublishPage.tsx
│   ├── RecipesPage.tsx
│   ├── AnalyticsDashboardPage.tsx
│   ├── AnalyticsReportPage.tsx
│   ├── ReelAnalyticsPage.tsx
│   ├── ActivityPage.tsx
│   └── NotFoundPage.tsx
├── lib/
│   ├── enums.ts
│   ├── errorMessages.ts
│   ├── formatters.ts
│   └── utils.ts               # cn() — clsx + tailwind-merge
├── env.ts                     # Zod-validated import.meta.env
├── router.tsx
└── main.tsx
```

## Route Tree

```ts
// src/router.tsx
createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/analytics" replace /> },
      { path: '/studio/:draftId',         element: <RequireCreatorRole><ReelStudioPage /></RequireCreatorRole> },
      { path: '/story-arcs',              element: <RequireCreatorRole><StoryArcsPage /></RequireCreatorRole> },
      { path: '/story-arcs/:id',          element: <RequireCreatorRole><StoryArcDetailPage /></RequireCreatorRole> },
      { path: '/reels/:reelId/report',    element: <RequireCreatorRole><PostPublishPage /></RequireCreatorRole> },
      { path: '/recipes',                 element: <RequireCreatorRole><RecipesPage /></RequireCreatorRole> },
      { path: '/analytics',               element: <RequireCreatorRole><AnalyticsDashboardPage /></RequireCreatorRole> },
      { path: '/analytics/report',        element: <RequireCreatorRole><AnalyticsReportPage /></RequireCreatorRole> },
      { path: '/analytics/reels/:reelId', element: <RequireCreatorRole><ReelAnalyticsPage /></RequireCreatorRole> },
      { path: '/activity',               element: <RequireCreatorRole><ActivityPage /></RequireCreatorRole> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
```

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Component file | PascalCase | `HookScoreBadge.tsx` |
| Hook file | camelCase, `use` prefix | `useServerAnchoredCountdown.ts` |
| Utility file | camelCase | `formatters.ts` |
| Query hook | `use` + resource + noun | `useBriefing.ts` |
| Mutation hook | `use` + verb + noun | `useAnalyzeDraft.ts` |
| Feature folder | kebab-case | `reel-studio/` |
| Test file | same name + `.test.tsx` | `HookScoreBadge.test.tsx` |
| E2E spec | feature + `.spec.ts` | `reel-studio.spec.ts` |
