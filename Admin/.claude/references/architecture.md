# /architecture — Design a feature before writing any code

Use this command when starting any non-trivial work: new feature, new page, refactor, or
integration with a new API resource. Architecture happens BEFORE code.

Describe what you need to build in `$ARGUMENTS`.

---

## Step 1 — Understand the domain before the UI

Answer these questions first. Do not open a code file until you can answer all of them.

1. What is the operator trying to accomplish? (not "what does the UI show" — what is the intent)
2. What API endpoints exist for this? Which are queries, which are mutations?
3. Does any mutation require step-up MFA? (check CLAUDE.md step-up list)
4. What roles can access this feature? What can each role do vs. only view?
5. What are the failure modes? (rate limit, concurrency conflict, not found, forbidden)
6. Does this data change concurrently across multiple operators? (→ impacts staleTime and optimistic updates)
7. What is the volume? (small list → DataTable, unbounded/audit-style → VirtualTable)

---

## Step 2 — Map the data flow

Every feature follows a single directional flow. Draw this mentally before building:

```
Backend API
    ↓
  axios client (interceptors add auth, idempotency, language)
    ↓
  TanStack Query cache (keyed by qk.*)
    ↓
  Container component (owns isLoading, isError, data, mutation triggers)
    ↓
  Presentation component (props only — renders, no async)
    ↓  ↑
  Form component (RHF + Zod → mutation → invalidate cache)
```

If you are tempted to break this flow (e.g. put `useQuery` in a presentation component,
or pass a query client into a form), stop and redesign.

---

## Step 3 — Decide state ownership (the most important architectural decision)

Use this decision tree for every piece of state:

```
Is it data that came from or will be sent to the server?
  YES → TanStack Query. Do not put it anywhere else.
  NO  ↓

Is it form input being built up before submission?
  YES → React Hook Form. Do not put it in useState or Zustand.
  NO  ↓

Is it UI state shared across two or more features simultaneously?
  YES → Zustand. Add a slice to the appropriate store.
  NO  ↓

Is it UI state local to one component or subtree?
  YES → useState (or useReducer if transitions are complex).
```

**The most common mistake:** storing server data in Zustand. This creates two sources of truth,
causes stale data bugs, and defeats React Query's invalidation system entirely.

---

## Step 4 — Design the component boundary

Split components at data ownership boundaries, not at visual complexity.

### Rule: one concern per component type

| Component type    | Owns                        | Forbidden from                          |
|-------------------|-----------------------------|-----------------------------------------|
| Container         | useQuery, useMutation, state | Rendering JSX beyond wiring             |
| Presentation      | Visual structure, layout    | useQuery, useMutation, any async        |
| Form              | RHF form state, submit      | useQuery (except for select options)    |
| Page              | ErrorBoundary, title        | Data fetching, business logic           |
| Hook              | Reusable stateful logic     | Rendering JSX                           |

### When to split a component further

Split a presentation component when:
- It has more than one independently scrollable or collapsible section
- It has a meaningful sub-unit that would be tested independently
- It is reused in two or more containers

Do NOT split just because the file is long. A 200-line file with one clear job is better
than four 50-line files that are meaningless without each other.

---

## Step 5 — Design the cache invalidation strategy

Every mutation must answer: **what cache keys become stale after this action?**

Design this before writing the mutation hook.

```
Action: KYC reviewer approves an application
Stale after: qk.kyc.queue(*) — the item leaves the queue
             qk.kyc.detail(id) — the item's state changes
             qk.audit(*) — a new audit log entry exists

Action: SuperAdmin grants a role to an admin
Stale after: qk.admin(id) — that admin's role list changed
             qk.admins(*) — list view shows roles too
             NOT qk.me — unless they granted themselves a role

Action: Platform config updated
Stale after: qk.config() only — nothing else depends on it
```

Invalidate the **narrowest** key first. Broad wildcard invalidations (`invalidateQueries` with
`exact: false`) cause unnecessary refetches across the app.

---

## Step 6 — Design the error surface

For each mutation, map every realistic error to a user action:

| Error code                  | What the user sees                    | What the UI does                        |
|-----------------------------|---------------------------------------|-----------------------------------------|
| `mfa.step_up_required`      | TOTP modal opens                      | useMutationWithStepUp handles it        |
| `state.concurrency_conflict`| Toast: "Refreshing…"                  | Invalidate query, do not re-submit      |
| `state.invalid_transition`  | Toast: action not allowed             | No retry, operator must re-read state   |
| `system.rate_limited`       | Toast with countdown                  | Disable trigger button for Retry-After  |
| `resource.not_found`        | Toast or redirect to list             | Depends on context                      |
| `validation.multiple_errors`| Inline field errors                   | setError per field via RHF              |
| `auth.forbidden`            | Toast: no permission                  | Do not expose the action to begin with  |

If `auth.forbidden` can reach the UI, the permission check in the component is missing.

---

## Step 7 — Design the permission boundary

Map roles to actions in this feature:

```
Feature: Admin account management

SuperAdmin    → can view list, view detail, grant role, revoke role, disable, enable, force-remove MFA
KycReviewer   → cannot access /admins at all (RequireRole blocks at router level)
Readonly      → can view list and detail, no mutations (hide all action buttons)
```

Never let a forbidden action reach the network. The order of defence is:
1. Router: `RequireRole` blocks the route entirely
2. Component: `permissions.*()` hides/disables the button
3. Interceptor: returns 401/403 if something bypasses the above

All three layers must exist. Defence in depth.

---

## Step 8 — Design for concurrent operators

StyleMint admin is a multi-operator system. Two reviewers can work the same queue simultaneously.

Concurrency design checklist:
- [ ] KYC and moderation queries use `staleTime: 10_000` (not the default 30 000)
- [ ] Mutations that change queue items use optimistic updates with rollback on error
- [ ] After a `state.concurrency_conflict` error, invalidate and do NOT auto-retry
- [ ] Show a meaningful "Refreshing…" toast so the operator knows what happened
- [ ] The server uses optimistic concurrency (ETag or version field) — include it in mutations that need it

---

## Step 9 — Scalability considerations

Before building, answer:

**Data volume:** How many rows can this list realistically have?
- < 500 rows → DataTable with server-side pagination
- Unbounded (audit log, event streams) → VirtualTable with infinite scroll

**Query frequency:** How often does this data change?
- Changes in real-time across operators → `staleTime: 10_000`
- Changes rarely → `staleTime: 60_000`
- Never changes during a session → consider `staleTime: Infinity`

**Re-render cost:** Does this component appear inside a list that renders hundreds of times?
- Yes → Profile first. Apply `React.memo` only if profiler proves benefit.

**Bundle cost:** Is this feature only accessible to SuperAdmin (rare path)?
- Yes → lazy-load the route. The 200 KB bundle budget is shared across all routes.

---

## Step 10 — Write the feature skeleton, not the feature

Before writing real logic, create the files with stubs:

```
features/<name>/
  <Name>Container.tsx    — stub: returns <div>Container</div>
  <Name>View.tsx         — stub: returns <div>View</div>
  <Name>Form.tsx         — stub: returns <form>Form</form>

api/queries/use<Name>.ts     — stub: returns hardcoded data
api/mutations/use<Name>.ts   — stub: logs vars to console
```

Wire the route. Confirm navigation works. Then fill in the real logic one layer at a time,
starting from the API hooks inward to the container, then outward to the view and form.

This way, every step is testable and the structure is visible before complexity is added.

---

## Architecture anti-patterns — never do these

| Anti-pattern                                 | Why it breaks                                                     |
|----------------------------------------------|-------------------------------------------------------------------|
| `useQuery` inside a presentation component   | Breaks the container/presentation boundary; untestable in isolation|
| Server data stored in Zustand                | Two sources of truth; stale data bugs; invalidation doesn't work  |
| Inline role string checks (`roles.includes('SuperAdmin')`) | Scattered, inconsistent; use `permissions.*()` |
| HTTP status-based error handling (`if status === 403`) | Status codes are unreliable; use `errorCode` string |
| Plain `useMutation` on a step-up endpoint    | Step-up flow silently broken; operator gets an error instead of TOTP prompt |
| Global `invalidateQueries` with no key       | Refetches everything in the app; performance killer               |
| `dangerouslySetInnerHTML` anywhere           | XSS vector; audit log payload must render as plain text           |
| Token in localStorage or cookies             | Security requirement: token in memory only                        |
| Barrel `index.ts` in `features/`            | Creates circular dependency chains as features grow               |
| `staleTime: 0` on any query                  | Disables caching; every render triggers a network request         |
| Hardcoded hex colors                         | Breaks dark mode and theme consistency; use CSS variables          |
| Magic numbers for enum values (`if state === 2`) | Use `KycState.Approved`; intent is opaque without the constant |

---

## Checklist before writing the first line of code

- [ ] I know which API endpoints this feature uses
- [ ] I know which mutations require step-up MFA
- [ ] I know which roles can access what actions
- [ ] I have drawn the data flow (API → cache → container → view)
- [ ] I have decided state ownership for every piece of state
- [ ] I have mapped mutations to their cache invalidation keys
- [ ] I have mapped error codes to user-facing actions
- [ ] I have decided DataTable vs VirtualTable based on data volume
- [ ] I have checked the correct staleTime for this resource
- [ ] I have designed the permission boundary (router + component + network)
