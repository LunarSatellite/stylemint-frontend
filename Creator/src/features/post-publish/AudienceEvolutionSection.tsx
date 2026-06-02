import type { AudienceEvolutionPoint } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

interface AudienceEvolutionSectionProps {
  evolution: AudienceEvolutionPoint[]
}

export function AudienceEvolutionSection({ evolution }: AudienceEvolutionSectionProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Audience Evolution</h3>
      <ul className="space-y-2">
        {evolution.map((p) => (
          <li key={p.weekOffset} className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Week {p.weekOffset}</span>
            <div className="flex gap-4">
              <span className="text-xs text-text-secondary">+{formatPercent(p.newFollowerRate)}</span>
              <span className="text-xs text-primary">{formatPercent(p.retainedFollowerRate)} retained</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
