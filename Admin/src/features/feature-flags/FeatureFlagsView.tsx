import { Link } from 'react-router-dom'
import type { FeatureFlagDto } from '@/api/schema'

type Flag = FeatureFlagDto

export function FeatureFlagsView({ flags, isLoading }: { flags: Flag[]; isLoading?: boolean }) {
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!flags.length) return <div className="text-text-muted text-sm">No feature flags configured.</div>
  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div key={flag.key} className="flex items-center justify-between rounded-lg border border-[var(--surface-border)] bg-bg-card px-5 py-4">
          <div>
            <p className="font-mono text-sm text-text-primary">{flag.key}</p>
            {flag.description && <p className="mt-0.5 text-xs text-text-muted">{flag.description}</p>}
          </div>
          <div className="flex items-center gap-4">
            <span className={flag.defaultEnabled ? 'text-sm text-primary' : 'text-sm text-text-muted'}>
              {flag.defaultEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <Link to={`/feature-flags/${flag.key}`} className="text-sm text-primary underline">Edit</Link>
          </div>
        </div>
      ))}
    </div>
  )
}
