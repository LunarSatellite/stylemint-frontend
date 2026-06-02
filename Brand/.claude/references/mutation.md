# Mutation Patterns — stylemint-brand-fe

How to write mutation hooks. Read this before adding any `useMutation`.

---

## Standard mutation hook template

```ts
// src/api/mutations/useUpdateBrief.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { showErrorToast } from '@/lib/showErrorToast'
import type { BriefId } from '@/lib/brands'
import type { BrandBriefDto } from '@/api/schema'

interface UpdateBriefBody {
  title?:          string
  targetAudience?: string
  goalType?:       number
  commissionRate?: number
  rowVersion:      number  // always required
}

export function useUpdateBrief() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: BriefId; body: UpdateBriefBody }) =>
      api
        .patch<BrandBriefDto>(`/v1/vendor/briefs/${id}`, body)
        .then((r) => r.data),

    onSuccess: (updated, { id }) => {
      // 1. Narrow invalidation — only this brief's detail + list
      qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      toast.success('Brief saved.')
    },

    onError: (error, { id }) => {
      const { errorCode, correlationId } = extractApiError(error)

      if (errorCode === 'state.concurrency_conflict') {
        // Refresh stale data, then tell the user
        qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
        toast.warning('Someone else changed this brief. Refreshing…')
        return
      }

      if (errorCode === 'system.rate_limited') {
        // Caller handles Retry-After UI — see form-patterns.md
        showErrorToast(errorCode, correlationId)
        return
      }

      showErrorToast(errorCode, correlationId)
    },
  })
}
```

---

## extractApiError helper

Parse Axios errors into a typed shape. Call this in every `onError`.

```ts
// src/lib/extractApiError.ts
import axios from 'axios'

export interface ApiError {
  errorCode:     string
  correlationId: string | null
  retryAfterSeconds?: number
}

export function extractApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined
    return {
      errorCode:         (data?.errorCode as string)  ?? 'system.internal_error',
      correlationId:     (data?.correlationId as string) ?? null,
      retryAfterSeconds: (data?.retryAfterSeconds as number) ?? undefined,
    }
  }
  return { errorCode: 'system.internal_error', correlationId: null }
}
```

---

## showErrorToast helper

Always include `correlationId` in the toast for support tracing.

```ts
// src/lib/showErrorToast.ts
import { toast } from 'sonner'
import { errorMessages } from './errorCodes'

export function showErrorToast(errorCode: string, correlationId: string | null) {
  const message = errorMessages[errorCode] ?? errorMessages['system.internal_error']
  toast.error(message, {
    description: correlationId ? `ID: ${correlationId}` : undefined,
  })
}
```

---

## rowVersion — optimistic concurrency

Every mutable resource (`BrandBriefDto`, `GoalTemplateDto`, `VendorPolicyDto`) has a `rowVersion` integer. Include it in every PATCH / state-transition body.

The server rejects with `state.concurrency_conflict` (409) if the `rowVersion` is stale.
The correct response is **invalidate + inform**, not retry automatically.

```ts
// Wrong — silently overwrites the concurrent change
body: { title: values.title }

// Correct — sends current rowVersion, server detects conflict
body: { title: values.title, rowVersion: brief.rowVersion }
```

---

## State transitions — lock / fork / retire

These are separate mutation hooks (not bundled into `useUpdateBrief`) because they have distinct success effects and distinct invalidation needs.

```ts
// src/api/mutations/useLockBrief.ts
export function useLockBrief() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: BriefId; rowVersion: number }) =>
      api
        .post<BrandBriefDto>(`/v1/vendor/briefs/${id}/lock`, { rowVersion })
        .then((r) => r.data),

    onSuccess: (locked, { id }) => {
      // setQueryData avoids a refetch when we already have the updated resource
      qc.setQueryData(bsQk.briefs.detail(id), locked)
      qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
      toast.success('Brief locked. Creators can now see it.')
    },

    onError: (error, { id }) => {
      const { errorCode, correlationId } = extractApiError(error)

      if (errorCode === 'state.invalid_transition') {
        toast.error('This brief cannot be locked in its current state.')
        return
      }
      if (errorCode === 'state.concurrency_conflict') {
        qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
        toast.warning('Someone else changed this brief. Refreshing…')
        return
      }

      showErrorToast(errorCode, correlationId)
    },
  })
}
```

Pattern is identical for `useForkBrief` and `useRetireBrief` — only the endpoint and success toast differ.

---

## setQueryData vs invalidateQueries

| When | Use |
|---|---|
| Server returns the updated resource in the mutation response | `setQueryData` — avoid a refetch, update immediately |
| Server returns only a status / no body | `invalidateQueries` — trigger a fresh fetch |
| `concurrency_conflict` — local data is stale | `invalidateQueries` — force a refetch to get server truth |

```ts
// setQueryData — use the response body directly
onSuccess: (updated, { id }) => {
  qc.setQueryData(bsQk.briefs.detail(id), updated)
}

// invalidateQueries — let TanStack Query refetch
onSuccess: (_, { id }) => {
  qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
}
```

Always invalidate the list alongside the detail — the list card shows fields that change (state, title, updatedAt).

---

## Narrowest possible invalidation

Invalidate only the keys that the mutation actually affects. Never call `qc.invalidateQueries()` with no arguments (invalidates everything).

```ts
// Too broad — refetches everything
qc.invalidateQueries()

// Still too broad — refetches all brief queries (list + all details)
qc.invalidateQueries({ queryKey: ['bs', 'briefs'] })

// Correct — only this brief's detail + the list
qc.invalidateQueries({ queryKey: bsQk.briefs.detail(id) })
qc.invalidateQueries({ queryKey: bsQk.briefs.list({}) })
```

For the full mutation → invalidation map, see `references/query-keys.md`.

---

## onSettled for cleanup flags

Use `onSettled` (not `onSuccess`) to reset Zustand flags that must clear whether or not the mutation succeeded.

```ts
// src/api/mutations/useDraftBrief.ts — LLM draft generation (2-5s)
import { useAuth } from '@/auth/store'

export function useDraftBrief() {
  const qc = useQueryClient()
  const setDraftingBrief = useAuth((s) => s.setDraftingBrief)

  return useMutation({
    mutationFn: (id: BriefId) =>
      api.post<BrandBriefDto>(`/v1/vendor/briefs/${id}/draft`).then((r) => r.data),

    onMutate: () => {
      setDraftingBrief(true)  // disable editor UI while LLM runs
    },

    onSuccess: (drafted, id) => {
      qc.setQueryData(bsQk.briefs.detail(id), drafted)
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },

    onSettled: () => {
      setDraftingBrief(false)  // always reset — even if the request errored
    },
  })
}
```

Never reset `draftingBrief` in `onSuccess` — if the mutation errors, the flag stays stuck and the editor stays disabled permanently.

---

## recompute-roi — setQueryData merge

Some mutations patch only a sub-field of a cached resource. Merge rather than replace.

```ts
// src/api/mutations/useRecomputeRoi.ts
export function useRecomputeRoi() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: BriefId) =>
      api.post<{ roiProjection: RoiProjection }>(`/v1/vendor/briefs/${id}/recompute-roi`)
        .then((r) => r.data),

    onSuccess: ({ roiProjection }, id) => {
      qc.setQueryData<BrandBriefDto>(
        bsQk.briefs.detail(id),
        (prev) => prev ? { ...prev, roiProjection } : prev
      )
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },
  })
}
```

The `setQueryData` updater returns `prev` unchanged if there is no cached entry yet — never write `undefined` into the cache.

---

## Error handling order — switch on errorCode

Always switch on `errorCode` string. Never branch on HTTP status number.

```ts
onError: (error, variables) => {
  const { errorCode, correlationId } = extractApiError(error)

  switch (errorCode) {
    case 'state.concurrency_conflict':
      qc.invalidateQueries({ queryKey: bsQk.briefs.detail(variables.id) })
      toast.warning('Someone else changed this. Refreshing…')
      return

    case 'state.invalid_transition':
      toast.error('This action is not allowed right now.')
      return

    case 'system.rate_limited':
      // Caller must read error.retryAfterSeconds and disable the button
      showErrorToast(errorCode, correlationId)
      return

    case 'rule.commission_out_of_range':
      toast.error('Commission exceeds the vendor ceiling.')
      return

    default:
      showErrorToast(errorCode, correlationId)
  }
}
```

---

## Hard rules

- Always switch on `errorCode` string — never on HTTP status number
- Always include `rowVersion` in every PATCH / state-transition body
- `state.concurrency_conflict` → `invalidateQueries` + warning toast — never silently retry
- `onSettled` resets cleanup flags — never `onSuccess`
- Narrowest possible invalidation — never invalidate all queries
- `showErrorToast` always passes `correlationId` — never omit it
- `useMutation` lives in `src/api/mutations/` — never inline in a component
- One mutation hook per operation — never bundle lock + update into one hook
