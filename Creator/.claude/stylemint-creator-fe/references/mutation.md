# Mutation Patterns — stylemint-creator-fe

---

## File Location + Naming

```
src/api/mutations/use<VerbNoun>.ts
```

| File | Endpoint |
|---|---|
| `useAnalyzeDraft.ts` | POST `/v1/creator/studio/analyze` |
| `useRefreshBriefing.ts` | POST `/v1/creator/briefings/{id}/refresh` |
| `useAcceptStoryArc.ts` | POST `/v1/creator/story-arcs/{id}/accept` |
| `useDropStoryArc.ts` | POST `/v1/creator/story-arcs/{id}/drop` |
| `useCiteRecipe.ts` | POST `/v1/creator/reels/{id}/recipe-citation` |
| `useAcknowledgeStitch.ts` | POST `/v1/creator/stitched-reel-suggestions/{id}/acknowledge` |
| `useDismissStitch.ts` | POST `/v1/creator/stitched-reel-suggestions/{id}/dismiss` |
| `useAcceptBoostOffer.ts` | POST `/v1/creator/boost-offers/{id}/accept` |

---

## Standard Hook Structure

```ts
// src/api/mutations/useDropStoryArc.ts
export function useDropStoryArc() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/v1/creator/story-arcs/${id}/drop`).then((r) => r.data),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: csQk.storyArcs.detail(id) })
      const previous = queryClient.getQueryData(csQk.storyArcs.detail(id))
      queryClient.setQueryData(csQk.storyArcs.detail(id), (old: StoryArc) => ({
        ...old,
        state: StoryArcState.Dropped,
      }))
      return { previous, id }
    },

    onError: (_err, id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(csQk.storyArcs.detail(id), ctx.previous)
      }
      showErrorToast(_err)
    },

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['cs', 'arcs', 'list'] })
    },
  })
}
```

---

## onMutate / onError / onSettled Rules

| Callback | Responsibility |
|---|---|
| `onMutate` | Cancel in-flight queries, snapshot previous state, apply optimistic update. Return `{ previous }` for rollback. |
| `onError` | Restore previous state from context. Call `showErrorToast` unless the error is a known special case (see below). |
| `onSettled` | Invalidate all affected query keys. Runs after both success and error. |

**Never** put invalidation logic in `onSuccess` — use `onSettled` so it fires even on error.

**Never** call `showErrorToast` in `onSettled` — only in `onError`.

---

## Optimistic Update Pattern

Only apply an optimistic update when the UI change is immediately visible and the rollback is clean.

```ts
onMutate: async (id) => {
  // 1. Cancel any outgoing refetches to avoid overwriting the optimistic value
  await queryClient.cancelQueries({ queryKey: csQk.storyArcs.detail(id) })

  // 2. Snapshot for rollback
  const previous = queryClient.getQueryData(csQk.storyArcs.detail(id))

  // 3. Apply optimistic value
  queryClient.setQueryData(csQk.storyArcs.detail(id), (old: StoryArc) => ({
    ...old,
    state: StoryArcState.Accepted,
  }))

  return { previous, id }
},

onError: (_err, id, ctx) => {
  // 4. Roll back on failure
  if (ctx?.previous) {
    queryClient.setQueryData(csQk.storyArcs.detail(id), ctx.previous)
  }
},

onSettled: (_data, _err, id) => {
  // 5. Always re-sync from server
  queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
},
```

---

## Error Handling — Special Cases

### /analyze 429 — Soft Info Toast

`system.rate_limited` on this endpoint is **not the user's fault**. Never call `showErrorToast`.

```ts
onError: (err) => {
  const code = isAxiosError(err) ? err.response?.data?.errorCode : undefined
  if (code === 'system.rate_limited') {
    const retry = Number(err.response?.headers['retry-after']) || 30
    toast.info(`Still working on your briefing. Try again in ${retry}s.`)
    return
  }
  showErrorToast(err)
},
```

### Recipe Citation 409 — Silent Swallow

`state.duplicate` means the user already cited this recipe. Expected. No toast.

```ts
onError: (err) => {
  if (isAxiosError(err) && err.response?.data?.errorCode === 'state.duplicate') return
  showErrorToast(err)
},
```

### state.concurrency_conflict — Toast + Invalidate

Show the toast, then immediately force a fresh fetch so the user sees the current state.

```ts
onError: (err, id) => {
  showErrorToast(err)
  if (isAxiosError(err) && err.response?.data?.errorCode === 'state.concurrency_conflict') {
    queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
  }
},
```

### All Other Errors

```ts
onError: (err) => { showErrorToast(err) }
```

Switch on `errorCode` string — never on HTTP status number.

---

## useAnalyzeDraft — briefingLoading Lifecycle

This is the only mutation that sets `briefingLoading`. It blocks the entire UI for up to 15 seconds.

```ts
export function useAnalyzeDraft() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (values: AnalyzeFormValues) =>
      api.post<Briefing>('/v1/creator/studio/analyze', values).then((r) => r.data),

    onMutate: () => {
      useAuth.getState().setBriefingLoading(true)
    },

    onSuccess: (data) => {
      queryClient.setQueryData(csQk.studio.briefing(data.id), data)
      navigate(`/studio/${data.reelDraftId}`)
    },

    onError: (err) => {
      const code = isAxiosError(err) ? err.response?.data?.errorCode : undefined
      if (code === 'system.rate_limited') {
        const retry = Number(err.response?.headers['retry-after']) || 30
        toast.info(`Still working on your briefing. Try again in ${retry}s.`)
        return
      }
      showErrorToast(err)
    },

    onSettled: () => {
      useAuth.getState().setBriefingLoading(false)
    },
  })
}
```

While `briefingLoading === true`: render `<BriefingLoadingScreen />` full-screen, block navigation with `useBlocker`, no cancel button.

---

## Idempotency Keys

Every POST/PATCH/PUT/DELETE automatically receives an `Idempotency-Key` header via the axios request interceptor. You do not add them manually in mutation hooks. See `src/api/client.ts`.

---

## mutate vs mutateAsync

| | `mutate` | `mutateAsync` |
|---|---|---|
| Returns | `void` | `Promise<TData>` |
| Error handling | via `onError` callback | catch block in caller |
| Use when | fire-and-forget from event handler | form `onSubmit` that needs to `await` (RHF `handleSubmit`) |

```ts
// Event handler — use mutate
const handleClick = () => dropArc.mutate(arcId)

// RHF onSubmit — use mutateAsync so form errors can be set
const onSubmit = async (values: AnalyzeFormValues) => {
  try {
    await analyze.mutateAsync(values)
    reset()
  } catch (err) {
    if (isAxiosError(err) && err.response?.data?.errorCode === 'validation.multiple_errors') {
      err.response.data.fieldErrors?.forEach(({ field, message }: FieldError) => {
        setError(field as keyof AnalyzeFormValues, { message })
      })
      return
    }
    showErrorToast(err)
  }
}
```

---

## Mutation → Invalidation Map

| Mutation | Invalidates |
|---|---|
| `useAnalyzeDraft` | `setQueryData(csQk.studio.briefing(id))` — no invalidate, data comes from response |
| `useRefreshBriefing` | `csQk.studio.briefing(id)` |
| `useAcceptStoryArc` | `csQk.storyArcs.detail(id)` + `csQk.storyArcs.list(*)` |
| `useDropStoryArc` | `csQk.storyArcs.detail(id)` + `csQk.storyArcs.list(*)` |
| `useCiteRecipe` | `csQk.recipes.citations(reelId)` |
| `useAcknowledgeStitch` | `csQk.stitched.detail(id)` + `csQk.stitched.byReel(*)` |
| `useDismissStitch` | `csQk.stitched.detail(id)` + `csQk.stitched.byReel(*)` |
| `useAcceptBoostOffer` | `csQk.boostOffers.detail(id)` + `csQk.postPublish.report(reelId)` |
