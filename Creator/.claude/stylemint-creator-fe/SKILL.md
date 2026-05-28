---
name: stylemint-creator-fe
description: |
  Use this skill whenever working in the stylemint-creator-studio-frontend repo
  or building any creator-facing feature for StyleMint. Trigger on: reel
  studio briefing pages, the 15-second analyze flow, story arc screens,
  post-publish coach report, recipe citations, stitched-reel suggestions,
  boost offer countdown, activity timeline, analytics dashboards, query hooks,
  mutation hooks, routing, error handling, enums, formatters, or any component
  in this SPA. Also trigger when implementing useServerAnchoredCountdown,
  dynamic refetchInterval polling, ExplanationTooltip, the soft 429 for
  /analyze, audience timezone rendering, or scaffolding anything new in this
  repo. Always use this skill before writing any code in this repo.
---

# stylemint-creator-fe

Creator-facing SPA. Consumes `/v1/creator/*`. Creator role required for all routes.

**Before writing any code**, read the relevant reference file:
- Folder layout + route tree → `references/folder-structure.md`
- Query keys + staleTime + invalidation map → `references/query-keys.md`
- Error codes + messages → `references/error-codes.md`
- Enums (wire format integers) → `references/enums.md`
- Design tokens (CSS variables) → `references/design-tokens.md`
- Component authoring + TypeScript → `references/component-patterns.md`
- State management (Zustand + TQ) → `references/state-management.md`
- Form patterns (RHF + Zod) → `references/form-patterns.md`
- Testing conventions → `references/testing-guide.md`
- Performance + bundle rules → `references/performance-guide.md`
- Accessibility standards → `references/accessibility-guide.md`
- Security practices → `references/security-practices.md`
- Git + PR workflow → `references/git-workflow.md`

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 data routers ·
TanStack Query v5 · Zustand · axios · React Hook Form + Zod ·
Radix UI + Tailwind + clsx + tailwind-merge · TanStack Virtual ·
date-fns + date-fns-tz · sonner · lucide-react · openapi-typescript ·
Vitest + React Testing Library · Playwright

---

## Type Generation

```bash
npm run codegen  # → src/api/schema.ts — commit, never regenerate in CI
```

When `briefingVersion` or `reportVersion` bumps on a response: re-run codegen before updating rendering components. Never project a new schema against old types.

---

## Axios Interceptor Chain

```ts
// src/api/client.ts
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post','patch','put','delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})
```

---

## Zustand Auth Store

```ts
// src/auth/store.ts
export const useAuth = create<AuthState>((set) => ({
  token: null,
  claims: null,
  briefingLoading: false,           // true during 15s analyze call
  setBriefingLoading: (v) => set({ briefingLoading: v }),
  setToken: (token) => set({ token, claims: parseJwt(token) }),
  clear: () => set({ token: null, claims: null }),
}))
```

Token in memory only. Never localStorage.

---

## Reel Studio — 15-Second Briefing Flow

`POST /v1/creator/studio/analyze` hits LLM + scoring in parallel (15s hard budget).

```ts
// src/api/mutations/useAnalyzeDraft.ts
onMutate: () => useAuth.getState().setBriefingLoading(true),
onSettled: () => useAuth.getState().setBriefingLoading(false),
onSuccess: (data) => {
  queryClient.setQueryData(csQk.studio.briefing(data.id), data)
  navigate(`/studio/${data.reelDraftId}`)
},
onError: (err: any) => {
  const code = err.response?.data?.errorCode
  if (code === 'system.rate_limited') {
    const retry = Number(err.response?.headers['retry-after']) || 30
    toast.info(`Still working on your briefing. Try again in ${retry}s.`)
    disableButtonFor(retry * 1000)
    return
  }
  showErrorToast(err)
},
```

When `briefingLoading === true`:
- Render `<BriefingLoadingScreen />` — full screen, "Analyzing your draft…"
- Block navigation with React Router `useBlocker`
- No cancel button

The `/analyze` 429 is NOT the user's fault. Always use soft message.

---

## Audio Cards — Never Inline Playback

```tsx
// CORRECT
{card.externalListenUrl && (
  <Button onClick={() => window.open(card.externalListenUrl!, '_blank', 'noopener,noreferrer')}>
    Listen
  </Button>
)}
// WRONG — never play audio inside the app
```

---

## Post-Time — Audience Timezone, Not Device Timezone

```ts
// recommendation.timeZone is audience IANA timezone — not the device's
const display = formatInTimeZone(
  new Date(recommendation.suggestedAtUtc),
  recommendation.timeZone,
  'EEE, dd MMM • HH:mm'
)
```

---

## ExplanationTooltip — Only Way to Render explanationByKey

```tsx
// src/components/ExplanationTooltip.tsx
export function ExplanationTooltip({ explanations, featureKey, children }) {
  const text = explanations[featureKey]
  if (!text) return <>{children}</>
  return <Tooltip content={text}><span className="cursor-help">{children}</span></Tooltip>
}
// Never inline explanation strings directly in components
```

---

## Boost Offer — Dynamic Polling

```ts
// src/api/queries/useBoostOffer.ts
useQuery({
  queryKey: csQk.boostOffers.detail(id),
  queryFn: () => fetchBoostOffer(id),
  staleTime: 0,
  refetchInterval: (query) => {
    const state = query.state.data?.state
    if (state === BoostOfferState.Accepted || state === BoostOfferState.Expired) return false
    return 60_000
  },
})
```

Never use `setInterval` manually. TanStack Query `refetchInterval` handles cleanup.
Boost offer is FREE in v1.1 — never show payment UI.

---

## useServerAnchoredCountdown — All Timed Features

```ts
// src/hooks/useServerAnchoredCountdown.ts
export function useServerAnchoredCountdown(serverNowUtc: string, expiresUtc: string): number {
  const serverAnchor = useMemo(() => new Date(serverNowUtc).getTime(), [serverNowUtc])
  const deviceAnchor = useMemo(() => Date.now(), [serverNowUtc])
  const expiresAt    = useMemo(() => new Date(expiresUtc).getTime(), [expiresUtc])
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - (serverAnchor + (Date.now() - deviceAnchor))))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [serverAnchor, deviceAnchor, expiresAt])
  return remaining  // milliseconds
}
```

Returns milliseconds. Format `MM:SS`: `Math.floor(ms/60000)` + `String(Math.floor((ms%60000)/1000)).padStart(2,'0')`.
Never use raw `Date.now()` for countdowns.

---

## Recipe Citation — Silent 409

```ts
onError: (err) => {
  if (err.response?.data?.errorCode === 'state.duplicate') return  // silently ignore
  showErrorToast(err)
},
```

---

## commissionEarnedFormatted — Render Directly

```tsx
// CORRECT — server already did locale formatting
<p>{report.commissionEarnedFormatted}</p>

// WRONG — never reformat the raw amount
<p>{formatMoney(report.commissionEarnedAmount, report.currency)}</p>
```

---

## Stitched-Reel — Null Safety

```tsx
<img src={s.candidateReelThumbnailUrl ?? '/placeholder-reel.png'} />
<p>{s.candidateCreatorDisplayName ?? 'Creator unavailable'}</p>
```

Never crash on null denormalized fields.

---

## Formatters

```ts
// src/lib/formatters.ts
const TZ = 'Asia/Kathmandu'
export const formatDateTime     = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy, HH:mm')
export const formatInAudienceTz = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, 'EEE, dd MMM • HH:mm')
export const formatMs           = (ms: number) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
export const formatPercent      = (f: number) => f==null ? '—' : `${(f*100).toFixed(1)}%`
export const formatDelta        = (d: number|null) => d==null ? '—' : `${d>=0?'+':''}${(d*100).toFixed(1)}%`
```

All score/rate/fraction API fields are `[0,1]`. Multiply by 100 for display.

---

## Error Boundaries

Page and feature widget level. A crashing chart must not crash the page.

---

## Hard Invariants

```
JWT in memory only — never localStorage, never cookies
/analyze 429 is NOT the user's fault — always soft message, never generic error
Audio cards → externalListenUrl handoff only — never inline playback
All countdowns use useServerAnchoredCountdown — never raw Date.now()
Boost offer polling uses TanStack Query refetchInterval — never setInterval
Boost offer is FREE — never show payment UI
commissionEarnedFormatted renders as-is — never reformat raw amount
state.duplicate on recipe citation → silently swallow, no toast
Post-time renders in recommendation.timeZone — never device TZ or Asia/Kathmandu
briefingVersion/reportVersion bump → re-run codegen before updating components
Stitched-reel null fields → degrade gracefully, never crash
ExplanationTooltip is the only way to render explanationByKey strings
Activity timeline uses TanStack Virtual — never render all rows
Analytics window > 365 days → block form submission client-side
schema.ts committed to git — never regenerate in CI
Switch on errorCode — never on HTTP status number
Never hardcode hex colors — use CSS variables from design tokens
Never use dangerouslySetInnerHTML — no exceptions
```
