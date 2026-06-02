import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './store'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()

  if (!token) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  return <>{children}</>
}

export function RequireCreatorRole({ children }: { children: React.ReactNode }) {
  const claims = useAuth((s) => s.claims)

  if (claims?.role !== 'creator') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-muted">Access denied.</p>
      </div>
    )
  }

  return <>{children}</>
}

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
