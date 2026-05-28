# Auth — stylemint-brand-fe

Everything auth-related. Read this before touching login, token handling, route guards, or the axios client.

---

## Files

```
src/auth/
├── store.ts              # Zustand auth store — token, claims, vendorAccountId, draftingBrief
├── parseClaims.ts        # JWT decode → typed claims
├── silentRefresh.ts      # schedule refresh at 80% TTL
├── broadcastLogout.ts    # BroadcastChannel cross-tab logout
└── guards.tsx            # RequireAuth, RequireVendorRole, RequireAdminRole
```

---

## Zustand auth store

```ts
// src/auth/store.ts
import { create } from 'zustand'
import { parseClaims, type JwtClaims } from './parseClaims'

interface AuthState {
  token:           string | null
  claims:          JwtClaims | null
  vendorAccountId: string | null   // non-null only for multi-team vendor users
  draftingBrief:   boolean         // true while LLM draft POST is in flight (2-5s)

  setToken:           (token: string) => void
  setVendorAccountId: (id: string | null) => void
  setDraftingBrief:   (v: boolean) => void
  clear:              () => void
}

export const useAuth = create<AuthState>((set) => ({
  token:           null,
  claims:          null,
  vendorAccountId: null,
  draftingBrief:   false,

  setToken:           (token) => set({ token, claims: parseClaims(token) }),
  setVendorAccountId: (id)    => set({ vendorAccountId: id }),
  setDraftingBrief:   (v)     => set({ draftingBrief: v }),
  clear: () => set({ token: null, claims: null, vendorAccountId: null, draftingBrief: false }),
}))
```

**Token lives in JS memory only.** Never `localStorage`. Never `sessionStorage`. Never cookies.
The trade-off: token is lost on page refresh (by design — silent refresh handles re-auth).

---

## JWT claims shape

```ts
// src/auth/parseClaims.ts
export interface JwtClaims {
  sub:   string          // user ID
  email: string
  role:  'vendor' | 'admin'
  exp:   number          // unix timestamp (seconds)
  iat:   number
}

export function parseClaims(token: string): JwtClaims {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload)) as JwtClaims
}
```

Never trust claims for authorization decisions — that's the backend's job. Claims are used only for:
- Displaying the user's name / email in the UI
- Showing/hiding role-gated UI elements (not a security boundary)
- Scheduling the silent refresh timer

---

## Silent refresh

Refresh the JWT at 80% of its remaining TTL. Never wait for a 401.

```ts
// src/auth/silentRefresh.ts
import { api } from '@/api/client'
import { useAuth } from './store'
import { parseClaims } from './parseClaims'
import { broadcastLogout } from './broadcastLogout'

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSilentRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer)

  const msRemaining = expiresAt - Date.now()
  const delay = msRemaining * 0.8

  refreshTimer = setTimeout(async () => {
    try {
      const { data } = await api.post<{ token: string }>('/v1/auth/refresh')
      useAuth.getState().setToken(data.token)
      const claims = parseClaims(data.token)
      scheduleSilentRefresh(claims.exp * 1000)   // reschedule for new token
    } catch {
      useAuth.getState().clear()
      broadcastLogout()
      window.location.replace('/login')
    }
  }, delay)
}

export function cancelSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
}
```

Call `scheduleSilentRefresh(claims.exp * 1000)` immediately after a successful login.
Call `cancelSilentRefresh()` on manual logout.

---

## BroadcastChannel cross-tab logout

When any tab logs out (manual or expired), all other open tabs must also clear their session.

```ts
// src/auth/broadcastLogout.ts
const CHANNEL_NAME = 'sm_auth'

let channel: BroadcastChannel | null = null

function getChannel() {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export function broadcastLogout() {
  getChannel().postMessage({ type: 'logout' })
}

export function subscribeBroadcastLogout(onLogout: () => void): () => void {
  const ch = getChannel()
  const handler = (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type === 'logout') onLogout()
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
```

Wire up in `main.tsx`:

```ts
// src/main.tsx
subscribeBroadcastLogout(() => {
  useAuth.getState().clear()
  cancelSilentRefresh()
  // React Router navigate is not available here — use window directly
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login')
  }
})
```

---

## Axios interceptors

### Request interceptor — attach auth headers

```ts
// src/api/client.ts
import axios from 'axios'
import { useAuth } from '@/auth/store'
import { newIdempotencyKey } from './idempotency'
import { env } from '@/env'

export const api = axios.create({ baseURL: env.apiBaseUrl })

const MUTATING_METHODS = new Set(['post', 'patch', 'put', 'delete'])

api.interceptors.request.use((config) => {
  const { token, vendorAccountId } = useAuth.getState()

  if (token)
    config.headers.Authorization = `Bearer ${token}`

  if (MUTATING_METHODS.has(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()

  if (vendorAccountId !== null)
    config.headers['X-Vendor-Account-Id'] = vendorAccountId

  config.headers['Accept-Language'] = navigator.language || 'en'

  return config
})
```

`X-Vendor-Account-Id` is sent **only** when `vendorAccountId !== null`. This header identifies which vendor team the user is acting on behalf of. Sending it when null would be a bug.

### Response interceptor — handle 401

```ts
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuth.getState().clear()
      cancelSilentRefresh()
      broadcastLogout()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)
```

401 handling is centralized here — never handle it in individual query hooks.

---

## Idempotency key

```ts
// src/api/idempotency.ts
import { v4 as uuidv4 } from 'uuid'

export function newIdempotencyKey(): string {
  return uuidv4()
}
```

The interceptor attaches a new key to every mutating request automatically via `??=` — it will not overwrite one if the caller already set it (for explicit retries).

---

## Route guards

```tsx
// src/auth/guards.tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './store'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function RequireVendorRole({ children }: { children: React.ReactNode }) {
  const claims = useAuth((s) => s.claims)
  if (claims?.role !== 'vendor') return <Navigate to="/login" replace />
  return <>{children}</>
}

export function RequireAdminRole({ children }: { children: React.ReactNode }) {
  const claims = useAuth((s) => s.claims)
  if (claims?.role !== 'admin') return <Navigate to="/login" replace />
  return <>{children}</>
}
```

Guards are **UX only** — they redirect unauthorized users. The backend enforces actual authorization. Never rely on a client-side role check as a security boundary.

---

## Login flow

```ts
// Pseudocode for LoginPage submit handler
async function onSubmit(credentials: LoginCredentials) {
  const { data } = await api.post<{ token: string }>('/v1/auth/login', credentials)
  useAuth.getState().setToken(data.token)
  const claims = parseClaims(data.token)
  scheduleSilentRefresh(claims.exp * 1000)
  navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
}
```

After login: set token → schedule silent refresh → redirect to original destination (or dashboard).

---

## Logout flow

```ts
async function logout() {
  try {
    await api.post('/v1/auth/logout')   // invalidate refresh token server-side
  } finally {
    useAuth.getState().clear()
    cancelSilentRefresh()
    broadcastLogout()
    navigate('/login', { replace: true })
  }
}
```

Always clear local state even if the server call fails.

---

## Hard rules

- Token in memory only — never `localStorage`, `sessionStorage`, or cookies
- `X-Vendor-Account-Id` sent only when `vendorAccountId !== null`
- Silent refresh at 80% TTL — never on 401 (401 = clear + redirect)
- 401 handled in response interceptor only — never in individual hooks
- `broadcastLogout()` called on every logout (manual, expired, 401)
- Route guards are UX, not security — backend enforces authorization
- `draftingBrief` resets in `onSettled`, not `onSuccess` — always resets even on error
