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
