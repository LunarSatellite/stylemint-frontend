import { useMeSessions } from '@/api/queries/useMeSessions'
import { useAuth } from '@/auth/store'
import type { AdminSessionDto } from '@/api/schema'

function parseUserAgent(ua: string): string {
  let browser = 'Unknown Browser'
  const opera   = ua.match(/OPR\/(\d+)/)
  const edge    = ua.match(/Edg\/(\d+)/)
  const chrome  = ua.match(/Chrome\/(\d+)/)
  const firefox = ua.match(/Firefox\/(\d+)/)
  const safari  = ua.match(/Version\/(\d+).*Safari/)
  if (opera)        browser = `Opera ${opera[1]}`
  else if (edge)    browser = `Edge ${edge[1]}`
  else if (chrome)  browser = `Chrome ${chrome[1]}`
  else if (firefox) browser = `Firefox ${firefox[1]}`
  else if (safari)  browser = `Safari ${safari[1]}`

  let os = 'Unknown OS'
  if (/Android/.test(ua))          os = 'Android'
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'
  else if (/Windows NT/.test(ua))  os = 'Windows'
  else if (/Mac OS X/.test(ua))    os = 'macOS'
  else if (/Linux/.test(ua))       os = 'Linux'

  let device = 'Desktop'
  if (/iPhone|Windows Phone/.test(ua))          device = 'Mobile'
  else if (/iPad/.test(ua))                      device = 'Tablet'
  else if (/Android/.test(ua) && /Mobile/.test(ua)) device = 'Mobile'
  else if (/Android/.test(ua))                   device = 'Tablet'

  return `${browser} · ${os} · ${device}`
}

export function MySessionsContainer() {
  const { data, isLoading } = useMeSessions()
  const claims = useAuth((s) => s.claims)
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  return (
    <div className="space-y-2">
      {(data ?? []).map((session: AdminSessionDto) => (
        <div key={session.jti} className="flex items-center justify-between bg-bg-card border border-[var(--surface-border)] rounded-lg px-5 py-4">
          <div>
            <p className="text-text-primary text-sm">{parseUserAgent(session.userAgent ?? '')}</p>
            <p className="text-text-muted text-xs">{session.sourceIp}</p>
          </div>
          {session.jti === claims?.jti && <span className="px-2 py-0.5 text-xs rounded bg-[var(--glow-primary)] text-primary border border-[var(--border-primary)]">This browser</span>}
        </div>
      ))}
    </div>
  )
}
