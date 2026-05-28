# Query Keys + staleTime — stylemint-brand-fe

## bsQk factory

```ts
// src/api/queryKeys.ts
export const bsQk = {
  briefs: {
    list:   (f: BriefListFilter) => ['bs','briefs','list',f] as const,
    detail: (id: string)         => ['bs','briefs','detail',id] as const,
  },
  dashboard: (w: number)         => ['bs','dashboard',w] as const,
  activity:  (f: ActivityFilter) => ['bs','activity',f] as const,
  analytics: {
    overview: (w: Window)                    => ['bs','analytics','overview',w] as const,
    products: (w: Window)                    => ['bs','analytics','products',w] as const,
    creators: (w: Window)                    => ['bs','analytics','creators',w] as const,
    product:  (id: string, w: Window)        => ['bs','analytics','product',id,w] as const,
    creatorByPartnership: (pid: string, w: Window) => ['bs','analytics','creatorPartnership',pid,w] as const,
  },
  goalTemplates: {
    list:   (goal: CampaignGoal) => ['bs','goalTemplates','list',goal] as const,
    active: (goal: CampaignGoal) => ['bs','goalTemplates','active',goal] as const,
  },
  policies: {
    detail: (vendorId: string)   => ['bs','policies',vendorId] as const,
  },
}
```

## staleTime + gcTime

| Query | staleTime | gcTime |
|---|---|---|
| Brief detail | 30 000 ms | **0** — large body, drop on unmount |
| Brief list | 30 000 ms | default |
| Dashboard | 60 000 ms | default |
| Analytics (all) | 60 000 ms | default |
| Activity | 15 000 ms | default |
| Goal templates | 60 000 ms | default |
| Vendor policy | 60 000 ms | default |

## Mutation → invalidation map

| Mutation | Invalidate |
|---|---|
| POST `/briefs` | `bsQk.briefs.list(*)` + `setQueryData(detail, result)` |
| PATCH `/briefs/{id}` | `bsQk.briefs.detail(id)` + `bsQk.briefs.list(*)` |
| lock / fork / retire | same as PATCH |
| `recompute-roi` | `setQueryData(detail, prev => ({...prev, roiProjection}))` |
| POST goal-template | `bsQk.goalTemplates.list(goal)` + `bsQk.goalTemplates.active(goal)` |
| PATCH policy | `bsQk.policies.detail(vendorId)` |
