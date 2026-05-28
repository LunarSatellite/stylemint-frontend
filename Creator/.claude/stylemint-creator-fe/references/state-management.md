# State Management — stylemint-creator-fe

## Decision Tree: Where Does This State Live?

```
Is it server data (fetched from an API)?
  YES → TanStack Query. Do not duplicate it in Zustand or useState.

Is it ephemeral UI state scoped to one component?
  YES → React.useState or React.useReducer inside that component.

Is it shared UI state needed across multiple unrelated components?
  YES → Zustand slice.

Is it form state?
  YES → React Hook Form. See form-patterns.md.

Is it a URL-driven filter or tab?
  YES → URL search params via useSearchParams. Keeps state shareable + back-button safe.
```

---

## Zustand — Existing Stores

### Auth Store (`src/auth/store.ts`)

```ts
interface AuthState {
  token: string | null
  claims: JwtClaims | null
  briefingLoading: boolean
  setToken: (token: string) => void
  setBriefingLoading: (v: boolean) => void
  clear: () => void
}
```

Access outside React: `useAuth.getState().token` (e.g. in axios interceptors).
Access in components: `const token = useAuth((s) => s.token)` — always select the minimal slice.

---

## Zustand — Adding a New Slice

Create a separate file per domain. Do not bolt unrelated state onto an existing store.

```ts
// src/features/analytics/store.ts
interface AnalyticsUIState {
  activeWindow: AnalyticsWindow
  setActiveWindow: (w: AnalyticsWindow) => void
}

export const useAnalyticsUI = create<AnalyticsUIState>((set) => ({
  activeWindow: { days: 30 },
  setActiveWindow: (activeWindow) => set({ activeWindow }),
}))
```

### Selector pattern

Always use a selector to prevent unnecessary re-renders:

```ts
// Re-renders only when activeWindow changes, not on any store change
const activeWindow = useAnalyticsUI((s) => s.activeWindow)

// WRONG — subscribes to entire store object
const store = useAnalyticsUI()
```

### Derived state

Compute derived values inside the component or with a custom selector — do not store derived data in Zustand:

```ts
// WRONG — storing derived value
set({ activeWindow, activeWindowLabel: formatWindow(activeWindow) })

// CORRECT — derive at read time
const activeWindow = useAnalyticsUI((s) => s.activeWindow)
const label = formatWindow(activeWindow)
```

---

## Zustand — Reset on Logout

Every store that holds user-specific state must listen to the auth broadcast and clear itself:

```ts
// src/features/analytics/store.ts
useAuth.subscribe(
  (s) => s.token,
  (token) => { if (!token) useAnalyticsUI.setState({ activeWindow: { days: 30 } }) }
)
```

---

## TanStack Query — Patterns

### Do not derive server state into useState

```ts
// WRONG — creates a stale shadow copy
const { data } = useBriefing(id)
const [briefing, setBriefing] = useState(data)

// CORRECT — read directly from the query
const { data: briefing } = useBriefing(id)
```

### Optimistic updates

Use `onMutate` / `onError` / `onSettled` for optimistic updates. Always roll back in `onError`.

```ts
export function useDropStoryArc() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/creator/story-arcs/${id}/drop`),

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
    },

    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['cs','arcs','list'] })
    },
  })
}
```

### Background refetch visibility

Use `isFetching` (not `isLoading`) to show background refresh indicators — `isLoading` is only true on the initial load with no cached data:

```tsx
{isFetching && !isLoading && <RefreshingIndicator />}
```

---

## URL State — Filters + Tabs

Prefer URL search params for anything the user might want to share or navigate back to:

```ts
// src/features/analytics/useAnalyticsFilters.ts
export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const window: AnalyticsWindow = {
    days: Number(searchParams.get('days') ?? 30),
  }

  const setWindow = (w: AnalyticsWindow) =>
    setSearchParams((prev) => { prev.set('days', String(w.days)); return prev })

  return { window, setWindow }
}
```

---

## React.useReducer — Complex Local State

Use `useReducer` when local state has more than 2-3 related fields that change together:

```ts
type StudioDraftState =
  | { phase: 'idle' }
  | { phase: 'editing'; isDirty: boolean }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string }

type Action =
  | { type: 'EDIT' }
  | { type: 'MARK_DIRTY' }
  | { type: 'SUBMIT' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }

function draftReducer(state: StudioDraftState, action: Action): StudioDraftState {
  switch (action.type) {
    case 'EDIT':       return { phase: 'editing', isDirty: false }
    case 'MARK_DIRTY': return state.phase === 'editing' ? { ...state, isDirty: true } : state
    case 'SUBMIT':     return { phase: 'submitting' }
    case 'ERROR':      return { phase: 'error', message: action.message }
    case 'RESET':      return { phase: 'idle' }
  }
}
```
