# Auth — stylemint-creator-fe

---

## Invariants

```
JWT in memory only — never localStorage, never sessionStorage, never cookies
Switch on errorCode string — never on HTTP status number
Open redirect: validate against SAFE_PATHS before any post-login navigation
BroadcastChannel logout — all tabs must clear on any single tab's logout
```

---

## File Map

```
src/auth/
├── store.ts             # Zustand: token, claims, briefingLoading
├── parseClaims.ts       # base64 → JwtClaims (no verify — server-validated)
├── guards.tsx           # RequireAuth, RequireCreatorRole
└── broadcastLogout.ts   # BroadcastChannel multi-tab logout
```

---

## Auth Store (`src/auth/store.ts`)

```ts
interface JwtClaims {
  sub: string          // creatorId
  role: string         // must be 'creator' on all protected routes
  exp: number          // Unix seconds
}

interface AuthState {
  token: string | null
  claims: JwtClaims | null
  briefingLoading: boolean   // true during 15-second analyze-draft flow only
  setToken: (token: string) => void
  setBriefingLoading: (v: boolean) => void
  clear: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  claims: null,
  briefingLoading: false,
  setToken: (token) => set({ token, claims: parseClaims(token) }),
  setBriefingLoading: (v) => set({ briefingLoading: v }),
  clear: () => set({ token: null, claims: null }),
}))
```

**Access patterns:**

```ts
// Outside React (axios interceptors, mutation callbacks)
useAuth.getState().token

// Inside components — always select the minimal slice
const token   = useAuth((s) => s.token)
const claims  = useAuth((s) => s.claims)
const loading = useAuth((s) => s.briefingLoading)
```

---

## parseClaims (`src/auth/parseClaims.ts`)

Decodes the JWT payload only — does **not** verify the signature (the server validates on every request).

```ts
export function parseClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}
```

---

## Route Guards (`src/auth/guards.tsx`)

### RequireAuth

Redirects to `/login` when there is no token. Preserves the intended path in `?next=` so the login page can redirect back after success.

```tsx
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <>{children}</>
}
```

### RequireCreatorRole

Renders a `403` page when the authenticated user does not have the `creator` role. Must be nested inside `<RequireAuth>`.

```tsx
export function RequireCreatorRole({ children }: { children: React.ReactNode }) {
  const claims = useAuth((s) => s.claims)

  if (claims?.role !== 'creator') {
    return <UnauthorizedPage />
  }

  return <>{children}</>
}
```

### Usage in router

```tsx
// src/router.tsx
{
  element: <RequireAuth><AppShell /></RequireAuth>,
  children: [
    {
      path: '/analytics',
      element: <RequireCreatorRole><AnalyticsDashboardPage /></RequireCreatorRole>,
    },
    // ... all other protected routes
  ],
}
```

`/login` is the only route outside `<RequireAuth>`.

---

## Login Flow

1. User submits credentials on `<LoginPage />`.
2. POST `/v1/auth/login` returns `{ token: string }`.
3. Call `useAuth.getState().setToken(token)` — stores JWT in memory, parses claims.
4. Navigate to the validated `?next=` path, or fall back to `/analytics`.

```ts
// src/pages/LoginPage.tsx (abbreviated)
const { mutate: login } = useMutation({
  mutationFn: (creds: LoginCredentials) =>
    api.post<{ token: string }>('/v1/auth/login', creds).then((r) => r.data),
  onSuccess: ({ token }) => {
    useAuth.getState().setToken(token)
    navigate(safePath(searchParams.get('next')))
  },
  onError: showErrorToast,
})
```

### Open redirect guard

Always validate `?next=` before navigating. Never trust raw query param values.

```ts
// src/auth/guards.tsx (also used by LoginPage)
const SAFE_PATHS = ['/analytics', '/studio', '/story-arcs', '/reels', '/recipes', '/activity']

export function safePath(next: string | null): string {
  if (!next) return '/analytics'
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) return '/analytics'
    if (!SAFE_PATHS.some((p) => url.pathname.startsWith(p))) return '/analytics'
    return url.pathname + url.search
  } catch {
    return '/analytics'
  }
}
```

---

## Logout Flow

1. Call `useAuth.getState().clear()` — wipes token and claims from memory.
2. Call `broadcastLogout()` — notifies all other tabs via `BroadcastChannel`.
3. Navigate to `/login` (replace, not push).
4. TanStack Query cache is **not** manually cleared — `gcTime: 0` on sensitive queries (briefing, post-publish report) ensures they drop on unmount. Standard queries are harmless stale shells; they refetch when the next authenticated session starts.

```ts
function handleLogout() {
  useAuth.getState().clear()
  broadcastLogout()
  navigate('/login', { replace: true })
}
```

---

## Multi-Tab Logout (`src/auth/broadcastLogout.ts`)

Any tab can trigger a logout. All other tabs must react and clear themselves.

```ts
const channel = new BroadcastChannel('auth')

export function broadcastLogout() {
  channel.postMessage({ type: 'LOGOUT' })
}

export function listenForLogout(onLogout: () => void) {
  channel.addEventListener('message', (e) => {
    if (e.data?.type === 'LOGOUT') onLogout()
  })
}
```

Wire the listener once at app startup:

```ts
// src/main.tsx
listenForLogout(() => {
  useAuth.getState().clear()
  window.location.replace('/login')
})
```

---

## Axios Interceptors (`src/api/client.ts`)

### Request interceptor — attaches JWT

```ts
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post', 'patch', 'put', 'delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})
```

### Response interceptor — auto-logout on token errors

```ts
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const code = err.response?.data?.errorCode
    if (code === 'auth.token_expired' || code === 'auth.token_reuse_detected') {
      useAuth.getState().clear()
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)
```

Switch on `errorCode` string — never on HTTP status number. Both `auth.token_expired` and `auth.token_reuse_detected` clear the token immediately without a toast (the redirect is feedback enough).

---

## briefingLoading Flag

`briefingLoading` in the auth store is dedicated to the 15-second analyze-draft flow — it does **not** indicate "user is logged in" or "auth is pending". It means the user's briefing is being generated and the app is in a blocking state.

```ts
// useAnalyzeDraft.ts
onMutate:  () => useAuth.getState().setBriefingLoading(true)
onSettled: () => useAuth.getState().setBriefingLoading(false)
```

When `briefingLoading === true`:
- Render `<BriefingLoadingScreen />` full-screen over the app.
- Block all navigation with React Router `useBlocker`.
- No cancel button — the operation cannot be aborted mid-flight.

---

## Reset Other Stores on Logout

Every Zustand store holding user-specific state must subscribe to the auth token and reset when it clears:

```ts
// src/features/analytics/store.ts
useAuth.subscribe(
  (s) => s.token,
  (token) => {
    if (!token) useAnalyticsUI.setState({ activeWindow: { days: 30 } })
  }
)
```

This subscription must be registered at module load time (outside any component), so it fires even if the feature page is not mounted.

---

## Error Codes

| errorCode | Meaning | Handling |
|---|---|---|
| `auth.token_expired` | JWT TTL elapsed | Clear token → redirect `/login` (response interceptor) |
| `auth.token_reuse_detected` | Refresh token reuse (stolen token) | Clear token → redirect `/login` (response interceptor) |
| `auth.invalid_credentials` | Wrong email/password on login | `showErrorToast` on `<LoginPage />` |
| `auth.account_not_found` | No account for email | `showErrorToast` on `<LoginPage />` |
| `auth.creator_role_required` | Authenticated but wrong role | Render `<UnauthorizedPage />` via `RequireCreatorRole` |

Always switch on the `errorCode` string. Never branch on `err.response?.status`.
