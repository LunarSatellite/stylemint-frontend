import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './store'

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children ? <>{children}</> : <Outlet />
}

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const claims = useAuth((s) => s.claims)
  const userRoles: string[] = claims?.roles ?? []
  const hasRole = roles.some((r) => userRoles.includes(r))
  if (!hasRole) return fallback ? <>{fallback}</> : <Navigate to="/kyc" replace />
  return <>{children}</>
}
