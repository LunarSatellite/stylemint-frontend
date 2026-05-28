# Folder Structure — stylemint-brand-fe

```
src/
├── api/
│   ├── client.ts
│   ├── schema.ts          # GENERATED
│   ├── idempotency.ts
│   ├── errors.ts
│   ├── queryKeys.ts       # bsQk factory
│   ├── queries/
│   │   ├── useBriefList.ts
│   │   ├── useBriefDetail.ts   # staleTime:30s, gcTime:0
│   │   ├── useDashboard.ts
│   │   ├── useActivity.ts
│   │   ├── useAnalyticsOverview.ts
│   │   ├── useAnalyticsProducts.ts
│   │   ├── useAnalyticsCreators.ts
│   │   ├── useProductAnalytics.ts
│   │   ├── useCreatorAnalytics.ts
│   │   ├── useGoalTemplates.ts
│   │   └── useVendorPolicy.ts
│   └── mutations/
│       ├── useDraftBrief.ts        # LLM loading flag, no optimistic update
│       ├── useUpdateBrief.ts       # dirtyFields PATCH + rowVersion
│       ├── useLockBrief.ts
│       ├── useForkBrief.ts
│       ├── useRetireBrief.ts
│       ├── useRecomputeRoi.ts      # setQueryData, not invalidate
│       ├── useAuthorGoalTemplate.ts
│       ├── useSupersedGoalTemplate.ts
│       ├── useRetireGoalTemplate.ts
│       └── useUpdateVendorPolicy.ts
├── auth/
│   ├── store.ts           # token + claims + vendorAccountId + draftingBrief
│   ├── broadcastLogout.ts
│   ├── guards.tsx         # RequireAuth, RequireVendorRole, RequireAdminRole
│   └── parseClaims.ts
├── components/
│   ├── ui/                # Radix + Tailwind — never import Radix in features
│   ├── DataTable.tsx
│   ├── ErrorBoundary.tsx  # page AND widget level
│   ├── CorrelationToast.tsx
│   ├── ConfirmDialog.tsx
│   └── MoneyDisplay.tsx
├── features/
│   ├── brief-authoring/
│   │   ├── BriefList.tsx
│   │   ├── BriefEditor.tsx         # dirtyFields PATCH, useBlocker for LLM draft
│   │   ├── BriefStatusBadge.tsx
│   │   ├── BriefLineage.tsx        # version lineage chip
│   │   ├── RoiProjectionCard.tsx
│   │   └── LockConfirmDialog.tsx
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── TopCreatorsWidget.tsx
│   │   ├── ReachWidget.tsx
│   │   ├── FormatLearningsWidget.tsx
│   │   ├── BenchmarkWidget.tsx     # only rendered when benchmark !== null
│   │   ├── SuggestedCreatorsWidget.tsx
│   │   └── RecipePerformanceWidget.tsx
│   ├── analytics/
│   │   ├── AnalyticsOverview.tsx
│   │   ├── RevenueTrendChart.tsx   # ECharts Canvas
│   │   ├── TopProductsTable.tsx
│   │   ├── TopCreatorsTable.tsx
│   │   ├── TrafficSourceChart.tsx  # ECharts Canvas
│   │   ├── ProductDeepDive.tsx
│   │   └── CreatorDeepDive.tsx
│   ├── activity/
│   │   ├── ActivityTimeline.tsx
│   │   └── ActivityFilters.tsx
│   └── admin/
│       ├── GoalTemplateManager.tsx
│       ├── GoalTemplateDiff.tsx    # side-by-side diff of promptText
│       └── VendorPolicyEditor.tsx
├── layouts/
│   └── AppShell.tsx
├── pages/                 # thin — compose features only
│   ├── LoginPage.tsx
│   ├── BriefListPage.tsx
│   ├── BriefCreatePage.tsx
│   ├── BriefEditorPage.tsx
│   ├── DashboardPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── ProductAnalyticsPage.tsx
│   ├── CreatorAnalyticsPage.tsx
│   ├── ActivityPage.tsx
│   ├── GoalTemplatesPage.tsx
│   ├── VendorPolicyPage.tsx
│   └── NotFoundPage.tsx
├── workers/
│   └── analyticsAggregator.worker.ts
├── lib/
│   ├── enums.ts
│   ├── errorMessages.ts
│   └── formatters.ts
├── env.ts
├── router.tsx
└── main.tsx
```

## Route tree

```ts
createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/briefs',                        element: <RequireVendorRole><BriefListPage /></RequireVendorRole> },
      { path: '/briefs/new',                    element: <RequireVendorRole><BriefCreatePage /></RequireVendorRole> },
      { path: '/briefs/:id',                    element: <RequireVendorRole><BriefEditorPage /></RequireVendorRole> },
      { path: '/dashboard',                     element: <RequireVendorRole><DashboardPage /></RequireVendorRole> },
      { path: '/analytics',                     element: <RequireVendorRole><AnalyticsPage /></RequireVendorRole> },
      { path: '/analytics/products/:productId', element: <RequireVendorRole><ProductAnalyticsPage /></RequireVendorRole> },
      { path: '/analytics/partnerships/:pid',   element: <RequireVendorRole><CreatorAnalyticsPage /></RequireVendorRole> },
      { path: '/activity',                      element: <RequireVendorRole><ActivityPage /></RequireVendorRole> },
      { path: '/admin/goal-templates',          element: <RequireAdminRole><GoalTemplatesPage /></RequireAdminRole> },
      { path: '/admin/vendor-policy/:vendorId', element: <RequireAdminRole><VendorPolicyPage /></RequireAdminRole> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
```
