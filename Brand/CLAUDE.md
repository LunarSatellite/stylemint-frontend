# StyleMint Brand Studio — Frontend

Vendor-facing SPA for the StyleMint platform. Vendors author briefs, track analytics, and manage creator partnerships. Admins manage goal templates and vendor policies.

API surfaces:
- `/v1/vendor/*` — vendor role
- `/v1/admin/brand-studio/*` — admin role

---

## Dev commands

```bash
npm install             # install dependencies
npm run dev             # Vite dev server → http://localhost:5173
npm run build           # production build
npm run build -- --mode analyze   # bundle visualizer (run before any import-touching PR)
npm run codegen         # regenerate src/api/schema.ts from OpenAPI spec
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint
npm run test            # Vitest (unit + integration)
npm run test:coverage   # Vitest with coverage report
npm run test:e2e        # Playwright end-to-end
npm run test:e2e:ui     # Playwright with interactive UI
```

---

## Environment variables

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080
```

The app throws at startup if `VITE_API_BASE_URL` is missing. No silent fallbacks.

---

## Stack

| Layer | Library |
|---|---|
| Bundler | Vite 5 |
| UI | React 18 + TypeScript 5 strict |
| Routing | React Router v6 (data routers) |
| Server state | TanStack Query v5 |
| Virtual lists | TanStack Virtual v3 |
| Client state | Zustand |
| HTTP | axios |
| Forms | React Hook Form + Zod |
| UI primitives | Radix UI |
| Styling | Tailwind CSS + clsx + tailwind-merge |
| Tables | TanStack Table v8 |
| Charts | ECharts via echarts-for-react (Canvas only) |
| Dates | date-fns + date-fns-tz (TZ: Asia/Kathmandu) |
| Toasts | sonner |
| Icons | lucide-react |
| API types | openapi-typescript (generated) |
| Unit tests | Vitest 2 + Testing Library + MSW 2 |
| E2E tests | Playwright |

---

## Project structure

Full layout and route tree → `.claude/references/folder-structure.md`

Key rules:
- `src/pages/` — thin wrappers, compose features only
- `src/features/` — all domain logic and UI
- `src/components/ui/` — Radix + Tailwind primitives, never import Radix directly in features
- `src/api/queries/` — TanStack Query hooks (read)
- `src/api/mutations/` — TanStack Query hooks (write)
- `src/api/schema.ts` — generated, committed to git, never regenerate in CI

---

## Architecture decisions

### Auth
- JWT stored in Zustand memory only — never `localStorage`, never cookies
- Silent refresh at 80% of token TTL via `scheduleSilentRefresh()`
- Cross-tab logout via `BroadcastChannel('sm_auth')`
- Multi-team vendors carry `X-Vendor-Account-Id` header — only when non-null in Zustand

### Data fetching
- All server state in TanStack Query — nothing else in Zustand except auth + `draftingBrief`
- Query keys in `bsQk` factory — see `.claude/references/query-keys.md`
- Brief detail: `staleTime: 30s`, `gcTime: 0` (large payload, evict on unmount)
- Dashboard / analytics: `staleTime: 60s`
- Never retry on 4xx — fail fast and show the error

### Mutations
- Axios interceptor auto-attaches `Idempotency-Key` on POST/PATCH/PUT/DELETE
- Brief PATCH sends only `dirtyFields` from React Hook Form — never the full object
- Every PATCH/lock/fork/retire includes `rowVersion` for optimistic concurrency
- `409 state.concurrency_conflict` → invalidate query + toast "Refreshing…"
- `system.rate_limited` → read `Retry-After`, disable button, toast
- Switch on `errorCode` string — never on HTTP status number

### Performance
- Every page is `lazy()` — zero eager page imports in `router.tsx`
- Route chunks prefetched on nav-link hover via dynamic `import()`
- Lists > 50 rows use `useVirtualizer` — no exceptions
- Infinite / growing lists use `useInfiniteQuery` with cursor — never offset pagination
- Analytics aggregation (> 90 day windows) runs in a Web Worker off the main thread
- ECharts renders Canvas — never Recharts (SVG degrades above ~500 nodes)

### Styling
- Design tokens are CSS variables in `src/index.css` — see `.claude/references/design-tokens.md`
- Never hardcode hex colors in components or ECharts options
- Always use `cn()` (clsx + tailwind-merge) for conditional class composition

---

## Reference files

All in `.claude/references/` — read the relevant one before writing code:

| File | When to read |
|---|---|
| `architecture.md` | **starting any new feature** — mental models, data flow, state decisions, error architecture, feature checklist |
| `auth.md` | anything touching login, token, guards, axios interceptors, silent refresh, BroadcastChannel logout |
| `folder-structure.md` | scaffolding anything new, checking where a file belongs |
| `query-keys.md` | adding a query hook, wiring a mutation's invalidation |
| `error-codes.md` | handling API errors, writing error toasts |
| `enums.md` | using any status, state, or kind value from the API |
| `design-tokens.md` | styling components, configuring ECharts colors |
| `testing.md` | writing tests, adding MSW handlers, setting up Playwright |
| `performance.md` | adding a new list/table, touching imports, configuring Vite chunks |
| `component-conventions.md` | creating a component, typing props, applying branded IDs |
| `form-patterns.md` | building any form — RHF+Zod wiring, dirtyFields PATCH, field error display, rate-limit disable |
| `mutation.md` | writing any mutation hook — rowVersion, concurrency_conflict, errorCode switch, invalidation, onSettled |

---

## Non-negotiable rules

- `dangerouslySetInnerHTML` — never
- `localStorage` / cookies for auth — never
- Recharts — never (use ECharts Canvas)
- Hardcoded hex colors — never (use CSS variables)
- Magic number enums — never (use `src/lib/enums.ts`)
- Raw `string` for entity IDs — never (use branded types from `src/lib/brands.ts`)
- `schema.ts` regeneration in CI — never (commit it, generate locally)
- Offset pagination on growing lists — never (use cursor + `useInfiniteQuery`)
- Eager page imports in `router.tsx` — never (use `lazy()`)
- Lists > 50 rows without `useVirtualizer` — never
