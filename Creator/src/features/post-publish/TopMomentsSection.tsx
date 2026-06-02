import type { TopMoment } from '@/api/schema'
import { formatMs, formatPercent } from '@/lib/formatters'

interface TopMomentsSectionProps {
  moments: TopMoment[]
}

export function TopMomentsSection({ moments }: TopMomentsSectionProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Top Moments</h3>
      <ul className="space-y-2">
        {moments.map((m, i) => (
          <li key={i} className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-primary">{formatMs(m.atMs)}</span>
              <span className="ml-2 text-sm text-text-primary">{m.label}</span>
            </div>
            <span className="text-sm font-medium text-text-secondary">{formatPercent(m.retentionRate)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
