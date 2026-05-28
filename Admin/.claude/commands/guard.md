# /guard — Scaffold auth and role guards

Create route guards for `$ARGUMENTS`.

---

## Rules

1. Guards live in `src/auth/guards.tsx`.
2. `RequireAuth` — redirects to `/login` when no token.
3. `RequireRole` — redirects to `/kyc` (default landing) when role check fails.
4. Use `permissions.*()` from `src/lib/permissions.ts` — never inline role string checks.
5. Read `.claude/references/auth-flow.md` for 401 routing logic.

---

## RequireAuth template

```tsx
// src/auth/guards.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/store'

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
```

---

## RequireRole template

```tsx
interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const claims = useAuth((s) => s.claims)
  const userRoles: string[] = claims?.roles ?? []

  const hasRole = roles.some((r) => userRoles.includes(r))

  if (!hasRole) {
    return fallback ? <>{fallback}</> : <Navigate to="/kyc" replace />
  }

  return <>{children}</>
}
```

---

## Using permissions helper in components

```tsx
// src/lib/permissions.ts
export const permissions = {
  canReviewKyc:       (r: string[]) => r.some(x => ['SuperAdmin','KycReviewer'].includes(x)),
  canModerateContent: (r: string[]) => r.some(x => ['SuperAdmin','ContentMod'].includes(x)),
  canManagePayouts:   (r: string[]) => r.some(x => ['SuperAdmin','PayoutsOps'].includes(x)),
  canManageAdmins:    (r: string[]) => r.includes('SuperAdmin'),
  canManageFlags:     (r: string[]) => r.some(x => ['SuperAdmin','SupportAgent'].includes(x)),
}

// In component:
import { permissions } from '@/lib/permissions'
import { useAuth } from '@/auth/store'

export function ActionButton() {
  const claims = useAuth((s) => s.claims)
  const roles: string[] = claims?.roles ?? []

  if (!permissions.canManageAdmins(roles)) return null

  return <Button>Disable Account</Button>
}
```

---

## MFA setup guard (post-login redirect)

```tsx
// In SsoCallback.tsx — after successful login
const mfaQuery = useMeMfa()

useEffect(() => {
  if (mfaQuery.data && !mfaQuery.data.hasTotp) {
    navigate('/settings/mfa/setup', { replace: true })
  }
}, [mfaQuery.data])
```

---

## Invariants

- `RequireAuth` and `RequireRole` live exclusively in `src/auth/guards.tsx`
- Role checks in components use `permissions.*()` — never `claims?.roles.includes('SuperAdmin')`
- `RequireRole` in router tree — not inside page or feature components
- After SSO login: always check `hasTotp` before allowing navigation
- Token absence → `/login` redirect — missing role → `/kyc` redirect (not login)
