import type { AudienceDemographic } from '@/api/schema'
import { formatPercent } from '@/lib/formatters'

interface AudienceDemographicsProps {
  demographics: AudienceDemographic[]
}

export function AudienceDemographics({ demographics }: AudienceDemographicsProps) {
  return (
    <div className="rounded-xl bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-text-secondary">Audience Demographics</h3>
      <ul className="space-y-2">
        {demographics.map((d) => (
          <li key={d.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-primary">{d.label}</span>
              <span className="text-text-secondary">{formatPercent(d.fraction)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${d.fraction * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
