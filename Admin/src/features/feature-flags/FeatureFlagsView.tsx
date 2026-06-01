import { Link } from 'react-router-dom'

type Flag = { key: string; enabled: boolean; description?: string }

export function FeatureFlagsView({ flags, isLoading }: { flags: Flag[]; isLoading?: boolean }) {
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div key={flag.key} className="flex items-center justify-between bg-bg-card border border-[var(--surface-border)] rounded-lg px-5 py-4">
          <div>
            <p className="text-text-primary font-mono text-sm">{flag.key}</p>
            {flag.description && <p className="text-text-muted text-xs mt-0.5">{flag.description}</p>}
          </div>
          <div className="flex items-center gap-4">
            <span className={flag.enabled ? 'text-primary text-sm' : 'text-text-muted text-sm'}>{flag.enabled ? 'Enabled' : 'Disabled'}</span>
            <Link to={`/feature-flags/${flag.key}`} className="text-primary text-sm underline">Edit</Link>
          </div>
        </div>
      ))}
    </div>
  )
}
