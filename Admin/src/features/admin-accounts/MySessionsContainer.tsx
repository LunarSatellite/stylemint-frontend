import { useMeSessions } from '@/api/queries/useMeSessions'
import { useAuth } from '@/auth/store'
import type { components } from '@/api/schema'

type AdminSessionDto = components['schemas']['StyleMint.Modules.Admin.Entity.Dtos.AdminSessionDto']

export function MySessionsContainer() {
  const { data, isLoading } = useMeSessions()
  const claims = useAuth((s) => s.claims)
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  return (
    <div className="space-y-2">
      {(data ?? []).map((session: AdminSessionDto) => (
        <div key={session.jti} className="flex items-center justify-between bg-bg-card border border-[var(--surface-border)] rounded-lg px-5 py-4">
          <div>
            <p className="text-text-primary text-sm">{session.userAgent}</p>
            <p className="text-text-muted text-xs">{session.sourceIp}</p>
          </div>
          {session.jti === claims?.jti && <span className="px-2 py-0.5 text-xs rounded bg-[var(--glow-primary)] text-primary border border-[var(--border-primary)]">This browser</span>}
        </div>
      ))}
    </div>
  )
}
