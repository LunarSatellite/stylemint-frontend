# StyleMint Creator Frontend

Creator-facing SPA. Consumes `/v1/creator/*`. Creator role required on all authenticated routes.

This file is auto-loaded by Claude Code on every session. Read it entirely. For deep detail on any topic, open the referenced file in `.claude/stylemint-creator-fe/references/`.

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 · TanStack Query v5 · Zustand · axios · React Hook Form + Zod · Radix UI + Tailwind · TanStack Virtual · date-fns-tz · sonner · lucide-react · Vitest · Playwright

---

## Before Writing Any Code

Read the relevant reference file first:

| Topic | Path |
|---|---|
| Architecture (overview, data flow, patterns) | `.claude/stylemint-creator-fe/references/architecture.md` |
| Auth (JWT, store, guards, login/logout, interceptors) | `.claude/stylemint-creator-fe/references/auth.md` |
| Folder layout + route tree | `.claude/stylemint-creator-fe/references/folder-structure.md` |
| Query keys + staleTime + invalidation | `.claude/stylemint-creator-fe/references/query-keys.md` |
| Error codes | `.claude/stylemint-creator-fe/references/error-codes.md` |
| Enums | `.claude/stylemint-creator-fe/references/enums.md` |
| Design tokens | `.claude/stylemint-creator-fe/references/design-tokens.md` |
| Component authoring | `.claude/stylemint-creator-fe/references/component-patterns.md` |
| Page authoring (lazy, loaders, ErrorBoundary, 3-layer split) | `.claude/stylemint-creator-fe/references/page.md` |
| Mutations (hooks, optimistic updates, error cases) | `.claude/stylemint-creator-fe/references/mutation.md` |
| State management | `.claude/stylemint-creator-fe/references/state-management.md` |
| Forms (RHF + Zod) | `.claude/stylemint-creator-fe/references/form-patterns.md` |
| Testing | `.claude/stylemint-creator-fe/references/testing-guide.md` |
| Performance + bundle | `.claude/stylemint-creator-fe/references/performance-guide.md` |
| Accessibility | `.claude/stylemint-creator-fe/references/accessibility-guide.md` |
| Security | `.claude/stylemint-creator-fe/references/security-practices.md` |
| Git + PR workflow | `.claude/stylemint-creator-fe/references/git-workflow.md` |

---

## Hard Invariants — Absolute, No Exceptions

```
JWT in memory only — never localStorage, never sessionStorage, never cookies
/analyze 429 is NOT the user's fault — always soft message, never generic error
Audio cards → externalListenUrl handoff only — never inline playback
All countdowns use useServerAnchoredCountdown — never raw Date.now()
Boost offer polling uses TanStack Query refetchInterval — never setInterval
Boost offer is FREE in v1.1 — never show payment UI
commissionEarnedFormatted renders as-is — never reformat the raw amount
state.duplicate on recipe citation → silently swallow, no toast
Post-time renders in recommendation.timeZone — never device TZ or Asia/Kathmandu
briefingVersion/reportVersion bump → re-run codegen before updating components
Stitched-reel null fields → degrade gracefully, never crash
ExplanationTooltip is the only way to render explanationByKey strings
Activity timeline uses TanStack Virtual — never render all rows
Analytics window > 365 days → block form submission client-side
schema.ts committed to git — never regenerate in CI
Switch on errorCode string — never on HTTP status number
Never hardcode hex colors — use CSS variables from design tokens
Never use dangerouslySetInnerHTML — no exceptions
Never import Radix UI directly in feature components — use src/components/ui/ wrappers
All pages are lazy-loaded — no page code in the initial bundle
```

---

## Key Patterns (Quick Reference)

### Axios interceptor

```ts
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post','patch','put','delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})
```

### Auth store

```ts
export const useAuth = create<AuthState>((set) => ({
  token: null, claims: null, briefingLoading: false,
  setBriefingLoading: (v) => set({ briefingLoading: v }),
  setToken: (token) => set({ token, claims: parseJwt(token) }),
  clear: () => set({ token: null, claims: null }),
}))
```

### Countdown hook

```ts
export function useServerAnchoredCountdown(serverNowUtc: string, expiresUtc: string): number {
  const serverAnchor = useMemo(() => new Date(serverNowUtc).getTime(), [serverNowUtc])
  const deviceAnchor = useMemo(() => Date.now(), [serverNowUtc])
  const expiresAt    = useMemo(() => new Date(expiresUtc).getTime(), [expiresUtc])
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - (serverAnchor + (Date.now() - deviceAnchor))))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [serverAnchor, deviceAnchor, expiresAt])
  return remaining
}
```

### Error toast

```ts
export function showErrorToast(err: unknown) {
  const errorCode = isAxiosError(err) ? err.response?.data?.errorCode : undefined
  const correlationId = isAxiosError(err) ? err.response?.data?.correlationId : undefined
  const message = (errorCode && errorMessages[errorCode]) ?? 'Something went wrong.'
  toast.error(message, { description: correlationId ? `Reference: ${correlationId}` : undefined })
}
```

### Formatters

```ts
const TZ = 'Asia/Kathmandu'
export const formatDateTime     = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy, HH:mm')
export const formatInAudienceTz = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'EEE, dd MMM • HH:mm')
export const formatMs           = (ms: number) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
export const formatPercent      = (f: number) => f==null ? '—' : `${(f*100).toFixed(1)}%`
export const formatDelta        = (d: number|null) => d==null ? '—' : `${d>=0?'+':''}${(d*100).toFixed(1)}%`
```

All API score/rate/fraction fields are `[0,1]`. Multiply by 100 at render time via `formatPercent`.

---

## Type Generation

```bash
npm run codegen  # → src/api/schema.ts — commit to git, never regenerate in CI
```
