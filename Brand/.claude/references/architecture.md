# Architecture — stylemint-brand-fe

How to think about this system. Read this before designing any feature.

---

## Mental model — what this app is

A **vendor control panel** for a creator commerce platform. Vendors (brands) come here to:
1. Author campaign briefs that instruct creators
2. Monitor dashboard performance (revenue, reach, creators)
3. Drill into analytics for products and partnerships
4. Review their activity timeline
5. (Admin only) manage goal templates and vendor policies

Every surface is **read-heavy with infrequent mutations**. Most pages are dashboards that load data once and display it. The exception is brief authoring — a rich form editor with real-time PATCH saves.

This shapes the architecture: aggressive caching (60s staleTime), optimistic UX on navigation, but conservative mutation handling (no guessing, always confirm with server).

---

## Feature development lifecycle

When building any new feature, follow this order. Skipping steps creates rework.

### 1. Understand the API contract first

Before writing a single component, read the OpenAPI spec or ask what the endpoint returns. Confirm:
- Shape of the response DTO
- Pagination strategy (cursor or none)
- What error codes can come back
- Whether the resource has `rowVersion` (mutable resources always do)
- Whether POST/PATCH is idempotent (all mutations here are — interceptor handles it)

### 2. Define the TypeScript types

Run `npm run codegen` if the endpoint is new. Types come from `src/api/schema.ts` — never hand-write DTOs that duplicate the spec.

### 3. Assign a query key

Add it to the `bsQk` factory in `src/api/queryKeys.ts`. The key encodes all parameters that distinguish one cache entry from another. If the same data is filtered differently, those are different keys.

### 4. Design the component tree top-down

Sketch (even mentally) the hierarchy before coding:

```
FeaturePage                  ← thin page, no logic
  └── FeatureRoot            ← owns the query hook, handles loading/error
        ├── FeatureSkeleton  ← shown while loading
        ├── FeatureError     ← shown on error (or let ErrorBoundary catch)
        └── FeatureContent   ← receives loaded data as props, pure display
              ├── SubWidgetA
              └── SubWidgetB
```

The query hook lives at `FeatureRoot`, not inside leaf components. Leaf components receive plain data as props — they do not call hooks.

### 5. Build loading and error states before the happy path

Skeleton first. Error fallback second. Happy path third. This forces you to think about dimensions (skeleton must match loaded layout to avoid shift) and error recovery (what can the user do when the API fails?).

### 6. Wire mutations last

After the read path works and is tested, add mutations. Each mutation needs:
- The narrowest possible invalidation key
- A `state.concurrency_conflict` error handler if the resource has `rowVersion`
- A success toast with enough context for the user to understand what changed

### 7. Write tests alongside, not after

Test the query hook with MSW as you build it. Test the mutation's `onSuccess` and `concurrency_conflict` paths. Write the Playwright spec for the critical user flow at the end.

---

## Data flow — the single direction

```
OpenAPI spec
    ↓
src/api/schema.ts  (generated types)
    ↓
axios client  (interceptors: auth header, idempotency key, accept-language)
    ↓
TanStack Query cache  (all server state lives here)
    ↓
Query hooks  (useBriefDetail, useDashboard, …)
    ↓
Feature root component  (owns the hook, distributes data down)
    ↓
Leaf components  (receive typed props, render, emit user events)
    ↓
Mutation hooks  (useUpdateBrief, useLockBrief, …)
    ↓
axios client  → API
    ↓
onSuccess: narrow cache invalidation or setQueryData
    ↓
TanStack Query re-renders affected components
```

**This flow is unidirectional and must not be shortcut.** Never call axios directly in a component. Never put API response data into Zustand. Never read from the cache outside a query hook.

---

## State decision tree

When you need to store something, work through this in order:

```
Is it data that comes from the API?
  → TanStack Query. Full stop.

Is it auth (JWT, claims, vendorAccountId)?
  → Zustand auth store. Token in memory only.

Is it a loading flag for a long server operation (LLM draft)?
  → Zustand (draftingBrief). One flag, known shape.

Is it cross-tab session state (logout)?
  → BroadcastChannel. Not Zustand, not localStorage.

Is it form state?
  → React Hook Form. Never useState for form fields.

Is it local UI state (dropdown open, selected tab, modal visible)?
  → useState in the component that owns it.
    If two siblings need it → lift to their parent.
    If half the app needs it → reconsider the design.

Is it derived from existing state?
  → Compute it inline or useMemo. Never store derived state.
```

If something doesn't fit any of these, that's a design smell — stop and question whether you need it at all.

---

## Component design principles

### One concern per component

A component either fetches data OR renders it — not both. The only exception is the feature root, which is the single point where a query hook is called and results are distributed downward.

### Size as a signal, not a rule

Split a component when it has more than one independent reason to change, not just because it's long. A 300-line component that does one thing is better than three 100-line components with tangled props.

### Props are the contract

A component's props define its contract with the outside world. Keep props minimal. Avoid "pass-through" props that a component does not use itself. If a child needs data the parent doesn't use, question whether the hierarchy is right.

### Composition over configuration

Prefer `children` and compound components over `variant="X"` props that control internal behavior. A component with 12 boolean props is a sign it should be two or three separate components.

### Colocation

Test files live next to the component they test, not in a separate `__tests__` folder at the root. MSW handlers are colocated in `src/mocks/handlers/`, factories in `src/mocks/factories/`. Keep what changes together, together.

---

## Error architecture — how errors propagate

There are four error channels. Each has a different owner.

### 1. API / network errors → mutation `onError` + `showErrorToast`

Caught in the mutation's `onError` callback. Switch on `errorCode` string (see `references/error-codes.md`). Toast includes `correlationId` for support tracing. Never swallow silently.

### 2. Query errors → ErrorBoundary

`useQuery` errors propagate to the nearest `ErrorBoundary`. Dashboard widgets each have their own boundary so one failing widget doesn't kill the page. Page-level boundary catches anything that escapes widget boundaries.

### 3. Form validation errors → React Hook Form `fieldErrors`

Zod schema validates on submit. Field-level errors display inline below the input. Never use `alert()` or toast for form validation errors.

### 4. Auth errors → redirect

`401` from any query or mutation → clear Zustand → `broadcastLogout()` → navigate to `/login`. This is handled once in the axios response interceptor, not in every query.

### Error boundary placement rule

```
AppShell
  ErrorBoundary (page-level fallback)
    Page
      ErrorBoundary (widget-level fallback) ← one per independent widget
        Widget
```

Never put a single root-level boundary and call it done. Widget-level isolation is what keeps a partial API failure from degrading the entire dashboard.

---

## API contract — what to demand from the backend

The frontend should be explicit about what it needs. These are requirements, not wishes:

| Requirement | Why |
|---|---|
| `errorCode` string on every error response | FE switches on errorCode, not HTTP status |
| `correlationId` on every error response | Support tracing in error toasts |
| `rowVersion` on every mutable resource | Optimistic concurrency, no silent overwrites |
| `nextCursor` (nullable) on every paginated list | Cursor pagination, no offset drift |
| Idempotency-Key support on all mutations | Safe retries, duplicate-proof |
| `state` field as integer enum on resources | Wire format is always int, display is FE's job |

If a new endpoint comes back without any of these, push back before building the FE integration. Retrofitting concurrency control or cursor pagination after the fact costs much more than specifying it upfront.

---

## Performance mental model

Think in terms of **what the user perceives**, not raw metrics.

### Critical path

```
Auth check → app shell renders → first data fetch → page skeleton → data loads → interactive
```

The shell (sidebar + topbar) must render without waiting for data. Every page shows a skeleton immediately. Data loads into the skeleton. No blank white screens.

### When to prefetch

- Route chunks: prefetch on nav hover (zero cost, eliminates most load spinners)
- Data: TanStack Query's `staleTime` handles this — data already in cache renders instantly

### When NOT to optimistic-update

Optimistic updates are only appropriate when the server outcome is deterministic and the cost of a rollback is low. In this app:
- **Never** for LLM brief draft — result is unknown, latency is 2–5s
- **Never** for state transitions (lock/fork/retire) — race conditions exist
- **Acceptable** for simple field updates where conflicts are extremely rare (not implemented yet, evaluate case by case)

### Bundle thinking

ECharts (~800 kB) is the largest dependency. It must stay in its own lazy chunk and only load on analytics routes. If a new large dependency is added, verify it doesn't land in the initial bundle with `npm run build -- --mode analyze`.

---

## Security mental model

This is a single-page app with a JWT bearer token. The threat model is:

| Threat | Mitigation |
|---|---|
| XSS steals JWT | Token in JS memory only (not localStorage, not cookies). XSS can steal it, but can't persist it. Session ends on tab close. |
| XSS injects HTML | `dangerouslySetInnerHTML` is banned. All user-supplied strings are text content only. |
| CSRF | Not applicable — no cookies, so no CSRF surface |
| Stale session across tabs | BroadcastChannel logout propagates immediately to all tabs |
| Privilege escalation | Role gates enforced in `RequireVendorRole` / `RequireAdminRole` guards. Never conditionally render admin UI — gate the route. |
| Data leakage | `benchmark === null` hides the widget entirely — never display partial or empty benchmarks |

The backend enforces all authorization. The frontend guards are UX, not security. Never trust client-side role checks as the sole protection.

---

## Scalability mental model

Scalability here means: **the app stays fast and maintainable as the dataset grows and the team grows**.

### Dataset growth

- Activity feed: 10 items today → 10,000 items in a year → `useVirtualizer` + cursor pagination from day one
- Analytics: 30-day window today → 365-day window → Web Worker aggregation from day one
- Dashboard widgets: one failing widget must not cascade → ErrorBoundary per widget from day one

Design for the steady-state dataset, not the MVP dataset.

### Team growth

- Features are isolated in `src/features/` — a new engineer can work on `brief-authoring/` without touching `analytics/`
- Reference files codify decisions so they don't live in one person's head
- Enums, error codes, and query keys are single sources of truth — no magic strings scattered across the codebase
- Every query hook has a test — new engineers can refactor with confidence

### Adding a new feature — checklist

- [ ] API contract confirmed (shape, errors, pagination, rowVersion)
- [ ] Types from `schema.ts` (run codegen if needed)
- [ ] Query key added to `bsQk` factory
- [ ] MSW handler + factory added for tests
- [ ] Page module is `lazy()` in `router.tsx`
- [ ] Page has a skeleton with matching dimensions
- [ ] ErrorBoundary wraps the page (and widgets if dashboard-style)
- [ ] Mutation invalidates narrowest possible keys
- [ ] `concurrency_conflict` handler if resource has `rowVersion`
- [ ] All entity IDs branded in query hook
- [ ] Lists > 50 rows use `useVirtualizer`
- [ ] No hardcoded hex colors
- [ ] Query hook tested (success + error paths)
- [ ] Mutation tested (success + concurrency_conflict)
- [ ] Playwright spec for critical user flow
